const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Issue } = require('../models');
const { Resolution } = require('../models');
const { User } = require('../models');
const { Notification } = require('../models');
const { DEPARTMENTS } = require('../constants');
const asyncHandler = require('../utils/asyncHandler');
const { generateAuditEntry } = require('../utils/cryptoAudit');

// ---------------------------------------------------------------------------
// Gemini — generate an English summary when input contains non-ASCII text
// (Hindi / Devanagari / Hinglish).  Fails silently so it never blocks saves.
// ---------------------------------------------------------------------------
const DEVANAGARI_RE = /[\u0900-\u097F]/;

async function generateEnglishSummary(title, description) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  // Only call the API when there is actual Devanagari text
  const combined = `${title} ${description}`;
  if (!DEVANAGARI_RE.test(combined)) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt =
      'The following civic issue was submitted in Hindi or Hinglish. ' +
      'Provide a concise English summary (2–4 sentences) that an authority officer can act on. ' +
      'Return ONLY the summary, no preamble.\n\n' +
      `Title: ${title}\nDescription: ${description}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return text || `${title} — ${description}`;
  } catch (err) {
    // Detect rate-limit (HTTP 429) or quota errors specifically
    const isRateLimit =
      err.status === 429 ||
      /429|quota|rate.?limit|resource.?exhausted/i.test(err.message || '');

    if (isRateLimit) {
      console.warn('[Gemini] Rate limit reached — skipping translation, using original text.');
    } else {
      console.warn('[Gemini] Translation skipped (non-blocking):', err.message);
    }

    // Always fall back to the original user text so the issue still saves cleanly
    return `${title} — ${description}`;
  }
}

async function calculatePriorityScore(title, description, category) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fallback: default to 5.0 (Medium) if no API key
    return { priorityScore: 5.0, isCritical: false, summary: `${title} — ${description}` };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a civic issue triage AI. Analyze this issue and respond with ONLY a JSON object (no markdown, no extra text):

Title: ${title}
Description: ${description}
Category: ${category}

Return JSON with this exact structure:
{
  "priorityScore": <number 1.0-10.0>,
  "isCritical": <boolean true if priorityScore >= 8.0>,
  "summary": "<2-line English work order>"
}

Scoring guidelines:
- 8.0-10.0 (Critical): Immediate danger to life/health, infrastructure collapse, major safety hazard
- 6.0-7.9 (High): Significant quality of life impact, major service disruption
- 1.0-5.9 (Normal): Routine maintenance, minor inconvenience`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    
    const parsed = JSON.parse(cleanText);
    
    // Validate and clamp the score
    const score = Math.max(1.0, Math.min(10.0, Number(parsed.priorityScore) || 5.0));
    
    return {
      priorityScore: score,
      isCritical: score >= 8.0,
      summary: parsed.summary || `${title} — ${description}`,
    };
  } catch (err) {
    console.warn('[Gemini] Priority scoring failed, using defaults:', err.message);
    return { priorityScore: 5.0, isCritical: false, summary: `${title} — ${description}` };
  }
}

// ---------------------------------------------------------------------------
// Category-based SLA matrix — returns { deadline: Date, reason: string }
// Priority score bumps the tier up for Critical/High issues within a category.
// ---------------------------------------------------------------------------
const SLA_MATRIX = {
  Sanitation: {
    hours:  24,
    reason: 'Routine sanitation crew dispatch; no heavy materials or engineering tenders required.',
  },
  Traffic: {
    hours:  24,
    reason: 'High-priority public safety clearance and traffic signal restoration.',
  },
  Streetlights: {
    hours:  48,
    reason: 'Requires electrical maintenance van and standard spare parts replacement.',
  },
  Electricity: {
    hours:  48,
    reason: 'Requires electrical maintenance van and standard spare parts replacement.',
  },
  Water: {
    hours:  48,
    reason: 'Requires plumbing crew dispatch, valve isolation, and pipeline repair.',
  },
  Parks: {
    hours:  120,
    reason: 'Scheduled horticulture maintenance, tree trimming, and civic waste clearance.',
  },
  Roads: {
    hours:  168,
    reason: 'Pothole patching requires hot-mix/cold-mix asphalt plant scheduling and dry weather conditions.',
  },
};
const SLA_DEFAULT = {
  hours:  72,
  reason: 'Standard municipal inspection, crew assignment, and field resolution window.',
};

function calculateSLADeadline(priorityScore, category) {
  const base   = SLA_MATRIX[category] || SLA_DEFAULT;
  let   hours  = base.hours;

  // Critical issues (score ≥ 8) are always capped at 24 h regardless of category
  // High issues (score ≥ 6) get the lower of their category SLA or 48 h
  if (priorityScore >= 8.0) hours = Math.min(hours, 24);
  else if (priorityScore >= 6.0) hours = Math.min(hours, 48);

  const deadline = new Date(Date.now() + hours * 60 * 60 * 1000);
  return { deadline, reason: base.reason };
}

const DEFAULT_RADIUS_KM = 20;
const MAX_RADIUS_KM = 50;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Reporter anonymization
// Super-admins see real name + email. Everyone else sees "Citizen #JS-XXXX".
// ---------------------------------------------------------------------------
const REPORTER_PUBLIC_FIELDS  = 'publicId avatarUrl totalPoints role';
const REPORTER_PRIVATE_FIELDS = 'publicId name email avatarUrl totalPoints role';

function anonymizeReporter(reporter, viewerRole) {
  if (!reporter) return reporter;
  if (viewerRole === 'super-admin') return reporter; // full visibility

  const pub = reporter.toObject ? reporter.toObject() : { ...reporter };
  pub.name  = `Citizen #${pub.publicId || 'JS-0000'}`;
  delete pub.email;
  return pub;
}

// Aggregate $project that strips email and replaces name for non-super-admins.
// Used inside $lookup pipelines so the field never leaves the DB layer.
const reporterPublicProject = {
  $project: { publicId: 1, avatarUrl: 1, totalPoints: 1, role: 1 },
};

const parseCoordinate = (value, label) => {
  const num = Number(value);
  if (value === undefined || value === null || value === '' || Number.isNaN(num)) {
    return { error: `${label} is required and must be a number` };
  }
  return { value: num };
};

const toGeoPoint = (longitude, latitude) => ({
  type: 'Point',
  coordinates: [longitude, latitude],
});

const radiusToMeters = (radius, unit = 'km') => {
  const value = Number(radius);
  const normalizedUnit = String(unit || 'km').toLowerCase();

  if (Number.isNaN(value) || value <= 0) {
    return { error: 'radius must be a positive number' };
  }

  if (normalizedUnit === 'm' || normalizedUnit === 'meters' || normalizedUnit === 'metre' || normalizedUnit === 'metres') {
    return { meters: Math.min(value, MAX_RADIUS_KM * 1000) };
  }

  if (normalizedUnit === 'km' || normalizedUnit === 'kilometers' || normalizedUnit === 'kilometres') {
    return { meters: Math.min(value, MAX_RADIUS_KM) * 1000 };
  }

  return { error: 'unit must be km or m' };
};

exports.createIssue = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    category,
    originalImageUrl,
    longitude,
    latitude,
    locationAccuracyMeters,
  } = req.body;

  if (!title || !description || !category || !originalImageUrl) {
    res.status(400);
    throw new Error('Title, description, category, and originalImageUrl are required');
  }

  if (!DEPARTMENTS.includes(category)) {
    res.status(400);
    throw new Error(`Category must be one of: ${DEPARTMENTS.join(', ')}`);
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

  // ── MODULE 3: 50m Geospatial Duplicate Detection ─────────────────────────
  const nearbyIssues = await Issue.aggregate([
    {
      $geoNear: {
        near: toGeoPoint(lng.value, lat.value),
        distanceField: 'distanceMeters',
        maxDistance: 50, // 50 meters
        spherical: true,
        key: 'location',
        query: {
          category: category,
          status: { $ne: 'Solved' }, // Only merge into non-resolved issues
        },
      },
    },
    { $limit: 1 },
  ]);

  if (nearbyIssues.length > 0) {
    // Duplicate detected: merge into existing issue
    const parentIssue = await Issue.findById(nearbyIssues[0]._id);
    
    // Append new image to evidence gallery
    if (!parentIssue.evidenceGallery) parentIssue.evidenceGallery = [];
    parentIssue.evidenceGallery.push(originalImageUrl);
    
    // Increment cluster count
    parentIssue.clusterCount = (parentIssue.clusterCount || 1) + 1;
    
    // Mark this new issue as a duplicate
    const duplicateIssue = await Issue.create({
      title,
      description,
      category,
      originalImageUrl,
      reporterId: req.user._id,
      location: toGeoPoint(lng.value, lat.value),
      locationAccuracyMeters:
        locationAccuracyMeters === undefined || locationAccuracyMeters === null
          ? null
          : Number(locationAccuracyMeters),
      englishSummary: await generateEnglishSummary(title, description),
      isDuplicate: true,
      parentIssueId: parentIssue._id,
    });

    // Auto-upvote the parent issue (implicit support)
    if (!parentIssue.upvotes.includes(req.user._id)) {
      parentIssue.upvotes.push(req.user._id);
    }

    // Audit logs for both issues
    const genesisEntry = generateAuditEntry({
      action:       'ISSUE_CREATED',
      actorId:      req.user._id,
      actorRole:    req.user.role,
      previousHash: 'GENESIS',
    });
    duplicateIssue.auditLogs.push(genesisEntry);
    await duplicateIssue.save();

    const mergeEntry = generateAuditEntry({
      action:       'DUPLICATE_MERGED',
      actorId:      req.user._id,
      actorRole:    req.user.role,
      previousHash: parentIssue.auditLogs.length
        ? parentIssue.auditLogs[parentIssue.auditLogs.length - 1].currentHash
        : 'GENESIS',
    });
    parentIssue.auditLogs.push(mergeEntry);
    await parentIssue.save();

    await parentIssue.populate('reporterId', REPORTER_PRIVATE_FIELDS);
    const parentObj = parentIssue.toObject();
    parentObj.reporterId = anonymizeReporter(parentIssue.reporterId, req.user?.role);

    return res.status(200).json({
      success: true,
      merged: true,
      message: 'This report was merged into an existing nearby issue',
      issue: parentObj,
      mergedIssueId: duplicateIssue._id,
    });
  }

  // ── MODULE 2: AI Priority Scoring & SLA Calculation ───────────────────────
  const { priorityScore, isCritical, summary } = await calculatePriorityScore(title, description, category);
  const { deadline: slaDeadline, reason: slaReason } = calculateSLADeadline(priorityScore, category);

  const issue = await Issue.create({
    title,
    description,
    category,
    originalImageUrl,
    reporterId: req.user._id,
    location: toGeoPoint(lng.value, lat.value),
    locationAccuracyMeters:
      locationAccuracyMeters === undefined || locationAccuracyMeters === null
        ? null
        : Number(locationAccuracyMeters),
    englishSummary: await generateEnglishSummary(title, description),
    priorityScore,
    severityLevel: isCritical ? 'Critical' : priorityScore >= 6.0 ? 'High' : 'Medium',
    slaDeadline,
    slaReason,
    aiSummary: summary,
  });

  // ── Audit: GENESIS block ──────────────────────────────────────────────────
  const genesisEntry = generateAuditEntry({
    action:       'ISSUE_CREATED',
    actorId:      req.user._id,
    actorRole:    req.user.role,
    previousHash: 'GENESIS',
  });
  issue.auditLogs.push(genesisEntry);
  await issue.save();

  await issue.populate('reporterId', REPORTER_PRIVATE_FIELDS);

  // Anonymize for non-super-admins before responding
  const issueObj = issue.toObject();
  issueObj.reporterId = anonymizeReporter(issue.reporterId, req.user?.role);

  res.status(201).json({
    success: true,
    issue: issueObj,
  });
});

exports.getNearbyIssues = asyncHandler(async (req, res) => {
  const { lng, lat, radius = DEFAULT_RADIUS_KM, unit = 'km', sort = 'proximity', status, category, search } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const parsedLng = parseCoordinate(lng, 'lng');
  const parsedLat = parseCoordinate(lat, 'lat');

  if (parsedLng.error || parsedLat.error) {
    res.status(400);
    throw new Error(parsedLng.error || parsedLat.error);
  }

  const distance = radiusToMeters(radius, unit);
  if (distance.error) {
    res.status(400);
    throw new Error(distance.error);
  }

  const geoMatch = {};
  if (status) geoMatch.status = status;
  if (category) geoMatch.category = category;

  const sortByNetScore = String(sort).toLowerCase() === 'netscore';

  // Build a post-geo search $match when a search term is provided
  const searchStages = [];
  if (search && search.trim()) {
    // Escape special regex characters to prevent ReDoS
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escaped, 'i');
    searchStages.push({
      $match: {
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { locationName: searchRegex },
          { englishSummary: searchRegex },
        ],
      },
    });
  }

  const pipeline = [
    {
      $geoNear: {
        near: toGeoPoint(parsedLng.value, parsedLat.value),
        distanceField: 'distanceMeters',
        maxDistance: distance.meters,
        spherical: true,
        key: 'location',
        query: geoMatch,
      },
    },
    ...searchStages,
    {
      $addFields: {
        netScore: {
          $subtract: [{ $size: { $ifNull: ['$upvotes', []] } }, { $size: { $ifNull: ['$downvotes', []] } }],
        },
      },
    },
    {
      $sort: sortByNetScore
        ? { netScore: -1, distanceMeters: 1 }
        : { distanceMeters: 1, netScore: -1 },
    },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'reporterId',
        foreignField: '_id',
        pipeline: [{ $project: { publicId: 1, avatarUrl: 1, totalPoints: 1, role: 1 } }],
        as: 'reporterId',
      },
    },
    { $unwind: { path: '$reporterId', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'resolutions',
        localField: '_id',
        foreignField: 'issueId',
        as: 'resolution',
      },
    },
    { $unwind: { path: '$resolution', preserveNullAndEmptyArrays: true } },
  ];

  const rawIssues = await Issue.aggregate(pipeline);
  const viewerRole = req.user?.role;

  // Anonymize reporter: replace name with "Citizen #publicId" for non-super-admins
  const issues = rawIssues.map((issue) => {
    if (issue.reporterId && viewerRole !== 'super-admin') {
      issue.reporterId = {
        ...issue.reporterId,
        name: `Citizen #${issue.reporterId.publicId || 'JS-0000'}`,
      };
      delete issue.reporterId.email;
    }
    return issue;
  });

  res.status(200).json({
    success: true,
    count: issues.length,
    radiusMeters: distance.meters,
    sort: sortByNetScore ? 'netScore' : 'proximity',
    issues,
  });
});

exports.toggleVote = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    const userId = req.user._id.toString();
    const { voteType } = req.body; // 'upvote' or 'downvote'

    // Determine current state
    const hasUpvoted = issue.upvotes.some(id => id.toString() === userId);
    const hasDownvoted = issue.downvotes.some(id => id.toString() === userId);
    const currentVote = hasUpvoted ? 'upvote' : hasDownvoted ? 'downvote' : null;

    // 1. Wipe user from both arrays for a clean slate
    issue.upvotes = issue.upvotes.filter(id => id.toString() !== userId);
    issue.downvotes = issue.downvotes.filter(id => id.toString() !== userId);

    let finalUserVote = null;

    // 2. Apply the new vote if they are not just toggling it off
    if (voteType === 'upvote' && currentVote !== 'upvote') {
      issue.upvotes.push(userId);
      finalUserVote = 'upvote';
    } else if (voteType === 'downvote' && currentVote !== 'downvote') {
      issue.downvotes.push(userId);
      finalUserVote = 'downvote';
    }

    await issue.save();
    await issue.populate('reporterId', REPORTER_PRIVATE_FIELDS);

    const updatedNetScore = issue.upvotes.length - issue.downvotes.length;
    const issueObj = issue.toObject();
    issueObj.reporterId = anonymizeReporter(issue.reporterId, req.user?.role);

    res.json({ success: true, netScore: updatedNetScore, userVote: finalUserVote, issue: issueObj });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const netScoreExpression = {
  $subtract: [{ $size: { $ifNull: ['$upvotes', []] } }, { $size: { $ifNull: ['$downvotes', []] } }],
};

exports.getAssignedQueue = asyncHandler(async (req, res) => {
  const { status, sort = 'netScore', search } = req.query;
  const match = {};

  if (req.user.role === 'sub-admin') {
    if (!req.user.department) {
      res.status(400);
      throw new Error('Sub-admin accounts must have a department assigned');
    }
    match.category = req.user.department;
  } else if (req.query.category) {
    match.category = req.query.category;
  }

  if (status) match.status = status;

  // Hindi / English / Hinglish search across all text fields + AI summary
  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escaped, 'i');
    match.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { locationName: searchRegex },
      { englishSummary: searchRegex },
    ];
  }

  const sortStage = (() => {
    switch (String(sort)) {
      case 'netScore-asc':
        return { netScore: 1, createdAt: -1 };
      case 'oldest':
        return { createdAt: 1 };
      case 'newest':
        return { createdAt: -1 };
      case 'netScore':
      case 'netScore-desc':
      default:
        return { netScore: -1, createdAt: -1 };
    }
  })();

  const issues = await Issue.aggregate([
    { $match: match },
    { $addFields: { netScore: netScoreExpression } },
    { $sort: sortStage },
    {
      $lookup: {
        from: 'users',
        localField: 'reporterId',
        foreignField: '_id',
        pipeline: [{ $project: { publicId: 1, name: 1, avatarUrl: 1, role: 1 } }],
        as: 'reporterId',
      },
    },
    { $unwind: { path: '$reporterId', preserveNullAndEmptyArrays: true } },
  ]);

  res.status(200).json({
    success: true,
    count: issues.length,
    department: req.user.role === 'sub-admin' ? req.user.department : req.query.category || 'All',
    sort: String(sort),
    issues,
  });
});

exports.getIssueById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid issue id');
  }

  const issue = await Issue.findById(id)
    .populate('reporterId', REPORTER_PRIVATE_FIELDS)
    .populate({
      path: 'resolution',
      populate: { path: 'authorityId', select: 'publicId name department role' },
    })
    .populate({
      path: 'comments.userId',
      select: 'publicId name role',
    });

  if (!issue) {
    res.status(404);
    throw new Error('Issue not found');
  }

  const issueObj = issue.toObject();
  issueObj.reporterId = anonymizeReporter(issue.reporterId, req.user?.role);

  res.status(200).json({
    success: true,
    issue: issueObj,
  });
});

exports.validateResolution = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid issue id');
  }

  if (!['approved', 'rejected'].includes(status)) {
    res.status(400);
    throw new Error("Status must be 'approved' or 'rejected'");
  }

  const issue = await Issue.findById(id).populate('resolution');

  if (!issue) {
    res.status(404);
    throw new Error('Issue not found');
  }

  if (issue.status !== 'Pending_Validation') {
    res.status(400);
    throw new Error('Issue must be in Pending_Validation status to validate');
  }

  if (!issue.resolution) {
    res.status(400);
    throw new Error('Issue has no resolution to validate');
  }

  // Helper — fire-and-forget notification; never blocks the response
  const notify = (userId, type, text) =>
    Notification.create({ userId, type, text, issueId: issue._id }).catch((err) =>
      console.error('[notify] Failed to create notification:', err.message)
    );

  if (status === 'approved') {
    // ── Audit: RESOLUTION_APPROVED ────────────────────────────────────────
    const lastHash = issue.auditLogs.length
      ? issue.auditLogs[issue.auditLogs.length - 1].currentHash
      : 'GENESIS';
    issue.auditLogs.push(generateAuditEntry({
      action:       'RESOLUTION_APPROVED',
      actorId:      req.user._id,
      actorRole:    req.user.role,
      previousHash: lastHash,
    }));

    issue.status     = 'Solved';
    issue.resolvedAt = new Date();
    await issue.save();

    const CITIZEN_POINTS = 10;
    const AUTHORITY_POINTS = 20;

    await Promise.all([
      User.findByIdAndUpdate(issue.reporterId, { $inc: { totalPoints: CITIZEN_POINTS } }),
      User.findByIdAndUpdate(issue.resolution.authorityId, { $inc: { totalPoints: AUTHORITY_POINTS } }),
    ]);

    // ── Automated notifications ───────────────────────────────────────────
    // Reporter: their issue has been resolved
    notify(
      issue.reporterId,
      'resolved',
      `🎉 Your reported issue "${issue.title}" has been resolved and verified! You've earned ${CITIZEN_POINTS} points.`
    );
    // Authority: their fix was accepted
    notify(
      issue.resolution.authorityId,
      'resolved',
      `✅ Your resolution for "${issue.title}" was approved by the community. You've earned ${AUTHORITY_POINTS} points!`
    );

    await issue.populate('reporterId', REPORTER_PRIVATE_FIELDS);
    await issue.populate({
      path: 'resolution',
      populate: { path: 'authorityId', select: 'publicId name department role' },
    });

    const approvedIssue = issue.toObject();
    approvedIssue.reporterId = anonymizeReporter(issue.reporterId, req.user?.role);

    res.status(200).json({
      success: true,
      message: 'Resolution approved and points awarded',
      issue: approvedIssue,
    });
  } else if (status === 'rejected') {
    const authorityId = issue.resolution.authorityId;

    // ── Audit: RESOLUTION_REJECTED ────────────────────────────────────────
    const lastHash = issue.auditLogs.length
      ? issue.auditLogs[issue.auditLogs.length - 1].currentHash
      : 'GENESIS';
    issue.auditLogs.push(generateAuditEntry({
      action:       'RESOLUTION_REJECTED',
      actorId:      req.user._id,
      actorRole:    req.user.role,
      previousHash: lastHash,
    }));

    issue.status = 'Live';
    await issue.save();

    await Resolution.findByIdAndDelete(issue.resolution._id);

    // ── Automated notifications ───────────────────────────────────────────
    // Reporter: fix was rejected, issue is back open
    notify(
      issue.reporterId,
      'system',
      `⚠️ The proposed fix for your issue "${issue.title}" was rejected. The issue is back Live — authorities will retry.`
    );
    // Authority: their submission was rejected
    notify(
      authorityId,
      'system',
      `❌ Your resolution for "${issue.title}" was rejected by the community. Please re-assess and resubmit.`
    );

    await issue.populate('reporterId', REPORTER_PRIVATE_FIELDS);

    const rejectedIssue = issue.toObject();
    rejectedIssue.reporterId = anonymizeReporter(issue.reporterId, req.user?.role);

    res.status(200).json({
      success: true,
      message: 'Resolution rejected and issue reverted to Live',
      issue: rejectedIssue,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/issues/:id/comments  — add a comment to an issue
// ---------------------------------------------------------------------------
exports.addComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid issue id');
  }

  if (!text || !text.trim()) {
    res.status(400);
    throw new Error('Comment text is required');
  }

  if (text.trim().length > 500) {
    res.status(400);
    throw new Error('Comment cannot exceed 500 characters');
  }

  const issue = await Issue.findById(id);
  if (!issue) {
    res.status(404);
    throw new Error('Issue not found');
  }

  const newComment = {
    userId:     req.user._id,
    citizenId:  req.user.publicId || `JS-${req.user._id.toString().slice(-4).toUpperCase()}`,
    userRole:   req.user.role || 'citizen',
    authorName: req.user.name || `Citizen #${req.user.publicId || 'JS-0000'}`,
    text:       text.trim(),
    createdAt:  new Date(),
  };

  issue.comments.push(newComment);
  await issue.save();

  // Return the last entry (the one we just pushed) as the canonical comment
  const savedComment = issue.comments[issue.comments.length - 1];

  res.status(201).json({
    success: true,
    comment: savedComment,
    commentCount: issue.comments.length,
  });
});

// ---------------------------------------------------------------------------
// GET /api/issues/search?query=...
// Searches by Issue _id, title, description, category, or reporter publicId.
// Always anonymizes reporter data (same rules as other public endpoints).
// ---------------------------------------------------------------------------
exports.searchIssues = asyncHandler(async (req, res) => {
  const raw = (req.query.query || '').trim().replace(/^#/, ''); // strip leading '#'

  if (!raw) {
    return res.status(200).json({ success: true, count: 0, issues: [] });
  }

  // Escape special regex chars to prevent ReDoS
  const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(escaped, 'i');

  // Use aggregate so we can:
  // 1. Convert _id to a string for substring matching
  // 2. Filter on the joined reporter.publicId
  const issues = await Issue.aggregate([
    // Convert _id to string so partial hex queries (e.g. "adb2fd6d") work
    {
      $addFields: {
        _idStr: { $toLower: { $toString: '$_id' } },
        netScore: {
          $subtract: [
            { $size: { $ifNull: ['$upvotes', []] } },
            { $size: { $ifNull: ['$downvotes', []] } },
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'reporterId',
        foreignField: '_id',
        pipeline: [{ $project: { publicId: 1, avatarUrl: 1, totalPoints: 1, role: 1 } }],
        as: 'reporterId',
      },
    },
    { $unwind: { path: '$reporterId', preserveNullAndEmptyArrays: true } },
    {
      $match: {
        $or: [
          { _idStr: { $regex: escaped, $options: 'i' } }, // partial _id substring
          { title: rx },
          { description: rx },
          { category: rx },
          { englishSummary: rx },
          { 'reporterId.publicId': rx },                  // e.g. "JS-1234"
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: 50 },
    // Remove the helper field before sending
    { $unset: '_idStr' },
    {
      $lookup: {
        from: 'resolutions',
        localField: '_id',
        foreignField: 'issueId',
        as: 'resolution',
      },
    },
    { $unwind: { path: '$resolution', preserveNullAndEmptyArrays: true } },
  ]);

  // Anonymize reporter for non-super-admins
  const viewerRole = req.user?.role;
  const result = issues.map((issue) => {
    if (issue.reporterId && viewerRole !== 'super-admin') {
      issue.reporterId = {
        ...issue.reporterId,
        name: `Citizen #${issue.reporterId.publicId || 'JS-0000'}`,
      };
      delete issue.reporterId.email;
    }
    return issue;
  });

  res.status(200).json({ success: true, count: result.length, issues: result });
});

function normalizeRole(role) {
  const compact = String(role || '')
    .toLowerCase()
    .replace(/[\s_-]/g, '');

  if (compact === 'subadmin') return 'sub-admin';
  if (compact === 'superadmin' || compact === 'admin') return 'super-admin';
  return 'citizen';
}

function applyStatusFilter(query, status) {
  if (!status || status === 'All') return query;

  if (status === 'Live' || status === 'Pending' || status === 'Reported') {
    query.status = { $in: ['Live', 'Escalated'] };
  } else if (status === 'In Progress' || status === 'Pending_Validation') {
    query.status = 'Pending_Validation';
  } else if (status === 'Solved' || status === 'Resolved') {
    query.status = 'Solved';
  } else {
    query.status = status;
  }

  return query;
}

// ---------------------------------------------------------------------------
// GET /api/issues/my-issues
// Citizens → own reports (reporterId)
// Sub-admins → department queue (category === user.department)
// Super-admins → all municipal issues
// ---------------------------------------------------------------------------
exports.getMyIssues = asyncHandler(async (req, res) => {
  const user = req.user;
  const role = normalizeRole(user.role);
  const { status } = req.query;

  let query = {};
  let scope = 'own';

  if (role === 'sub-admin') {
    if (!user.department) {
      res.status(400);
      throw new Error('Sub-admin accounts must have a department assigned');
    }
    query.category = user.department;
    scope = 'department';
  } else if (role === 'super-admin') {
    query = {};
    scope = 'all';
  } else {
    query.reporterId = user._id;
    scope = 'own';
  }

  applyStatusFilter(query, status);

  const issues = await Issue.find(query)
    .populate('reporterId', 'name publicId avatarUrl role')
    .populate({
      path: 'resolution',
      populate: { path: 'authorityId', select: 'name department role' },
    })
    .sort({ createdAt: -1 })
    .lean();

  const result = issues.map((issue) => ({
    ...issue,
    netScore: (issue.upvotes?.length || 0) - (issue.downvotes?.length || 0),
  }));

  res.status(200).json({
    success: true,
    count: result.length,
    scope,
    department: role === 'sub-admin' ? user.department : null,
    issues: result,
  });
});

exports.getReportsForCurrentUser = exports.getMyIssues;
exports.getUserOrDepartmentReports = exports.getMyIssues;

// ---------------------------------------------------------------------------
// DELETE /api/issues/:issueId/comments/:commentId  — delete a comment
// Author or any admin/sub-admin may delete.
// ---------------------------------------------------------------------------
exports.deleteComment = asyncHandler(async (req, res) => {
  const { issueId, commentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(issueId) || !mongoose.Types.ObjectId.isValid(commentId)) {
    res.status(400);
    throw new Error('Invalid issue or comment id');
  }

  const issue = await Issue.findById(issueId);
  if (!issue) {
    res.status(404);
    throw new Error('Issue not found');
  }

  const comment = issue.comments.id(commentId);
  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  const isAuthor = comment.userId?.toString() === req.user._id.toString();
  const role     = (req.user.role || '').toLowerCase();
  const isAdmin  = role.includes('admin');

  if (!isAuthor && !isAdmin) {
    res.status(403);
    throw new Error('Not authorised to delete this comment');
  }

  issue.comments.pull(commentId);
  await issue.save();

  res.status(200).json({
    success: true,
    message: 'Comment deleted',
    commentCount: issue.comments.length,
  });
});

// ---------------------------------------------------------------------------
// POST /api/issues/:issueId/comments/:commentId/like  — toggle comment like
// ---------------------------------------------------------------------------
exports.toggleCommentLike = asyncHandler(async (req, res) => {
  const { issueId, commentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(issueId) || !mongoose.Types.ObjectId.isValid(commentId)) {
    res.status(400);
    throw new Error('Invalid issue or comment id');
  }

  const issue = await Issue.findById(issueId);
  if (!issue) {
    res.status(404);
    throw new Error('Issue not found');
  }

  const comment = issue.comments.id(commentId);
  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  const userId     = req.user._id.toString();
  const likeIndex  = (comment.likes || []).findIndex((id) => id.toString() === userId);

  if (likeIndex === -1) {
    comment.likes.push(req.user._id);
  } else {
    comment.likes.splice(likeIndex, 1);
  }

  await issue.save();

  res.status(200).json({
    success: true,
    liked: likeIndex === -1,          // true = just liked, false = just unliked
    likeCount: comment.likes.length,
    commentId,
  });
});

// ---------------------------------------------------------------------------
// GET /api/issues/:id/audit  — return the hash-chain audit log + integrity verdict
// Public endpoint; no auth required (audit ledger is read-only).
// ---------------------------------------------------------------------------
exports.getIssueAudit = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid issue id');
  }

  // Fetch only the fields we need — keep response lean
  const issue = await Issue.findById(id).select('_id title status auditLogs').lean();

  if (!issue) {
    res.status(404);
    throw new Error('Issue not found');
  }

  const { verifyAuditChain } = require('../utils/cryptoAudit');
  const integrity = verifyAuditChain(issue.auditLogs || []);

  res.status(200).json({
    success:    true,
    issueId:    issue._id,
    title:      issue.title,
    status:     issue.status,
    integrity,                  // { valid, brokenAt, reason }
    auditLogs:  issue.auditLogs || [],
    blockCount: (issue.auditLogs || []).length,
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/issues/wipe  — super-admin only
// Wipes all Issue documents from MongoDB and deletes all uploaded media files.
// ---------------------------------------------------------------------------
exports.wipeAllIssues = asyncHandler(async (req, res) => {
  // 1. Delete all issue records from MongoDB
  const deleteResult = await Issue.deleteMany({});

  // 2. Clear all uploaded media files from local storage
  const uploadsDir = path.join(process.cwd(), 'uploads');

  let filesDeleted = 0;
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      // Preserve hidden/system files (e.g. .gitkeep)
      if (!file.startsWith('.')) {
        fs.unlinkSync(path.join(uploadsDir, file));
        filesDeleted++;
      }
    }
  }

  res.status(200).json({
    success: true,
    message: `Successfully deleted ${deleteResult.deletedCount} issue records and cleared ${filesDeleted} uploaded media file(s).`,
  });
});
