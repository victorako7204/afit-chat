const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String }],
  answer: { type: String, required: true }
}, { _id: false });

const stageSchema = new mongoose.Schema({
  heading: { type: String, required: true },
  content: { type: String, required: true },
  quiz: [quizSchema]
}, { _id: false });

const moduleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    index: 'text'
  },
  subject: {
    type: String,
    required: true,
    enum: ['Math', 'Physics', 'GST', 'COS', 'Chemistry', 'Biology', 'Engineering', 'Computer Science', 'Other'],
    index: true
  },
  description: {
    type: String,
    default: ''
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  creatorName: {
    type: String,
    default: 'AI-Gemini'
  },
  isPublic: {
    type: Boolean,
    default: true,
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  views: {
    type: Number,
    default: 0
  },
  stages: [stageSchema],
  enrolledUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

moduleSchema.index({ title: 'text', description: 'text', tags: 'text' });

moduleSchema.pre('save', function(next) {
  if (this.isNew && !this.creator) {
    this.creatorName = 'AI-Gemini';
  }
  next();
});

moduleSchema.methods.incrementViews = async function() {
  this.views = (this.views || 0) + 1;
  await this.save();
};

moduleSchema.methods.toggleEnrollment = async function(userId) {
  const userIdStr = userId?.toString();
  const isEnrolled = this.enrolledUsers?.some(u => u?.toString() === userIdStr);
  
  if (isEnrolled) {
    this.enrolledUsers = this.enrolledUsers.filter(u => u?.toString() !== userIdStr);
  } else {
    if (!this.enrolledUsers) this.enrolledUsers = [];
    this.enrolledUsers.push(userId);
  }
  await this.save();
  return !isEnrolled;
};

moduleSchema.statics.searchByTitle = async function(title) {
  const normalizedTitle = title.toLowerCase().trim();
  const modules = await this.find({
    isPublic: true,
    $or: [
      { title: { $regex: normalizedTitle, $options: 'i' } },
      { tags: { $in: [normalizedTitle] } }
    ]
  }).limit(10);
  return modules;
};

moduleSchema.statics.getBySubject = async function(subject) {
  return this.find({ isPublic: true, subject }).sort({ views: -1, createdAt: -1 });
};

moduleSchema.statics.getPublicModules = async function(options = {}) {
  const { subject, search, page = 1, limit = 20 } = options;
  const query = { isPublic: true };
  
  if (subject && subject !== 'All') {
    query.subject = subject;
  }
  
  if (search) {
    query.$text = { $search: search };
  }
  
  const skip = (page - 1) * limit;
  const [modules, total] = await Promise.all([
    this.find(query).sort({ views: -1, createdAt: -1 }).skip(skip).limit(limit),
    this.countDocuments(query)
  ]);
  
  return { modules, total, page, totalPages: Math.ceil(total / limit) };
};

moduleSchema.statics.findByCreator = async function(creatorId) {
  return this.find({ creator: creatorId }).sort({ createdAt: -1 });
};

moduleSchema.statics.findEnrolled = async function(userId) {
  return this.find({ enrolledUsers: userId }).sort({ createdAt: -1 });
};

moduleSchema.statics.verifyModule = async function(moduleId) {
  return this.findByIdAndUpdate(moduleId, { isVerified: true }, { new: true });
};

moduleSchema.statics.getStats = async function() {
  const [totalModules, totalViews, verifiedCount, bySubject] = await Promise.all([
    this.countDocuments({ isPublic: true }),
    this.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
    this.countDocuments({ isPublic: true, isVerified: true }),
    this.aggregate([
      { $match: { isPublic: true } },
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);
  
  return {
    totalModules,
    totalViews: totalViews?.[0]?.total || 0,
    verifiedCount,
    bySubject
  };
};

moduleSchema.set('toJSON', { virtuals: true });
moduleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Module', moduleSchema);
