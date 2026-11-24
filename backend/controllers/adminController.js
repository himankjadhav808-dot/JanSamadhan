const mongoose = require('mongoose');
const { Issue } = require('../models');
const { Resolution } = require('../models');
const { User } = require('../models');
const { DEPARTMENTS } = require('../constants');
const asyncHandler = require('../utils/asyncHandler');

exports.getAdminStats = asyncHandler(async (req, res) => {
  const globalKPIs = await Issue.aggregate([
    {
      $facet: {
        totalIssues: [{ $count: 'count' }],
        activeIssues: [
          { $match: { status: { $in: ['Live', 'Pending_Validation'] } } },
          { $count: 'count' },
        ],
        resolvedIssues: [{ $match: { status: 'Solved' } }, { $count: 'count' }],
      },
    },
    {
      $project: {
        totalIssues: { $arrayElemAt: ['$totalIssues.count', 0] },
        activeIssues: { $arrayElemAt: ['$activeIssues.count', 0] },
        resolvedIssues: { $arrayElemAt: ['$resolvedIssues.count', 0] },
      },
    },
  ]);

  const resolutionTimeStats = await Issue.aggregate([
    // Only count issues that are fully resolved
    { $match: { status: 'Solved' } },
    {
      $project: {
        resolutionTimeHours: {
          $divide: [
            { $subtract: ['$updatedAt', '$createdAt'] },
            1000 * 60 * 60,
          ],
        },
      },
    },
    // Guard against data anomalies (negative or zero values)
    { $match: { resolutionTimeHours: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        avgResolutionTimeHours: { $avg: '$resolutionTimeHours' },
      },
    },
  ]);

  const categoryBreakdown = await Issue.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const departmentPerformance = await Issue.aggregate([
    {
      $group: {
        _id: '$category',
        totalIssues: { $sum: 1 },
        solvedIssues: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Solved'] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        category: '$_id',
        totalIssues: 1,
        solvedIssues: 1,
        resolutionRate: {
          $multiply: [
            {
              $divide: ['$solvedIssues', '$totalIssues'],
            },
            100,
          ],
        },
      },
    },
    { $sort: { totalIssues: -1 } },
  ]);

  const heatmapData = await Issue.aggregate([
    {
      $project: {
        coordinates: '$location.coordinates',
        status: 1,
      },
    },
  ]);

  const stats = {
    globalKPIs: {
      totalIssues: globalKPIs[0]?.totalIssues || 0,
      activeIssues: globalKPIs[0]?.activeIssues || 0,
      resolvedIssues: globalKPIs[0]?.resolvedIssues || 0,
      avgResolutionTimeHours: resolutionTimeStats[0]?.avgResolutionTimeHours || 0,
    },
    categoryBreakdown,
    departmentPerformance,
    heatmapData,
  };

  res.status(200).json({
    success: true,
    stats,
  });
});

exports.createSubAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, department } = req.body;

  if (!name || !email || !password || !department) {
    res.status(400);
    throw new Error('Name, email, password, and department are required');
  }

  if (!DEPARTMENTS.includes(department)) {
    res.status(400);
    throw new Error(`Department must be one of: ${DEPARTMENTS.join(', ')}`);
  }

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    res.status(400);
    throw new Error('User with this email already exists');
  }

  const subAdmin = await User.create({
    name,
    email: email.toLowerCase().trim(),
    password,
    role: 'sub-admin',
    department,
  });

  subAdmin.password = undefined;

  res.status(201).json({
    success: true,
    message: 'Sub-admin created successfully',
    subAdmin,
  });
});

exports.getSubAdmins = asyncHandler(async (req, res) => {
  const subAdmins = await User.find({ role: 'sub-admin' })
    .select('_id name email department totalPoints createdAt')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    subAdmins,
    count: subAdmins.length,
  });
});

exports.updateSubAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid sub-admin ID');
  }

  const user = await User.findById(id);

  if (!user) {
    res.status(404);
    throw new Error('Sub-Admin not found');
  }

  if (user.role !== 'sub-admin') {
    res.status(403);
    throw new Error('User is not a sub-admin');
  }

  // Update only name and email
  if (name) {
    if (name.trim().length < 2) {
      res.status(400);
      throw new Error('Name must be at least 2 characters');
    }
    user.name = name.trim();
  }

  if (email) {
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      res.status(400);
      throw new Error('Please provide a valid email address');
    }
    
    // Check if email is already taken by another user
    const existingUser = await User.findOne({ 
      email: email.toLowerCase().trim(),
      _id: { $ne: id }
    });
    
    if (existingUser) {
      res.status(400);
      throw new Error('Email is already in use by another user');
    }
    
    user.email = email.toLowerCase().trim();
  }

  await user.save();

  // Return updated user without sensitive fields
  const updatedUser = user.toObject();
  delete updatedUser.password;
  delete updatedUser.resetPasswordToken;
  delete updatedUser.resetPasswordExpires;
  delete updatedUser.otpCode;
  delete updatedUser.otpExpires;

  res.status(200).json({
    success: true,
    message: 'Sub-Admin details updated successfully',
    user: updatedUser,
  });
});

exports.getAllIssues = asyncHandler(async (req, res) => {
  const issues = await Issue.find()
    .populate('reporterId', 'name avatarUrl totalPoints role')
    .populate('resolution')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    issues,
    count: issues.length,
  });
});
