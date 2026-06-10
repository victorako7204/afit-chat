const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const refreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  matricNo: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    select: false
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  role: {
    type: String,
    enum: ['student', 'moderator', 'admin'],
    default: 'student'
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'restricted'],
    default: 'active'
  },
  suspensionReason: {
    type: String,
    default: null
  },
  suspensionExpiry: {
    type: Date,
    default: null
  },
  department: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  points: {
    type: Number,
    default: 0
  },
  totalWins: {
    type: Number,
    default: 0
  },
  totalLosses: {
    type: Number,
    default: 0
  },
  totalDraws: {
    type: Number,
    default: 0
  },
  gamesPlayed: {
    type: Number,
    default: 0
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastGameAt: {
    type: Date,
    default: null
  },
  bio: {
    type: String,
    default: '',
    maxLength: 200
  },
  skills: [{
    name: String,
    level: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    }
  }],
  refreshTokens: [refreshTokenSchema],
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  passwordChangedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

userSchema.index({ points: -1, totalWins: -1 });
userSchema.index({ currentStreak: -1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.recordWin = async function() {
  this.points += 10;
  this.totalWins += 1;
  this.gamesPlayed += 1;
  this.currentStreak += 1;
  this.lastGameAt = new Date();
  if (this.currentStreak > this.longestStreak) {
    this.longestStreak = this.currentStreak;
  }
  await this.save();
  return this;
};

userSchema.methods.recordLoss = async function() {
  this.points = Math.max(0, this.points - 5);
  this.totalLosses += 1;
  this.gamesPlayed += 1;
  this.currentStreak = 0;
  this.lastGameAt = new Date();
  await this.save();
  return this;
};

userSchema.methods.recordDraw = async function() {
  this.points += 3;
  this.totalDraws += 1;
  this.gamesPlayed += 1;
  this.lastGameAt = new Date();
  await this.save();
  return this;
};

userSchema.statics.getLeaderboard = async function(type = 'all', limit = 10) {
  let sortField = 'points';
  if (type === 'wins') sortField = 'totalWins';
  if (type === 'streak') sortField = 'longestStreak';
  return this.find()
    .sort({ [sortField]: -1, totalWins: -1 })
    .limit(limit)
    .select('-password');
};

userSchema.methods.isSuspended = function() {
  if (this.status !== 'suspended') return false;
  if (this.suspensionExpiry && new Date() > this.suspensionExpiry) {
    return false;
  }
  return true;
};

userSchema.methods.suspend = async function(reason, expiryDate = null) {
  this.status = 'suspended';
  this.suspensionReason = reason;
  this.suspensionExpiry = expiryDate;
  await this.save();
  return this;
};

userSchema.methods.unsuspend = async function() {
  this.status = 'active';
  this.suspensionReason = null;
  this.suspensionExpiry = null;
  await this.save();
  return this;
};

userSchema.statics.checkNotSuspended = async function(userId) {
  const user = await this.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.isSuspended()) {
    throw new Error(`Account suspended: ${user.suspensionReason}`);
  }
  return user;
};

userSchema.methods.incLoginAttempts = async function() {
  this.loginAttempts += 1;
  if (this.loginAttempts >= 5) {
    this.lockUntil = Date.now() + 15 * 60 * 1000;
  }
  await this.save();
  return this;
};

userSchema.methods.resetLoginAttempts = async function() {
  this.loginAttempts = 0;
  this.lockUntil = null;
  await this.save();
  return this;
};

userSchema.methods.isLocked = function() {
  if (!this.lockUntil) return false;
  if (new Date() > this.lockUntil) {
    return false;
  }
  return true;
};

userSchema.methods.addRefreshToken = async function(tokenHash, expiresAt) {
  this.refreshTokens.push({ tokenHash, createdAt: new Date(), expiresAt });
  if (this.refreshTokens.length > 10) {
    this.refreshTokens = this.refreshTokens.slice(-10);
  }
  await this.save();
  return this;
};

userSchema.methods.removeRefreshToken = async function(tokenHash) {
  this.refreshTokens = this.refreshTokens.filter(
    t => t.tokenHash !== tokenHash
  );
  await this.save();
  return this;
};

userSchema.methods.removeAllRefreshTokens = async function() {
  this.refreshTokens = [];
  await this.save();
  return this;
};

userSchema.methods.isPasswordChangedAfter = function(jwtTimestamp) {
  if (!this.passwordChangedAt) return false;
  return Math.floor(this.passwordChangedAt.getTime() / 1000) > jwtTimestamp;
};

userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email: email.toLowerCase() }).select('+matricNo');
  if (!user) {
    const error = new Error('Invalid email or password');
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }
  if (user.isLocked()) {
    const remainingMs = user.lockUntil.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    const error = new Error(`Account locked. Try again in ${remainingMin} minute(s).`);
    error.code = 'ACCOUNT_LOCKED';
    error.remainingMinutes = remainingMin;
    throw error;
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await user.incLoginAttempts();
    const error = new Error('Invalid email or password');
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }
  await user.resetLoginAttempts();
  return user;
};

module.exports = mongoose.model('User', userSchema);
