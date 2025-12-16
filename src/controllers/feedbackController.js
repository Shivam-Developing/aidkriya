const WalkSession = require('../models/WalkSession');
const Feedback = require('../models/Feedback');
const { successResponse, errorResponse } = require('../utils/responseHelper');

exports.createFeedback = async (req, res) => {
  try {
    const { sessionId, rating, message } = req.body;
    const userId = req.user._id;

    if (!sessionId) {
      return errorResponse(res, 400, 'Session ID is required');
    }
    if (!rating || rating < 1 || rating > 5) {
      return errorResponse(res, 400, 'Rating must be between 1 and 5');
    }

    const session = await WalkSession.findById(sessionId);
    if (!session) {
      return errorResponse(res, 404, 'Session not found');
    }

    // Only participants may submit feedback and only after completion
    const isParticipant =
      session.walkerId.toString() === userId.toString() ||
      session.wandererId.toString() === userId.toString();
    if (!isParticipant) {
      return errorResponse(res, 403, 'Not authorized to submit feedback for this session');
    }

    if (session.status !== 'COMPLETED') {
      return errorResponse(res, 400, 'Feedback allowed only after session completion');
    }

    const isWalker = session.walkerId.toString() === userId.toString();
    const partnerId = isWalker ? session.wandererId : session.walkerId;

    // Prevent duplicates
    const existing = await Feedback.findOne({ sessionId, userId });
    if (existing) {
      return errorResponse(res, 400, 'Feedback already submitted');
    }

    const feedback = await Feedback.create({
      sessionId,
      userId,
      userRole: isWalker ? 'WALKER' : 'WANDERER',
      partnerId,
      rating: parseInt(rating, 10),
      message: message || null,
    });

    return successResponse(res, 201, 'Feedback submitted successfully', {
      id: feedback._id,
      session_id: feedback.sessionId,
      user_id: feedback.userId,
      user_role: feedback.userRole,
      partner_id: feedback.partnerId,
      rating: feedback.rating,
      message: feedback.message,
      created_at: feedback.createdAt,
    });
  } catch (error) {
    console.error('[Feedback] Error:', error);
    return errorResponse(res, 500, 'Error submitting feedback', error.message);
  }
};

