const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    trim: true
  },
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
  }]
}, {
  timestamps: true
});

userSchema.index({ points: -1, totalWins: -1 });
userSchema.index({ currentStreak: -1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
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

module.exports = mongoose.model('User', userSchema);
