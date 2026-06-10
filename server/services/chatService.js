const Chat = require('../models/Chat');
const Conversation = require('../models/Conversation');

const generateAnonymousName = (userId) => {
  const hash = String(userId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const today = new Date().toDateString();
  const dailyHash = (hash + today.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 1000;
  return `Anonymous #${dailyHash}`;
};

const createMessage = async (data) => {
  const { senderId, senderName, realSenderId, message, chatType, chatId, recipientId, replyTo } = data;

  if (!message || message.trim().length === 0) {
    const err = new Error('Message cannot be empty');
    err.code = 'EMPTY_MESSAGE';
    throw err;
  }

  const maxLen = chatType === 'anonymous' ? 500 : 2000;
  if (message.length > maxLen) {
    const err = new Error(`Message exceeds maximum length of ${maxLen} characters`);
    err.code = 'MESSAGE_TOO_LONG';
    throw err;
  }

  const displayName = chatType === 'anonymous' ? generateAnonymousName(realSenderId || senderId) : senderName;

  const chat = new Chat({
    senderId,
    senderName: displayName,
    realSenderId: realSenderId || senderId,
    message: message.trim(),
    chatType,
    chatId,
    recipientId: recipientId || null,
    replyTo: replyTo || null,
    status: 'sent'
  });

  if (replyTo) {
    const repliedMsg = await Chat.findById(replyTo).lean();
    if (repliedMsg) {
      chat.replyToMessage = repliedMsg.message;
      chat.replyToSender = repliedMsg.senderName;
    }
  }

  const saved = await chat.save();
  const populated = await Chat.findById(saved._id)
    .populate('senderId', 'name')
    .lean();

  if (chatType === 'private' && recipientId) {
    await Conversation.updateLastMessage(chatId, {
      content: message.trim().substring(0, 100),
      senderId,
      senderName: displayName,
      sentAt: new Date()
    });
    const recipientStr = String(recipientId);
    await Conversation.incrementUnread(chatId, recipientStr);
  }

  return populated;
};

const getMessages = async (chatId, options = {}) => {
  const { page = 1, limit = 50, before } = options;

  const query = { chatId, isDeleted: false };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await Chat.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate('senderId', 'name')
    .lean();

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  const result = {
    messages: messages.reverse(),
    hasMore
  };

  if (hasMore && messages.length > 0) {
    result.nextCursor = messages[0].createdAt;
  }

  return result;
};

const markDelivered = async (messageId) => {
  const message = await Chat.findByIdAndUpdate(
    messageId,
    { status: 'delivered', deliveredAt: new Date() },
    { new: true }
  ).lean();

  return message;
};

const markRead = async (chatId, userId) => {
  const userIdStr = String(userId);

  const result = await Chat.updateMany(
    {
      chatId,
      recipientId: userId,
      status: { $ne: 'read' },
      isDeleted: false
    },
    { status: 'read', readAt: new Date() }
  );

  await Conversation.clearUnread(chatId, userIdStr);

  return result;
};

const deleteMessage = async (messageId, userId, isAdmin = false) => {
  const message = await Chat.findById(messageId);

  if (!message) {
    const err = new Error('Message not found');
    err.code = 'MESSAGE_NOT_FOUND';
    throw err;
  }

  if (String(message.senderId) !== String(userId) && !isAdmin) {
    const err = new Error('Not authorized to delete this message');
    err.code = 'FORBIDDEN';
    throw err;
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.deletedBy = userId;
  await message.save();

  return message;
};

const editMessage = async (messageId, userId, newContent) => {
  const message = await Chat.findById(messageId);

  if (!message) {
    const err = new Error('Message not found');
    err.code = 'MESSAGE_NOT_FOUND';
    throw err;
  }

  if (String(message.senderId) !== String(userId)) {
    const err = new Error('Not authorized to edit this message');
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (message.isDeleted) {
    const err = new Error('Cannot edit a deleted message');
    err.code = 'MESSAGE_DELETED';
    throw err;
  }

  const fifteenMin = 15 * 60 * 1000;
  const msgAge = Date.now() - new Date(message.createdAt).getTime();
  if (msgAge > fifteenMin) {
    const err = new Error('Cannot edit messages older than 15 minutes');
    err.code = 'EDIT_WINDOW_EXPIRED';
    throw err;
  }

  if (!newContent || newContent.trim().length === 0) {
    const err = new Error('Message cannot be empty');
    err.code = 'EMPTY_MESSAGE';
    throw err;
  }

  message.message = newContent.trim();
  message.editedAt = new Date();
  await message.save();

  return message;
};

const getUnreadCounts = async (userId) => {
  const userIdStr = String(userId);
  const conversations = await Conversation.find({
    participants: userId
  }).lean();

  let totalUnread = 0;
  const convList = conversations.map(conv => {
    const count = conv.unreadCount?.get?.(userIdStr) || conv.unreadCount?.[userIdStr] || 0;
    totalUnread += count;
    return {
      chatId: conv.chatId,
      type: conv.type,
      unreadCount: count,
      lastMessage: conv.lastMessage || null,
      participants: conv.participants
    };
  });

  return { totalUnread, conversations: convList };
};

const getConversations = async (userId) => {
  const conversations = await Conversation.find({
    participants: userId
  })
    .sort({ 'lastMessage.sentAt': -1, updatedAt: -1 })
    .populate('participants', 'name department')
    .lean();

  return conversations;
};

module.exports = {
  createMessage,
  getMessages,
  markDelivered,
  markRead,
  deleteMessage,
  editMessage,
  getUnreadCounts,
  getConversations,
  generateAnonymousName
};
