/**
 * DepartmentStats
 *
 * Stores pre-aggregated SLA and performance metrics per department per month.
 * Updated by a background job or on-demand via the admin controller.
 */
const mongoose = require('mongoose');
const { DEPARTMENTS } = require('../constants');

const departmentStatsSchema = new mongoose.Schema(
  {
    department: {
      type: String,
      required: true,
      enum: { values: DEPARTMENTS, message: 'Invalid department' },
      index: true,
    },
    // YYYY-MM  e.g. "2026-01"
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'],
      index: true,
    },
    totalReports:      { type: Number, default: 0, min: 0 },
    resolvedCount:     { type: Number, default: 0, min: 0 },
    pendingCount:      { type: Number, default: 0, min: 0 },
    inProgressCount:   { type: Number, default: 0, min: 0 },
    escalatedCount:    { type: Number, default: 0, min: 0 },
    slaBreachedCount:  { type: Number, default: 0, min: 0 },
    // Average hours from report creation to resolution
    avgResolutionHours: { type: Number, default: null },
    // 0–100 score derived from resolution rate and SLA compliance
    slaScore:          { type: Number, default: null, min: 0, max: 100 },
    // Most common severity seen this month
    dominantSeverity:  {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: null,
    },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound unique index: one record per department per month
departmentStatsSchema.index({ department: 1, month: 1 }, { unique: true });

// Virtual: resolution rate as a percentage
departmentStatsSchema.virtual('resolutionRate').get(function () {
  if (!this.totalReports) return 0;
  return Math.round((this.resolvedCount / this.totalReports) * 100);
});

// Virtual: SLA compliance rate
departmentStatsSchema.virtual('slaComplianceRate').get(function () {
  if (!this.totalReports) return 100;
  return Math.round(((this.totalReports - this.slaBreachedCount) / this.totalReports) * 100);
});

module.exports = mongoose.model('DepartmentStats', departmentStatsSchema);
