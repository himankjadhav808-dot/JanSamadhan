const express = require('express');
const {
  getUserProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/:id/profile', getUserProfile);

// Authenticated user self-service routes
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.delete('/account', protect, deleteAccount);

module.exports = router;
