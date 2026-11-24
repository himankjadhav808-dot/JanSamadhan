const { Notification } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/notifications/unread-count  — lightweight count for badge
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ userId: req.user._id, isRead: false });
  res.status(200).json({ success: true, count });
});

// GET /api/notifications  — fetch the authenticated user's notifications
exports.getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  res.status(200).json({ success: true, notifications, unreadCount });
});

// PATCH /api/notifications/:id/read  — mark a single notification as read
exports.markOneRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  notification.isRead = true;
  await notification.save();

  res.status(200).json({ success: true, notification });
});

// PATCH /api/notifications/mark-all-read  — mark every notification as read
exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );

  res.status(200).json({ success: true, message: 'All notifications marked as read.' });
});
