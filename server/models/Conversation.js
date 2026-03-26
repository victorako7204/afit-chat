const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: String,
    default: ''
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  lastMessageBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

conversationSchema.index({ participants: 1 });

conversationSchema.methods.incrementUnread = async function(targetUserId) {
  const userIdStr = String(targetUserId);
  const current = this.unreadCount.get(userIdStr) || 0;
  this.unreadCount.set(userIdStr, current + 1);
  await this.save();
};

conversationSchema.methods.clearUnread = async function(targetUserId) {
  const userIdStr = String(targetUserId);
  this.unreadCount.set(userIdStr, 0);
  await this.save();
};

conversationSchema.methods.getUnreadCount = function(userId) {
  const userIdStr = String(userId);
  return this.unreadCount.get(userIdStr) || 0;
};

conversationSchema.statics.findOrCreateByParticipants = async function(userId1, userId2) {
  const participants = [String(userId1), String(userId2)].sort();
  
  let conversation = await this.findOne({
    participants: { $all: participants.map(id => new mongoose.Types.ObjectId(id)) }
  });
  
  if (!conversation) {
    conversation = await this.create({
      participants: participants.map(id => new mongoose.Types.ObjectId(id)),
      unreadCount: {}
    });
  }
  
  return conversation;
};

conversationSchema.statics.incrementUnreadForUser = async function(chatId, targetUserId) {
  const userIdStr = String(targetUserId);
  
  await this.findByIdAndUpdate(
    chatId,
    { 
      $inc: { [`unreadCount.${userIdStr}`]: 1 },
      $set: { lastMessageAt: new Date() }
    },
    { upsert: true, new: true }
  );
};

conversationSchema.statics.clearUnreadForUser = async function(chatId, targetUserId) {
  const userIdStr = String(targetUserId);
  
  await this.findByIdAndUpdate(
    chatId,
    { $set: { [`unreadCount.${userIdStr}`]: 0 } },
    { upsert: true }
  );
};

conversationSchema.statics.getUnreadForUser = async function(userId) {
  const userIdStr = String(userId);
  const conversations = await this.find({
    participants: userId
  }).select('unreadCount');
  
  let total = 0;
  conversations.forEach(conv => {
    const count = conv.unreadCount?.get?.(userIdStr) || 0;
    total += count;
  });
  
  return total;
};

module.exports = mongoose.model('Conversation', conversationSchema);
