const Razorpay = require('razorpay');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const WalkSession = require('../models/WalkSession');
const User = require('../models/User');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create Razorpay order for payment
// @route   POST /api/payment/create-order
// @access  Private
exports.createPaymentOrder = async (req, res) => {
  try {
    const { walk_session_id } = req.body;
    const userId = req.user._id;

    // Fetch walk session
    const session = await WalkSession.findById(walk_session_id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Walk session not found',
      });
    }

    // Check if user is the wanderer
    if (session.wandererId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only wanderer can initiate payment',
      });
    }

    // Get payment summary to calculate amount
    const distance = session.totalDistance || 0;
    const duration = session.duration || 0;
    
    // Calculate fare
    const baseFare = 10; // Base fare in rupees
    const perKmRate = 5; // Rate per km
    const totalFare = baseFare + (distance * perKmRate);
    
    const platformCommission = (totalFare * 0.25); // 25% commission
    const walkerEarnings = totalFare - platformCommission;

    // Amount in paise (Razorpay requires amount in smallest currency unit)
    const amountInPaise = Math.round(totalFare * 100);

    // ✅ FIX: Generate receipt ID with max 40 characters
    // MongoDB ObjectId is 24 chars, so we can safely use it directly
    const receiptId = `WLK_${walk_session_id.toString().substring(0, 35)}`; // WLK_ (4) + 35 = 39 chars max

    // Create Razorpay order
    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptId, // ✅ Max 40 characters [web:18]
      notes: {
        sessionId: walk_session_id.toString(),
        wandererId: session.wandererId.toString(),
        walkerId: session.walkerId.toString(),
        type: 'WALK_PAYMENT',
        distance: distance.toFixed(2),
        duration: duration.toString(),
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    // Create transaction record
    const transaction = new Transaction({
      user: userId,
      type: 'PAYMENT',
      amount: totalFare,
      status: 'PENDING',
      razorpayOrderId: order.id,
      walkSession: walk_session_id,
      description: `Payment for walk session`,
      paymentDetails: {
        baseFare,
        distance,
        platformCommission,
        walkerEarnings,
      },
    });

    await transaction.save();

    return res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        transactionId: transaction._id,
        fare: {
          totalAmount: totalFare,
          platformCommission,
          walkerEarnings,
        },
      },
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating payment order',
      error: error.message,
    });
  }
};

// @desc    Verify Razorpay payment
// @route   POST /api/payment/verify
// @access  Private
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      walk_session_id,
    } = req.body;

    // Generate signature for verification
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // Verify signature
    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature',
      });
    }

    // Update transaction
    const transaction = await Transaction.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    transaction.status = 'COMPLETED';
    transaction.razorpayPaymentId = razorpay_payment_id;
    transaction.razorpaySignature = razorpay_signature;
    transaction.completedAt = new Date();
    await transaction.save();

    // Update walk session status to COMPLETED
    const session = await WalkSession.findById(walk_session_id);
    if (session) {
      session.status = 'COMPLETED';
      await session.save();

      // Update walker earnings
      const walker = await User.findById(session.walkerId);
      if (walker) {
        walker.walletBalance += transaction.paymentDetails.walkerEarnings;
        walker.totalEarnings += transaction.paymentDetails.walkerEarnings;
        await walker.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        transactionId: transaction._id,
        paymentId: razorpay_payment_id,
      },
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message,
    });
  }
};

// @desc    Get transaction history
// @route   GET /api/payment/transactions/:userId
// @access  Private
exports.getTransactionHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, type } = req.query;

    const filter = { user: userId };
    if (type) {
      filter.type = type;
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('walkSession', 'startedAt endedAt')
      .lean();

    const count = await Transaction.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: 'Transaction history retrieved',
      data: {
        transactions,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
        },
      },
    });
  } catch (error) {
    console.error('Get transaction history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving transaction history',
      error: error.message,
    });
  }
};

// @desc    Get payment details
// @route   GET /api/payment/:paymentId
// @access  Private
exports.getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const transaction = await Transaction.findById(paymentId)
      .populate('user', 'name email phone')
      .populate('walkSession')
      .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment details retrieved',
      data: transaction,
    });
  } catch (error) {
    console.error('Get payment details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving payment details',
      error: error.message,
    });
  }
};

// @desc    Add money to wallet
// @route   POST /api/payment/add-to-wallet
// @access  Private
exports.addToWallet = async (req, res) => {
  try {
    const { user_id, amount } = req.body;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.walletBalance += amount;
    await user.save();

    // Create transaction record
    const transaction = new Transaction({
      user: user_id,
      type: 'WALLET_CREDIT',
      amount,
      status: 'COMPLETED',
      description: 'Wallet top-up',
    });
    await transaction.save();

    return res.status(200).json({
      success: true,
      message: 'Wallet updated successfully',
      data: {
        walletBalance: user.walletBalance,
        transactionId: transaction._id,
      },
    });
  } catch (error) {
    console.error('Add to wallet error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding to wallet',
      error: error.message,
    });
  }
};

// @desc    Get wallet balance
// @route   GET /api/payment/wallet/:userId
// @access  Private
exports.getWalletBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('walletBalance');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Wallet balance retrieved',
      data: {
        walletBalance: user.walletBalance || 0,
      },
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving wallet balance',
      error: error.message,
    });
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getTransactionHistory,
  getPaymentDetails,
  addToWallet,
  getWalletBalance,
};
