import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import apiRoutes from './routes/api';
import adminRoutes from './routes/admin';
import { startGmailCron } from './services/gmail.service';

const app = express();
const port = process.env.PORT || 3005;

// Start the cron job if enabled
startGmailCron();

// Global Rate Limiter: 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(globalLimiter);

// Routes
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('Delta X Tool Backend Running');
});

const server = app.listen(port as number, '0.0.0.0', () => {
  const address = server.address();
  const actualPort = typeof address === 'string' ? address : address?.port;
  console.log(`Server listening on port ${actualPort} (0.0.0.0)`);
});
