import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import apiRoutes from './routes/api';
import { startGmailCron } from './services/gmail.service';

const app = express();
const port = process.env.PORT || 0;

// Start the cron job if enabled
startGmailCron();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.send('Delta X Tool Backend Running');
});

const server = app.listen(port, () => {
  const address = server.address();
  const actualPort = typeof address === 'string' ? address : address?.port;
  console.log(`Server listening on port ${actualPort}`);
});
