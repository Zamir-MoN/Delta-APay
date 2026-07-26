import { Router } from 'express';
import { prisma } from '../utils/prisma.util';
import { EventEmitter } from 'events';
import QRCode from 'qrcode';

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

// Create Order
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
router.post('/orders/:id/confirm', async (req, res) => {
  try {
    const orderId = req.params.id;
    const { utr } = req.body;

    if (!utr) {
      return res.status(400).json({ error: 'UTR is required' });
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
        console.log('Reusing UTR for testing...');
        // return res.status(400).json({ error: 'This UTR has already been used for another order' });
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
      return res.json({ success: true, message: 'Payment verified successfully!' });
    } else {
      // Transaction doesn't exist yet (email delayed). Just save UTR.
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

// Simulate Payment Verification (For Testing)
router.post('/simulate', async (req, res) => {
  const { purpose, amount, utr, sender } = req.body;
  if (!purpose || !amount || !utr) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const success = await processPaymentEmail({
    purpose,
    amount: parseFloat(amount),
    utr,
    transactionId: `TEST-${Date.now()}`,
    sender: sender || 'Test User',
    date: new Date().toISOString()
  });

  if (success) {
    res.json({ success: true, message: 'Order verified successfully' });
  } else {
    res.status(400).json({ success: false, error: 'Order not found, already processed, or expired' });
  }
});

export default router;
