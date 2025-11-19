const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createPaymentOrder,
  verifyPayment,
  getTransactionHistory,
  getPaymentDetails,
  addToWallet,
  getWalletBalance
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

// @route   POST /api/payment/create-order
router.post(
  '/create-order',
  protect,
  [
    body('walk_session_id').notEmpty().withMessage('Walk session ID is required'),
    validate
  ],
  createPaymentOrder
);

// @route   POST /api/payment/verify
router.post(
  '/verify',
  protect,
  [
    body('walk_session_id').notEmpty().withMessage('Walk session ID is required'),
    body('razorpay_payment_id').notEmpty().withMessage('Razorpay payment ID is required'),
    body('razorpay_order_id').notEmpty().withMessage('Razorpay order ID is required'),
    body('razorpay_signature').notEmpty().withMessage('Razorpay signature is required'),
    validate
  ],
  verifyPayment
);

// @route   GET /api/payment/transactions/:userId
router.get('/transactions/:userId', protect, getTransactionHistory);

// @route   GET /api/payment/:paymentId
router.get('/:paymentId', protect, getPaymentDetails);

// @route   POST /api/payment/add-to-wallet
router.post(
  '/add-to-wallet',
  protect,
  [
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    validate
  ],
  addToWallet
);

// @route   GET /api/payment/wallet/:userId
router.get('/wallet/:userId', protect, getWalletBalance);
// Add these routes to payment.js

router.post('/create-wallet-order', protect, [
  body('amount').isFloat({ min: 1, max: 10000 }),
  validate
], createWalletOrder);

router.post('/verify-wallet-payment', protect, [
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_order_id').notEmpty(),
  body('razorpay_signature').notEmpty(),
  body('amount').isFloat({ min: 1 }),
  validate
], verifyWalletPayment);
module.exports = router;
