const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const laptopRoutes = require('./routes/laptops');
const customerRoutes = require('./routes/customers');
const saleRoutes = require('./routes/sales');

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/laptops', laptopRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', saleRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
