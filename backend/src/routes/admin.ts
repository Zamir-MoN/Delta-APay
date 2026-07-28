import { Router } from 'express';
import { prisma } from '../utils/prisma.util';

const router = Router();

// Simple Login (Auto-creates owner if it doesn't exist)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (email === 'zamir' && password === 'zamir') {
      let user = await prisma.user.findUnique({ where: { email: 'zamir' } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: 'zamir',
            password: 'zamir', // In production, hash this!
            role: 'OWNER'
          }
        });
      }
      
      // We'll use the API key as a simple auth token for the dashboard
      return res.json({ success: true, token: user.apiKey });
    }
    
    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to protect admin routes
router.use(async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const user = await prisma.user.findUnique({ where: { apiKey: token } });
    if (!user || user.role !== 'OWNER') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Admin stats and API Key
router.get('/me', async (req, res) => {
  const user = (req as any).user;
  
  try {
    const paidOrders = await prisma.order.aggregate({
      _sum: { amount: true },
      where: { status: 'PAID' }
    });
    
    const pendingCount = await prisma.order.count({ where: { status: 'PENDING' } });
    const paidCount = await prisma.order.count({ where: { status: 'PAID' } });

    res.json({ 
      apiKey: user.apiKey, 
      email: user.email,
      totalRevenue: paidOrders._sum.amount || 0,
      pendingCount,
      paidCount
    });
  } catch (error) {
    res.json({ apiKey: user.apiKey, email: user.email, totalRevenue: 0, pendingCount: 0, paidCount: 0 });
  }
});

// Get recent orders
router.get('/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get recent transactions
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
