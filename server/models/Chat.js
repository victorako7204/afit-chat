const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  senderName: {
    type: String,
    default: 'Anonymous'
  },
  message: {
    type: String,
    required: true
  },
  chatType: {
    type: String,
    enum: ['public', 'private', 'group', 'anonymous'],
    default: 'public'
  },
  chatId: {
    type: String,
    required: true,
    index: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    default: null
  },
  replyToMessage: {
    type: String,
    default: null
  },
  replyToSender: {
    type: String,
    default: null
  },
  deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

chatSchema.index({ chatId: 1, createdAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
