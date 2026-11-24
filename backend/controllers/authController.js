const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { User } = require('../models');
const { USER_ROLES, DEPARTMENTS } = require('../constants');
const generateToken = require('../utils/generateToken');
const asyncHandler = require('../utils/asyncHandler');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const sanitizeUser = (user) => {
  const doc = user.toObject ? user.toObject() : user;
  delete doc.password;
  return doc;
};

const authResponse = (user) => ({
  success: true,
  token: generateToken(user),
  user: sanitizeUser(user),
});

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'citizen', department } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are required');
  }

  if (role && !USER_ROLES.includes(role)) {
    res.status(400);
    throw new Error('Role must be citizen, sub-admin, or super-admin');
  }

  if (role === 'sub-admin' || role === 'super-admin') {
    res.status(403);
    throw new Error('Authorities cannot self-register. Please contact the Super Admin for access.');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'citizen',
  });

  res.status(201).json(authResponse(user));
});

exports.login = asyncHandler(async (req, res) => {
  // Accept either 'email' (legacy) or 'identifier' (email or publicId)
  const identifier = (req.body.identifier || req.body.email || '').trim();
  const { password } = req.body;

  if (!identifier || !password) {
    res.status(400);
    throw new Error('Email (or Public ID) and password are required');
  }

  // Match on email OR publicId so users can log in with either
  const user = await User.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { publicId: identifier.toUpperCase() },
    ],
  }).select('+password');

  // Generic error message to prevent account enumeration
  // This prevents attackers from knowing if an email exists or if the password is wrong
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  user.password = undefined;
  res.status(200).json(authResponse(user));
});

exports.getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: sanitizeUser(req.user),
  });
});

exports.googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    res.status(400);
    throw new Error('Google credential is required');
  }

  // Verify the ID token issued by Google
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    res.status(401);
    throw new Error('Invalid Google credential');
  }

  const { sub: googleId, email, name, picture } = payload;

  if (!email) {
    res.status(400);
    throw new Error('Google account did not return an email address');
  }

  // Find existing user or create one (citizens only via Google OAuth)
  let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase().trim() }] });

  if (user) {
    // Attach googleId if the account was created via email/password previously
    if (!user.googleId) {
      user.googleId = googleId;
      if (picture && !user.avatarUrl) user.avatarUrl = picture;
      await user.save();
    }
  } else {
    user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      googleId,
      avatarUrl: picture || '',
      role: 'citizen',
      // No password required for OAuth users
    });
  }

  res.status(200).json(authResponse(user));
});

// ---------------------------------------------------------------------------
// Nodemailer transporter — uses SMTP env vars (falls back to Ethereal in dev)
// ---------------------------------------------------------------------------
const createTransporter = async () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Development fallback: auto-generate an Ethereal test account
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
};

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  // Always return 200 to prevent user enumeration
  const genericResponse = {
    success: true,
    message: 'If an account exists with that email, a password reset link has been sent.',
  };

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    '+resetPasswordToken +resetPasswordExpires'
  );

  if (!user) {
    return res.status(200).json(genericResponse);
  }

  // Google-only accounts have no password to reset
  if (user.googleId && !user.password) {
    return res.status(200).json(genericResponse);
  }

  // Generate a secure random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${rawToken}`;

  try {
    const transporter = await createTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"JanSamadhan" <no-reply@jansamadhan.app>',
      to: user.email,
      subject: 'Reset your JanSamadhan password',
      html: `
        <p>Hi ${user.name},</p>
        <p>We received a request to reset your password. Click the link below — it expires in <strong>1 hour</strong>.</p>
        <p><a href="${resetUrl}" style="color:#0891b2">Reset my password</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
      text: `Reset your password: ${resetUrl}\n\nLink expires in 1 hour.`,
    });

    // In development, log the Ethereal preview URL so you can inspect the email
    if (!process.env.SMTP_HOST) {
      console.log('[Dev] Password reset email preview:', nodemailer.getTestMessageUrl(info));
    }
  } catch (emailErr) {
    // Roll back token so the user can try again
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    console.error('Failed to send reset email:', emailErr.message);
    res.status(500);
    throw new Error('Failed to send reset email. Please try again later.');
  }

  res.status(200).json(genericResponse);
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password/:token
// ---------------------------------------------------------------------------
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpires');

  if (!user) {
    res.status(400);
    throw new Error('Reset link is invalid or has expired');
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password updated successfully. You can now sign in.',
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password-otp
// ---------------------------------------------------------------------------
exports.forgotPasswordOtp = asyncHandler(async (req, res) => {
  const { email, role } = req.body;

  if (!email || !role) {
    res.status(400);
    throw new Error('Email and role are required');
  }

  // Generic response to prevent account enumeration
  const genericResponse = {
    success: true,
    message: 'If an account exists with that email for the selected role, a 6-digit OTP has been sent.',
  };

  // Accept either a raw DB role or the frontend portal value ('citizen' | 'authority')
  // and map to the corresponding DB role(s) for the query.
  const PORTAL_MAP = {
    citizen: ['citizen'],
    authority: ['sub-admin', 'super-admin'],
    'citizen': ['citizen'],
    'sub-admin': ['sub-admin'],
    'super-admin': ['super-admin'],
  };

  const roleFilter = PORTAL_MAP[role];
  if (!roleFilter) {
    res.status(400);
    throw new Error('Invalid role');
  }

  // Strictly match email AND role — no cross-portal resets
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    role: { $in: roleFilter },
  }).select('+otpCode +otpExpires');

  if (!user) {
    // Return generic response to prevent account enumeration
    return res.status(200).json(genericResponse);
  }

  // Google-only accounts have no password to reset
  if (user.googleId && !user.password) {
    // Return generic response to prevent account enumeration
    return res.status(200).json(genericResponse);
  }

  // Generate a cryptographically secure 6-digit OTP
  const otp = String(crypto.randomInt(100000, 999999));
  // Store a SHA-256 hash — never the raw OTP
  user.otpCode = crypto.createHash('sha256').update(otp).digest('hex');
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save({ validateBeforeSave: false });

  try {
    const transporter = await createTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"JanSamadhan" <no-reply@jansamadhan.app>',
      to: user.email,
      subject: `${otp} is your JanSamadhan password reset OTP`,
      html: `
        <p>Hi ${user.name},</p>
        <p>Use the OTP below to reset your JanSamadhan password. It expires in <strong>10 minutes</strong>.</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0891b2">${otp}</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
      text: `Your JanSamadhan password reset OTP: ${otp}\n\nExpires in 10 minutes.`,
    });

    if (!process.env.SMTP_HOST) {
      console.log(`[Dev] OTP for ${user.email}: ${otp}`);
      console.log('[Dev] Email preview:', nodemailer.getTestMessageUrl(info));
    }
  } catch (emailErr) {
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });
    console.error('Failed to send OTP email:', emailErr.message);
    res.status(500);
    throw new Error('Failed to send OTP. Please try again later.');
  }

  res.status(200).json(genericResponse);
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password-otp
// ---------------------------------------------------------------------------
exports.resetPasswordOtp = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400);
    throw new Error('Email, OTP, and new password are required');
  }

  if (newPassword.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }

  const hashedOtp = crypto.createHash('sha256').update(String(otp)).digest('hex');

  // Only match an existing user — never create or upsert
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    otpCode: hashedOtp,
    otpExpires: { $gt: Date.now() },
  }).select('+otpCode +otpExpires');

  if (!user) {
    res.status(400);
    throw new Error('OTP is invalid or has expired');
  }

  user.password = newPassword;
  user.otpCode = undefined;
  user.otpExpires = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password updated successfully. You can now sign in.',
  });
});
