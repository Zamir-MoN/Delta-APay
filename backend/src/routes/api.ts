import { Router } from 'express';
import { prisma } from '../utils/prisma.util';
import { EventEmitter } from 'events';
import QRCode from 'qrcode';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const confirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 confirm requests per window
  message: { error: 'Too many UTR submission attempts, please try again later' }
});

const router = Router();
export const orderEventEmitter = new EventEmitter();

function generatePurpose() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'DX-';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Diagnostic ping route
router.get('/ping', (req, res) => {
  res.json({ message: 'pong', backendPort: process.env.PORT || 3005 });
});

// Create Order (Legacy)
router.post('/orders', async (req, res) => {
  try {
    const { amount, productId } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const purpose = generatePurpose();
    const expiresAt = new Date(Date.now() + 3000 * 24 * 60 * 60 * 1000); // effectively never

    const order = await prisma.order.create({
      data: {
        amount,
        purpose,
        productId,
        expiresAt,
      }
    });

    const upiUri = `upi://pay?pa=20-delta-mondal@fam&pn=Delta%20X&am=${amount}&tn=${purpose}&tr=${purpose}&cu=INR`;
    const qrCodeDataUrl = await QRCode.toDataURL(upiUri, {
      color: {
        dark: '#ffffff',
        light: '#09090b',
      }
    });

    res.json({
      order,
      upiUri,
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// API Gateway: Create Checkout Session
router.post('/v1/checkout/sessions', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing x-api-key header' });
    }

    const user = await prisma.user.findUnique({ where: { apiKey: apiKey as string } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid API Key' });
    }

    const { amount, redirectUrl, webhookUrl, metadata } = req.body;

    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Amount must be a number and is required' });
    }

    const purpose = generatePurpose();
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour expiry

    const order = await prisma.order.create({
      data: {
        amount,
        purpose,
        expiresAt,
        redirectUrl,
        webhookUrl,
        metadata
      }
    });

    // Provide a checkout URL pointing to the frontend
    const frontendUrl = process.env.FRONTEND_URL || (req.headers.origin ? (req.headers.origin as string) : 'http://localhost:4005');
    const checkoutUrl = `${frontendUrl}/pay/${order.id}`;

    res.json({
      success: true,
      checkoutUrl,
      orderId: order.id,
      amount: order.amount,
      expiresAt: order.expiresAt
    });
  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Order Status & Details
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const upiUri = `upi://pay?pa=20-delta-mondal@fam&pn=Delta%20X&mc=0000&am=${order.amount}&tn=${order.purpose}&tr=${order.purpose}&cu=INR`;
    const qrCodeDataUrl = await QRCode.toDataURL(upiUri, {
      color: {
        dark: '#ffffff',
        light: '#09090b',
      }
    });

    res.json({ 
      status: order.status, 
      amount: order.amount, 
      purpose: order.purpose,
      qrCode: qrCodeDataUrl,
      upiUri: upiUri,
      redirectUrl: order.redirectUrl
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// SSE endpoint for order status
router.get('/orders/:id/status', async (req, res) => {
  const orderId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial status
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order) {
    res.write(`data: ${JSON.stringify({ status: order.status })}\n\n`);
  }

  const listener = (updatedOrderId: string, status: string) => {
    if (updatedOrderId === orderId) {
      res.write(`data: ${JSON.stringify({ status })}\n\n`);
    }
  };

  orderEventEmitter.on('statusChanged', listener);

  req.on('close', () => {
    orderEventEmitter.removeListener('statusChanged', listener);
  });
});

import { processPaymentEmail } from '../services/verification.service';

// Confirm Payment via UTR
router.post('/orders/:id/confirm', confirmLimiter, async (req, res) => {
  try {
    const orderId = req.params.id as string;
    const { utr } = req.body;

    if (!utr || typeof utr !== 'string' || !/^\d{12}$/.test(utr)) {
      return res.status(400).json({ error: 'Valid 12-digit UTR is required' });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({ error: 'Order is no longer pending' });
    }

    // Check if UTR exists in Transaction table
    const transaction = await prisma.transaction.findUnique({ where: { utr } });
    
    if (transaction) {
      if (transaction.orderId) {
        return res.status(400).json({ error: 'This UTR has already been used for another order' });
      }
      
      if (transaction.amount !== order.amount) {
        return res.status(400).json({ error: `Amount mismatch. Expected ${order.amount}, got ${transaction.amount}` });
      }
      
      // Match found and valid! Complete order immediately.
      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { orderId: order.id }
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: "PAID", submittedUtr: utr }
        });
      });

      orderEventEmitter.emit("statusChanged", order.id, "PAID");

      // Trigger webhook if provided
      if (order.webhookUrl) {
        const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
        if (owner) {
          const payload = JSON.stringify({
            orderId: order.id,
            status: "PAID",
            amount: order.amount,
            metadata: order.metadata
          });
          
          const signature = crypto.createHmac('sha256', owner.apiKey).update(payload).digest('hex');

          fetch(order.webhookUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-webhook-signature': signature
            },
            body: payload
          }).catch(err => console.error("Webhook trigger failed:", err));
        }
      }

      return res.json({ success: true, message: 'Payment verified successfully!' });
    } else {
      // Transaction doesn't exist yet (email delayed).
      
      // Check if another order has already claimed this UTR
      const existingOrderWithUtr = await prisma.order.findFirst({
        where: { submittedUtr: utr, id: { not: order.id } }
      });
      
      if (existingOrderWithUtr) {
        return res.status(400).json({ error: 'This UTR has already been claimed by another order' });
      }

      // Just save UTR for when the email arrives.
      await prisma.order.update({
        where: { id: order.id },
        data: { submittedUtr: utr }
      });
      return res.json({ success: true, pending: true, message: 'UTR saved. Waiting for bank confirmation.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});



export default router;
