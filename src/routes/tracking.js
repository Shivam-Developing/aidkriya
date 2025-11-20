const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  startWalkSession,
  updateLocation,
  endWalkSession,
  getWalkSession,
  getSessionByRequest,  // NEW - Add this import
  getPartnerLocation,
  sendSOSAlert,
  getWalkOtp,
  verifyWalkOtp
} = require('../controllers/trackingController');
const { protect } = require('../middleware/auth');
const { validate, validators } = require('../middleware/validation');

// OTP routes
router.get('/otp/:walkRequestId', protect, getWalkOtp);

router.post(
  '/verify-otp',
  protect,
  [
    body('walk_request_id').notEmpty().withMessage('Walk request ID is required'),
    body('otp').notEmpty().withMessage('OTP is required'),
    validate
  ],
  verifyWalkOtp
);

// Session routes
// IMPORTANT: /session/by-request/:walkRequestId MUST come BEFORE /session/:sessionId
// Otherwise Express will treat "by-request" as a sessionId

// @route   GET /api/tracking/session/by-request/:walkRequestId (NEW)
router.get('/session/by-request/:walkRequestId', protect, getSessionByRequest);

// @route   GET /api/tracking/session/:sessionId
router.get('/session/:sessionId', protect, getWalkSession);

// Session management routes
// @route   POST /api/tracking/start
router.post(
  '/start',
  protect,
  [
    body('walk_request_id').notEmpty().withMessage('Walk request ID is required'),
    body('wanderer_id').notEmpty().withMessage('Wanderer ID is required'),
    body('walker_id').notEmpty().withMessage('Walker ID is required'),
    validate
  ],
  startWalkSession
);

// @route   POST /api/tracking/update-location
router.post(
  '/update-location',
  protect,
  [
    body('session_id').notEmpty().withMessage('Session ID is required'),
    body('location.latitude').custom(validators.isValidCoordinate),
    body('location.longitude').custom(validators.isValidLongitude),
    body('location.timestamp').notEmpty().withMessage('Timestamp is required'),
    validate
  ],
  updateLocation
);

// @route   POST /api/tracking/end
router.post(
  '/end',
  protect,
  [
    body('session_id').notEmpty().withMessage('Session ID is required'),
    validate
  ],
  endWalkSession
);

// @route   GET /api/tracking/partner-location/:sessionId
router.get('/partner-location/:sessionId', protect, getPartnerLocation);

// @route   POST /api/tracking/sos-alert
router.post(
  '/sos-alert',
  protect,
  [
    body('session_id').notEmpty().withMessage('Session ID is required'),
    body('location.latitude').custom(validators.isValidCoordinate),
    body('location.longitude').custom(validators.isValidLongitude),
    validate
  ],
  sendSOSAlert
);

module.exports = router;
