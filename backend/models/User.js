const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { DEPARTMENTS, USER_ROLES } = require('../constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: false,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: 'Role must be citizen, sub-admin, or super-admin',
      },
      default: 'citizen',
      required: true,
    },
    department: {
      type: String,
      enum: {
        values: DEPARTMENTS,
        message: 'Invalid department',
      },
      default: undefined,
    },
    totalPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    googleId: {
      type: String,
      default: undefined,
      index: { sparse: true },
    },
    resetPasswordToken: {
      type: String,
      default: undefined,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: undefined,
      select: false,
    },
    otpCode: {
      type: String,
      default: undefined,
      select: false,
    },
    otpExpires: {
      type: Date,
      default: undefined,
      select: false,
    },
    publicId: {
      type: String,
      unique: true,
      sparse: true, // allows null during the brief window before the hook runs
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.pre('validate', function (next) {
  if (this.role === 'sub-admin' && !this.department) {
    this.invalidate('department', 'Department is required for sub-admin accounts');
  }
  if (this.role !== 'sub-admin') {
    this.department = undefined;
  }
  next();
});

userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Auto-generate a unique public citizen ID (e.g. "JS-4827") on first save.
// Retries up to 10 times to handle the rare 4-digit collision case.
userSchema.pre('save', async function (next) {
  if (this.publicId) return next();

  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `JS-${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await mongoose.model('User').exists({ publicId: candidate });
    if (!exists) {
      this.publicId = candidate;
      return next();
    }
  }
  // Fallback: use last 6 hex chars of the document _id — guaranteed unique
  this.publicId = `JS-${this._id.toString().slice(-4).toUpperCase()}`;
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.virtual('issuesReported', {
  ref: 'Issue',
  localField: '_id',
  foreignField: 'reporterId',
  count: true,
});

userSchema.index({ role: 1, department: 1 });

module.exports = mongoose.model('User', userSchema);
