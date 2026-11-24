const express = require('express');
const {
  getNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/unread-count',    protect, getUnreadCount);   // ← before /:id
router.get('/',                protect, getNotifications);
router.patch('/mark-all-read', protect, markAllRead);
router.patch('/:id/read',      protect, markOneRead);

module.exports = router;
