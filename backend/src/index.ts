import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import apiRoutes from './routes/api';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.send('Delta X Tool Backend Running');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
