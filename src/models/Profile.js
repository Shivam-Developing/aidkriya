const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getProfile,
  setupProfile,
  uploadVerification,
  updateAvailability,
  updateLocation,
  getWalletBalance
} = require('../controllers/profileController');
const { protect, authorize } = require('../middleware/auth');
const { validate, validators } = require('../middleware/validation');

// @route   GET /api/profile/:userId
router.get('/:userId', getProfile);

// @route   PUT /api/profile/setup
router.put(
  '/setup',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('age').optional().isInt({ min: 18, max: 100 }).withMessage('Age must be between 18 and 100'),
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
    validate
  ],
  setupProfile
);

// @route   POST /api/profile/verification
router.post(
  '/verification',
  protect,
  [
    body('documentType').notEmpty().withMessage('Document type is required'),
    body('documentNumber').notEmpty().withMessage('Document number is required'),
    body('documentImage').notEmpty().withMessage('Document image is required'),
    validate
  ],
  uploadVerification
);

// @route   PUT /api/profile/availability
router.put(
  '/availability',
  protect,
  authorize('WALKER'),
  [
    body('isAvailable').isBoolean().withMessage('Availability must be a boolean'),
    validate
  ],
  updateAvailability
);

router.put(
  '/location',
  protect,
  authorize('WALKER'),
  [
    body('latitude').custom(validators.isValidCoordinate),
    body('longitude').custom(validators.isValidLongitude),
    validate
  ],
  updateLocation
);

// @route   GET /api/profile/wallet
router.get('/wallet', protect, getWalletBalance);

module.exports = router;
