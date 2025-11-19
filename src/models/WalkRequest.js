const mongoose = require('mongoose');

const walkRequestSchema = new mongoose.Schema({
  wandererId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  durationMinutes: {
    type: Number,
    required: true,
    min: 15,
    max: 240
  },
  pace: {
    type: String,
    enum: ['Slow', 'Moderate', 'Fast', 'Very Fast'],
    required: true
  },
  conversationLevel: {
    type: String,
    enum: ['Silent', 'Light', 'Moderate', 'Chatty'],
    required: true
  },
  languages: [{
    type: String
  }],
  specialRequirements: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['PENDING', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },
  walkerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  scheduledFor: {
    type: Date
  },
  matchedAt: {
    type: Date
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for geospatial queries
walkRequestSchema.index({ latitude: 1, longitude: 1 });
walkRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('WalkRequest', walkRequestSchema);
