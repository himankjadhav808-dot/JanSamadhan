const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Issue, Resolution, Notification } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const {
  MAX_RESOLVE_DISTANCE_METERS,
  parseCoordinate,
  toGeoPoint,
  haversineMeters,
} = require('../utils/geo');
const { generateAuditEntry } = require('../utils/cryptoAudit');

async function verifyFixWithVision(beforeImageUrl, afterImageUrl) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Vision] No GEMINI_API_KEY configured, skipping vision verification');
    return { verified: true, confidence: 0.5, reason: 'API key not configured' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a civic works verification AI. Compare these two images:
    
Image 1 (Before): ${beforeImageUrl}
Image 2 (After/Fix): ${afterImageUrl}

Determine if the second image shows the issue from the first image has been fixed/resolved.
Consider:
- Same location/landmarks visible
- Problem condition improved or resolved
- Reasonable evidence of repair work

Respond with ONLY a JSON object (no markdown):
{
  "verified": <boolean>,
  "confidence": <number 0.0-1.0>,
  "reason": "<brief explanation>"
}`;

    const result = await model.generateContent([prompt]);
    const text = result.response.text().trim();
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    return {
      verified: Boolean(parsed.verified),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      reason: parsed.reason || 'No reason provided',
    };
  } catch (err) {
    console.warn('[Vision] Image verification failed:', err.message);
    // Fail open: if vision fails, still allow submission
    return { verified: true, confidence: 0.3, reason: 'Vision API error, allowing submission' };
  }
}

exports.resolveIssue = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolutionImageUrl, longitude, latitude, locationAccuracyMeters, remarks } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid issue id');
  }

  if (!resolutionImageUrl) {
    res.status(400);
    throw new Error('resolutionImageUrl is required');
  }

  const lng = parseCoordinate(longitude, 'longitude');
  const lat = parseCoordinate(latitude, 'latitude');
  if (lng.error || lat.error) {
    res.status(400);
    throw new Error(lng.error || lat.error);
  }

  if (lng.value < -180 || lng.value > 180 || lat.value < -90 || lat.value > 90) {
    res.status(400);
    throw new Error('Coordinates must be valid longitude (-180 to 180) and latitude (-90 to 90)');
  }

  const issue = await Issue.findById(id);
  if (!issue) {
    res.status(404);
    throw new Error('Issue not found');
  }

  if (issue.status !== 'Live') {
    res.status(400);
    throw new Error(`Only Live issues can be resolved. Current status: ${issue.status}`);
  }

  if (req.user.role === 'sub-admin' && req.user.department !== issue.category) {
    res.status(403);
    throw new Error(
      `This issue belongs to ${issue.category}. Your department is ${req.user.department || 'unassigned'}.`
    );
  }

  const [issueLng, issueLat] = issue.location.coordinates;
  const distanceFromIssueMeters = Math.round(
    haversineMeters(issueLng, issueLat, lng.value, lat.value)
  );

  if (distanceFromIssueMeters > MAX_RESOLVE_DISTANCE_METERS) {
    res.status(400);
    throw new Error(
      `You must be on-site to resolve this issue. You are ${distanceFromIssueMeters} meters away (limit: ${MAX_RESOLVE_DISTANCE_METERS}m). Device location must match the original issue coordinates.`
    );
  }

  const existing = await Resolution.findOne({ issueId: issue._id });
  if (existing) {
    res.status(409);
    throw new Error('A resolution has already been submitted for this issue');
  }

  // ── MODULE 5: Vision-AI Verification ───────────────────────────────────────
  const visionResult = await verifyFixWithVision(issue.originalImageUrl, resolutionImageUrl);

  const resolution = await Resolution.create({
    issueId: issue._id,
    authorityId: req.user._id,
    resolutionImageUrl,
    resolutionLocation: toGeoPoint(lng.value, lat.value),
    locationAccuracyMeters:
      locationAccuracyMeters === undefined || locationAccuracyMeters === null
        ? null
        : Number(locationAccuracyMeters),
    distanceFromIssueMeters,
    visionVerified: visionResult.verified,
    visionConfidence: visionResult.confidence,
    visionReason: visionResult.reason,
    remarks: typeof remarks === 'string' ? remarks.trim() : '',
  });

  // ── Audit: RESOLUTION_SUBMITTED ────────────────────────────────────────
  const lastHash = issue.auditLogs && issue.auditLogs.length
    ? issue.auditLogs[issue.auditLogs.length - 1].currentHash
    : 'GENESIS';
  issue.auditLogs.push(generateAuditEntry({
    action:       'RESOLUTION_SUBMITTED',
    actorId:      req.user._id,
    actorRole:    req.user.role,
    previousHash: lastHash,
  }));

  issue.status = 'Pending_Validation';
  await issue.save();

  // ── Notification: Fix Submitted for Citizen Review ───────────────────────
  await Notification.create({
    userId: issue.reporterId,
    type: 'fix_submitted',
    text: `🛠️ Fix Submitted for Review! The ${issue.category} department has submitted a proposed fix for your report "${issue.title}". Please review and validate the repair.`,
    issueId: issue._id,
    isRead: false,
  }).catch((err) => console.error('[Notification] Failed to create fix submission notification:', err.message));

  await resolution.populate('authorityId', 'name department role');

  res.status(201).json({
    success: true,
    message: 'Resolution submitted. The issue is now pending community validation.',
    distanceFromIssueMeters,
    resolution,
    issue,
  });
});
