const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { Issue } = require('../models');
const { Resolution } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

exports.getUserProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid user id');
  }

  const user = await User.findById(id).select('name publicId avatarUrl totalPoints role');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  let activityFeed = [];
  let issuesRaised = 0;
  let issuesResolved = 0;
  let problemsSolved = 0;
  let totalUpvotesReceived = 0;

  if (user.role === 'citizen') {
    const reportedIssues = await Issue.find({ reporterId: id })
      .select('_id originalImageUrl title description category status createdAt upvotes downvotes')
      .populate('resolution')
      .sort({ createdAt: -1 });

    activityFeed = reportedIssues.map(issue => issue.toObject());
    issuesRaised = reportedIssues.length;
    problemsSolved = reportedIssues.filter((issue) => issue.status === 'Solved').length;
    issuesResolved = 0;
    
    // Calculate total upvotes received across all issues
    totalUpvotesReceived = reportedIssues.reduce((sum, issue) => {
      return sum + (Array.isArray(issue.upvotes) ? issue.upvotes.length : 0);
    }, 0);
  } else if (user.role === 'sub-admin' || user.role === 'super-admin') {
    const resolutions = await Resolution.find({ authorityId: id })
      .populate({
        path: 'issueId',
        select: '_id originalImageUrl title description category status createdAt upvotes downvotes',
      })
      .sort({ createdAt: -1 });

    activityFeed = resolutions
      .filter((res) => res.issueId)
      .map((res) => ({
        ...res.issueId.toObject(),
        resolutionImageUrl: res.resolutionImageUrl,
        resolvedAt: res.createdAt,
      }));

    issuesResolved = resolutions.length;
    problemsSolved = resolutions.filter((res) => res.issueId?.status === 'Solved').length;
    issuesRaised = 0;
    
    // For authorities, calculate upvotes on issues they resolved
    totalUpvotesReceived = resolutions.reduce((sum, res) => {
      if (res.issueId && Array.isArray(res.issueId.upvotes)) {
        return sum + res.issueId.upvotes.length;
      }
      return sum;
    }, 0);
  }

  res.status(200).json({
    success: true,
    user: {
      ...user.toObject(),
      issuesRaised,
      issuesResolved,
      problemsSolved,
      totalUpvotesReceived,
    },
    activityFeed,
  });
});

// ---------------------------------------------------------------------------
// PUT /api/user/profile  — update name and/or avatarUrl
// ---------------------------------------------------------------------------
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, avatarUrl } = req.body;

  if (!name || name.trim().length < 2) {
    res.status(400);
    throw new Error('Name must be at least 2 characters');
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.name = name.trim();
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

  await user.save();

  const doc = user.toObject();
  delete doc.password;
  delete doc.resetPasswordToken;
  delete doc.resetPasswordExpires;
  delete doc.otpCode;
  delete doc.otpExpires;

  res.status(200).json({ success: true, user: doc });
});

// ---------------------------------------------------------------------------
// PUT /api/user/change-password  — verify current, hash and save new
// ---------------------------------------------------------------------------
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Current password and new password are required');
  }

  if (newPassword.length < 8) {
    res.status(400);
    throw new Error('New password must be at least 8 characters');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Google-only accounts have no password set
  if (!user.password) {
    res.status(400);
    throw new Error('This account uses Google sign-in and does not have a password to change.');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword; // pre-save hook will hash it
  await user.save();

  res.status(200).json({ success: true, message: 'Password updated successfully.' });
});

// ---------------------------------------------------------------------------
// DELETE /api/user/account  — permanently delete the authenticated user
// ---------------------------------------------------------------------------
exports.deleteAccount = asyncHandler(async (req, res) => {
  await User.findByIdAndDelete(req.user._id);
  res.status(200).json({ success: true, message: 'Account permanently deleted.' });
});
