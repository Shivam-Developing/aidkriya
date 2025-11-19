const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'aidKRIYA Walker API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      profile: '/api/profile',
      walkRequest: '/api/walk-request',
      matching: '/api/matching',
      tracking: '/api/tracking',
      payment: '/api/payment',
      rating: '/api/rating'
    }
  });
});

// API Routes (versioned under /api)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/walk-request', require('./routes/walkRequest'));
app.use('/api/matching', require('./routes/matching'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/rating', require('./routes/rating'));
app.use('/api/notifications', require('./routes/notification'));

// Convenience aliases without /api prefix to support existing Flutter calls
// e.g. Flutter hitting /auth/login instead of /api/auth/login
app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/walk-request', require('./routes/walkRequest'));
app.use('/matching', require('./routes/matching'));
app.use('/tracking', require('./routes/tracking'));
app.use('/payment', require('./routes/payment'));
app.use('/rating', require('./routes/rating'));
app.use('/notifications', require('./routes/notification'));

// Error handlers (must be last)
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║   🚀 aidKRIYA Walker API Server Running          ║
  ║   📍 Port: ${PORT}                                     ║
  ║   🌍 Environment: ${process.env.NODE_ENV || 'development'}              ║
  ║   📊 Database: Connected                         ║
  ╚═══════════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
  });
});

module.exports = server;
