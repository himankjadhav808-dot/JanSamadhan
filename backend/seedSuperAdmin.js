/**
 * seedSuperAdmin.js
 *
 * Creates or updates the Super Admin account.
 *
 * Usage:
 *   node backend/seedSuperAdmin.js
 *
 * IMPORTANT NOTES:
 *  - The valid role value in this codebase is 'super-admin' (hyphenated),
 *    enforced by the User model enum.  'SuperAdmin' or 'superadmin' would
 *    fail Mongoose validation and produce a 403 on every login.
 *  - Do NOT hash the password here.  The User model's pre-save hook calls
 *    bcrypt.genSalt / bcrypt.hash automatically, so passing a plain-text
 *    password to User.create / user.save() is correct and intentional.
 *    Manual hashing before saving would double-hash the value and make
 *    authentication permanently impossible for this account.
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const SUPER_ADMIN_EMAIL    = 'jansamadhan26@gmail.com';
const SUPER_ADMIN_PASSWORD = 'SuperSecretPassword123!';   // plain text — hook hashes it
const SUPER_ADMIN_NAME     = 'Super Admin';

async function seed() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('ERROR: No MongoDB connection string found.');
    console.error('Set MONGODB_URI or MONGO_URI in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected.');

  const existing = await User.findOne({ email: SUPER_ADMIN_EMAIL }).select('+password');

  if (existing) {
    // Update role and reset password on the existing account
    existing.role     = 'super-admin';
    existing.password = SUPER_ADMIN_PASSWORD; // pre-save hook will hash this
    await existing.save();
    console.log(`✓ Updated existing account (${SUPER_ADMIN_EMAIL}) → role: super-admin, password reset.`);
  } else {
    // Create a brand-new super-admin account
    await User.create({
      name:     SUPER_ADMIN_NAME,
      email:    SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD, // pre-save hook will hash this
      role:     'super-admin',
    });
    console.log(`✓ Created new super-admin account: ${SUPER_ADMIN_EMAIL}`);
  }

  await mongoose.disconnect();
  console.log('Done. MongoDB disconnected.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
