const mongoose = require('mongoose');

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

const resolutionSchema = new mongoose.Schema(
  {
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: [true, 'Issue reference is required'],
      unique: true,
    },
    authorityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Authority (sub-admin) reference is required'],
      index: true,
    },
    resolutionImageUrl: {
      type: String,
      required: [true, 'Resolution photo is required'],
    },
    resolutionLocation: {
      type: geoPointSchema,
      required: [true, 'Resolution GPS location is required'],
    },
    locationAccuracyMeters: {
      type: Number,
      default: null,
      min: 0,
    },
    distanceFromIssueMeters: {
      type: Number,
      default: null,
      min: 0,
    },
    // Vision-AI verification results
    visionVerified: {
      type: Boolean,
      default: null,
    },
    visionConfidence: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    visionReason: {
      type: String,
      default: null,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Remarks cannot exceed 1000 characters'],
    },
    approvalVotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

resolutionSchema.virtual('approvalCount').get(function () {
  return Array.isArray(this.approvalVotes) ? this.approvalVotes.length : 0;
});

resolutionSchema.index({ resolutionLocation: '2dsphere' });
resolutionSchema.index({ authorityId: 1, createdAt: -1 });

module.exports = mongoose.model('Resolution', resolutionSchema);
