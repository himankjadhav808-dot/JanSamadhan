const express = require('express');
const {
  register,
  login,
  getMe,
  googleLogin,
  forgotPassword,
  resetPassword,
  forgotPasswordOtp,
  resetPasswordOtp,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/google', googleLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/forgot-password-otp', forgotPasswordOtp);
router.post('/reset-password-otp', resetPasswordOtp);

module.exports = router;
