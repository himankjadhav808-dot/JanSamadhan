const mongoose = require('mongoose');
const { DEPARTMENTS, ISSUE_STATUSES } = require('../constants');

const geoPointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: [true, 'Coordinates [longitude, latitude] are required'],
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            value[0] >= -180 &&
            value[0] <= 180 &&
            value[1] >= -90 &&
            value[1] <= 90
          );
        },
        message: 'Coordinates must be [longitude, latitude] within valid ranges',
      },
    },
  },
  { _id: false }
);

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category / department is required'],
      enum: {
        values: DEPARTMENTS,
        message: 'Invalid category / department',
      },
    },
    originalImageUrl: {
      type: String,
      required: [true, 'Original issue photo is required'],
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ISSUE_STATUSES,
        message: 'Status must be Live, Pending_Validation, or Solved',
      },
      default: 'Live',
      index: true,
    },
    location: {
      type: geoPointSchema,
      required: [true, 'Issue location is required'],
    },
    locationAccuracyMeters: {
      type: Number,
      default: null,
      min: 0,
    },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    downvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // AI-generated English summary for Hindi/Hinglish submissions (may be null)
    englishSummary: {
      type: String,
      default: null,
    },

    // ── Research-grade governance fields ──────────────────────────────────
    priorityScore: {
      type: Number,
      default: 5.0,
      min: 1.0,
      max: 10.0,
    },
    severityLevel: {
      type: String,
      enum: { values: ['Low', 'Medium', 'High', 'Critical'], message: 'Invalid severity level' },
      default: 'Medium',
      index: true,
    },
    slaDeadline: {
      type: Date,
      default: null,
    },
    slaReason: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    isEscalated: {
      type: Boolean,
      default: false,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    parentIssueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      default: null,
    },
    evidenceGallery: [
      { type: String },
    ],
    clusterCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    aiSummary: {
      type: String,
      default: null,
    },
    urgencySentiment: {
      type: String,
      enum: { values: ['Calm', 'Frustrated', 'Urgent', 'Severe'], message: 'Invalid urgency sentiment' },
      default: null,
    },
    locationName: {
      type: String,
      default: null,
      trim: true,
    },
    comments: [
      {
        userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        citizenId:  { type: String, default: null, trim: true },
        userRole:   { type: String, default: 'citizen', trim: true },
        authorName: { type: String, default: 'Citizen', trim: true },
        text:       { type: String, required: true, trim: true, maxlength: 500 },
        createdAt:  { type: Date, default: Date.now },
        likes:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        replyTo:    { type: mongoose.Schema.Types.ObjectId, default: null }, // parent comment _id
      },
    ],

    // ── Immutable cryptographic audit chain ────────────────────────────────
    // Each block links to the previous via SHA-256 hashes, forming a tamper-
    // evident ledger of every lifecycle state change on this issue.
    auditLogs: [
      {
        action:       { type: String, required: true },          // e.g. 'ISSUE_CREATED'
        timestamp:    { type: Date,   required: true },
        actorId:      { type: String, required: true },          // stored as string (no ref — immutable)
        actorRole:    { type: String, required: true },
        previousHash: { type: String, required: true },
        currentHash:  { type: String, required: true },
        _id:          false,                                      // subdocs are immutable; no individual _id needed
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

issueSchema.virtual('netScore').get(function () {
  const up = Array.isArray(this.upvotes) ? this.upvotes.length : 0;
  const down = Array.isArray(this.downvotes) ? this.downvotes.length : 0;
  return up - down;
});

issueSchema.virtual('resolution', {
  ref: 'Resolution',
  localField: '_id',
  foreignField: 'issueId',
  justOne: true,
});

issueSchema.index({ location: '2dsphere' });
issueSchema.index({ category: 1, status: 1, createdAt: -1 });
issueSchema.index({ reporterId: 1, createdAt: -1 });

module.exports = mongoose.model('Issue', issueSchema);
