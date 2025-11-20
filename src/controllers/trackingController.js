const express = require('express');
const router = express.Router();
const { 
  startWalkSession,
  updateLocation,
  endWalkSession,
  getWalkSession,
  getSessionByRequest,  // NEW
  getPartnerLocation,
  sendSOSAlert,
  getWalkOtp,
  verifyWalkOtp
} = require('../controllers/trackingController');
const { protect } = require('../middleware/authMiddleware');

// OTP routes
router.get('/otp/:walkRequestId', protect, getWalkOtp);
router.post('/verify-otp', protect, verifyWalkOtp);

// Session routes (IMPORTANT: specific route must come before generic route)
router.get('/session/by-request/:walkRequestId', protect, getSessionByRequest);  // NEW - must be first
router.get('/session/:sessionId', protect, getWalkSession);

// Session management
router.post('/start', protect, startWalkSession);
router.post('/update-location', protect, updateLocation);
router.post('/end', protect, endWalkSession);
router.get('/partner-location/:sessionId', protect, getPartnerLocation);
router.post('/sos-alert', protect, sendSOSAlert);

module.exports = router;
