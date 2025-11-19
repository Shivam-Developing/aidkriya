const WalkRequest = require('../models/WalkRequest');
const Profile = require('../models/Profile');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { sendNotification, notificationTemplates } = require('../utils/notificationHelper');

// @desc    Find available walkers for a walk request
// @route   POST /api/matching/find-walkers
// @access  Private (Wanderer only)
exports.findWalkers = async (req, res) => {
  try {
    const { walk_request_id } = req.body;

    const walkRequest = await WalkRequest.findById(walk_request_id);

    if (!walkRequest) {
      return errorResponse(res, 404, 'Walk request not found');
    }

    // Get all available walkers
    const walkerProfiles = await Profile.find({
      isAvailable: true
    }).populate('userId', 'name phone email role');

    // Filter walkers by role
    const availableWalkers = walkerProfiles.filter(
      profile => profile.userId.role === 'WALKER'
    );

    if (availableWalkers.length === 0) {
      return errorResponse(res, 404, 'No walkers available at the moment');
    }

    // Calculate distance and create match objects
    const matches = availableWalkers.map(profile => {
      // For demo, using static location. In production, get walker's last known location
      const distance = Math.random() * 10; // Random distance for demo

      return {
        id: profile._id,
        walk_request_id,
        walker_id: profile.userId._id,
        walker_name: profile.userId.name,
        walker_image: profile.profileImage,
        walker_rating: profile.rating,
        total_walks: profile.totalWalks,
        distance: parseFloat(distance.toFixed(2)),
        status: 'PENDING'
      };
    }).sort((a, b) => a.distance - b.distance); // Sort by distance

    // Notify nearby walkers
    const notifyWalkers = matches.slice(0, 5); // Notify top 5 closest
    for (const match of notifyWalkers) {
      const notification = notificationTemplates.walkRequestReceived(req.user.name);
      await sendNotification(
        match.walker_id,
        notification.title,
        notification.message,
        { walkRequestId: walk_request_id },
        {
          type: notification.type,
          relatedId: walk_request_id,
          relatedModel: 'WalkRequest'
        }
      );
    }

    successResponse(res, 200, 'Available walkers found', matches);
  } catch (error) {
    console.error('Find walkers error:', error);
    errorResponse(res, 500, 'Error finding walkers', error.message);
  }
};

// @desc    Accept walk request (Walker)
// @route   POST /api/matching/accept
// @access  Private (Walker only)
exports.acceptWalkRequest = async (req, res) => {
  try {
    const { match_id } = req.body;
    const walkerId = req.user._id;

    // In production, match_id would be the walk_request_id
    const walkRequest = await WalkRequest.findById(match_id);

    if (!walkRequest) {
      return errorResponse(res, 404, 'Walk request not found');
    }

    if (walkRequest.status !== 'PENDING') {
      return errorResponse(res, 400, 'Walk request is no longer available');
    }

    // Update walk request
    walkRequest.walkerId = walkerId;
    walkRequest.status = 'MATCHED';
    walkRequest.matchedAt = new Date();
    await walkRequest.save();

    // Notify wanderer
    const notification = notificationTemplates.walkRequestAccepted(req.user.name);
    await sendNotification(
      walkRequest.wandererId,
      notification.title,
      notification.message,
      { walkRequestId: walkRequest._id, walkerId },
      { type: notification.type, relatedId: walkRequest._id, relatedModel: 'WalkRequest' }
    );

    // Return match object
    const match = {
      id: walkRequest._id,
      walk_request_id: walkRequest._id,
      walker_id: walkerId,
      wanderer_id: walkRequest.wandererId,
      status: 'ACCEPTED',
      matched_at: walkRequest.matchedAt
    };

    successResponse(res, 200, 'Walk request accepted successfully', match);
  } catch (error) {
    console.error('Accept walk request error:', error);
    errorResponse(res, 500, 'Error accepting walk request', error.message);
  }
};

// @desc    Reject walk request (Walker)
// @route   POST /api/matching/reject
// @access  Private (Walker only)
exports.rejectWalkRequest = async (req, res) => {
  try {
    const { match_id } = req.body;

    // In a real app, you'd track match rejections separately
    // For now, we just acknowledge the rejection

    successResponse(res, 200, 'Walk request rejected');
  } catch (error) {
    console.error('Reject walk request error:', error);
    errorResponse(res, 500, 'Error rejecting walk request', error.message);
  }
};

// @desc    Get pending walk requests for walker
// @route   GET /api/matching/pending-requests/:walkerId
// @access  Private (Walker only)
exports.getPendingRequests = async (req, res) => {
  try {
    const { walkerId } = req.params;

    // Get walker's profile to find nearby requests
    const walkerProfile = await Profile.findOne({ userId: walkerId });

    // Get pending walk requests
    const pendingRequests = await WalkRequest.find({
      status: 'PENDING',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
      .populate('wandererId', 'name phone')
      .limit(10)
      .sort({ createdAt: -1 });

    // Transform to match format
    const matches = await Promise.all(pendingRequests.map(async (request) => {
      const wandererProfile = await Profile.findOne({ userId: request.wandererId });

      return {
        id: request._id,
        walk_request_id: request._id,
        walker_id: walkerId,
        walker_name: wandererProfile?.name || request.wandererId.name,
        walker_image: wandererProfile?.profileImage || '',
        walker_rating: wandererProfile?.rating || 0,
        total_walks: wandererProfile?.totalWalks || 0,
        distance: Math.random() * 10, // Mock distance
        status: 'PENDING'
      };
    }));

    successResponse(res, 200, 'Pending requests retrieved', matches);
  } catch (error) {
    console.error('Get pending requests error:', error);
    errorResponse(res, 500, 'Error fetching pending requests', error.message);
  }
};
