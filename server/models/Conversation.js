const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  chatId: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['private', 'group'],
    required: true
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },
  lastMessage: {
    content: { type: String, default: '' },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    senderName: { type: String, default: '' },
    sentAt: { type: Date, default: null }
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  mutedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

conversationSchema.index({ participants: 1 });

conversationSchema.statics.findOrCreateDM = async function(userId1, userId2) {
  const sorted = [String(userId1), String(userId2)].sort();
  const chatId = `dm:${sorted[0]}:${sorted[1]}`;

  let conversation = await this.findOne({ chatId });

  if (!conversation) {
    conversation = await this.create({
      participants: sorted.map(id => new mongoose.Types.ObjectId(id)),
      chatId,
      type: 'private',
      unreadCount: {}
    });
  }

  return conversation;
};

conversationSchema.statics.incrementUnread = async function(chatId, userId) {
  const userIdStr = String(userId);
  await this.findOneAndUpdate(
    { chatId },
    { $inc: { [`unreadCount.${userIdStr}`]: 1 } },
    { upsert: true }
  );
};

conversationSchema.statics.clearUnread = async function(chatId, userId) {
  const userIdStr = String(userId);
  await this.findOneAndUpdate(
    { chatId },
    { $set: { [`unreadCount.${userIdStr}`]: 0 } }
  );
};

conversationSchema.statics.updateLastMessage = async function(chatId, messageData) {
  await this.findOneAndUpdate(
    { chatId },
    {
      $set: {
        lastMessage: {
          content: messageData.content,
          senderId: messageData.senderId,
          senderName: messageData.senderName,
          sentAt: messageData.sentAt || new Date()
        }
      }
    }
  );
};

module.exports = mongoose.model('Conversation', conversationSchema);
