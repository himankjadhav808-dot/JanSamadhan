/**
 * seedAdmin.js
 *
 * Creates or updates the Super Admin account in MongoDB.
 *
 * Usage:
 *   node backend/seedAdmin.js
 *
 * NOTES:
 *  - Role value must be 'super-admin' (hyphenated) — enforced by the User
 *    model enum.  Any other casing will fail Mongoose validation.
 *  - Do NOT pre-hash the password.  The User model's pre-save hook calls
 *    bcrypt automatically.  Passing a manually-hashed string would double-
 *    hash the value and make authentication permanently impossible.
 *  - 'department' is only required for sub-admin accounts.  The pre-validate
 *    hook strips it from super-admin records automatically.
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('./models/User');

const SUPER_ADMIN_EMAIL    = 'jansamadhan26@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Superadmin';   // plain text — pre-save hook hashes it
const SUPER_ADMIN_NAME     = 'Super Admin';

async function seedAdmin() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    console.error('ERROR: No MongoDB connection string found.');
    console.error('Set MONGODB_URI or MONGO_URI in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB...');

  const existing = await User.findOne({ email: SUPER_ADMIN_EMAIL }).select('+password');

  if (existing) {
    // Update role and reset password on the existing account.
    // Assigning to .password triggers the pre-save bcrypt hook on save().
    existing.role       = 'super-admin';
    existing.isVerified = true;
    existing.password   = SUPER_ADMIN_PASSWORD;
    await existing.save();
    console.log(`✓ Updated existing account (${SUPER_ADMIN_EMAIL}) → role: super-admin, password reset.`);
  } else {
    await User.create({
      name:       SUPER_ADMIN_NAME,
      email:      SUPER_ADMIN_EMAIL,
      password:   SUPER_ADMIN_PASSWORD,
      role:       'super-admin',
      isVerified: true,
    });
    console.log(`✓ Created new super-admin account: ${SUPER_ADMIN_EMAIL}`);
  }

  await mongoose.disconnect();
  console.log('Done. MongoDB disconnected.');
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
