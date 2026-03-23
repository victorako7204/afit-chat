const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'GAME_INVITE',
      'GAME_WINNER',
      'GAME_STARTED',
      'LOST_FOUND',
      'ANNOUNCEMENT',
      'SYSTEM'
    ],
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  senderName: {
    type: String,
    default: 'System'
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isGlobal: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ isGlobal: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

notificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

notificationSchema.statics.createGlobalAnnouncement = async function(title, message, senderId, senderName) {
  const notification = new this({
    type: 'ANNOUNCEMENT',
    title,
    message,
    sender: senderId,
    senderName: senderName || 'Admin',
    isGlobal: true,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  await notification.save();
  return notification;
};

notificationSchema.statics.createGameInvite = async function(senderId, senderName, recipientId) {
  const notification = new this({
    type: 'GAME_INVITE',
    title: 'Chess Challenge!',
    message: `${senderName} has challenged you to a chess game!`,
    sender: senderId,
    senderName,
    recipient: recipientId,
    expiresAt: new Date(Date.now() + 60 * 1000)
  });
  await notification.save();
  return notification;
};

notificationSchema.statics.createGameResult = async function(winnerId, winnerName, loserId, loserName) {
  const winnerNotification = new this({
    type: 'GAME_WINNER',
    title: 'Victory!',
    message: `Congratulations! You defeated ${loserName} in chess!`,
    sender: loserId,
    senderName: loserName,
    recipient: winnerId,
    data: { result: 'win' },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  const loserNotification = new this({
    type: 'GAME_WINNER',
    title: 'Game Over',
    message: `${winnerName} defeated you in chess. Better luck next time!`,
    sender: winnerId,
    senderName: winnerName,
    recipient: loserId,
    data: { result: 'loss' },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  await Promise.all([winnerNotification.save(), loserNotification.save()]);
  return { winnerNotification, loserNotification };
};

notificationSchema.statics.createLostFound = async function(senderId, senderName, itemType, description) {
  const notification = new this({
    type: 'LOST_FOUND',
    title: itemType === 'lost' ? 'Item Lost' : 'Item Found',
    message: `${senderName} reported: ${description}`,
    sender: senderId,
    senderName,
    isGlobal: true,
    data: { itemType, description },
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });
  await notification.save();
  return notification;
};

notificationSchema.statics.getUserNotifications = async function(userId, limit = 50) {
  return this.find({
    $or: [
      { recipient: userId },
      { isGlobal: true }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name matricNo');
};

notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({
    recipient: userId,
    isRead: false
  });
};

notificationSchema.statics.markAsRead = async function(notificationId, userId) {
  return this.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true },
    { new: true }
  );
};

notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true }
  );
};

module.exports = mongoose.model('Notification', notificationSchema);
