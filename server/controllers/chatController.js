const Chat = require('../models/Chat');

/**
 * Get messages with pagination
 * @param {string} chatId - The chat room identifier
 * @param {number} limit - Number of messages to fetch (default 20)
 * @param {number} skip - Number of messages to skip (for pagination)
 * Admin unmask: Shows full sender profile for admin users, masks anonymous for others
 */
const getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;
    const isAdmin = req.user?.role === 'admin';

    const messages = await Chat.find({ chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', isAdmin ? 'name matricNo email department role status' : 'name matricNo')
      .lean();

    const processedMessages = messages.map(msg => {
      const isAnonymous = msg.chatType === 'anonymous' || msg.senderId === null;
      
      if (isAdmin) {
        return { ...msg, isAdminView: true, isAnonymous };
      }
      
      if (isAnonymous) {
        return { 
          ...msg, 
          senderName: 'Anonymous Student', 
          senderId: null,
          senderIdObj: null,
          matricNo: 'hidden',
          isAnonymous: true 
        };
      }
      
      return { ...msg, isAnonymous: false };
    });

    const reversedMessages = processedMessages.reverse();

    const total = await Chat.countDocuments({ chatId });

    res.json({
      messages: reversedMessages,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + messages.length < total
      },
      isAdmin
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a new message
 */
const sendMessage = async (req, res, next) => {
  try {
    const { message, chatType, chatId, recipientId, replyTo, replyToMessage, replyToSender } = req.body;
    const senderId = req.user._id;

    const chat = new Chat({
      senderId,
      senderName: req.user.name,
      message,
      chatType,
      chatId,
      recipientId: recipientId || null,
      replyTo: replyTo || null,
      replyToMessage: replyToMessage || null,
      replyToSender: replyToSender || null
    });

    await chat.save();

    await chat.populate('senderId', 'name matricNo');

    const io = req.app.get('io');
    if (io) {
      const messageObj = {
        ...chat.toObject(),
        senderId: String(senderId),
        recipientId: recipientId ? String(recipientId) : null,
        chatId,
        replyTo: replyTo || null,
        replyToMessage: replyToMessage || null,
        replyToSender: replyToSender || null
      };
      io.to(chatId).emit('receiveMessage', messageObj);

      if (chatType === 'private' && recipientId) {
        io.to(`user:${recipientId}`).emit('newMessageNotification', {
          senderId: String(senderId),
          senderName: req.user.name,
          message: message.substring(0, 50),
          chatId,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.status(201).json({
      message: 'Message sent',
      chat
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send anonymous message
 */
const sendAnonymousMessage = async (req, res, next) => {
  try {
    const { message, chatType, chatId } = req.body;

    const chat = new Chat({
      senderId: null,
      senderName: 'Anonymous',
      message,
      chatType: 'anonymous',
      chatId
    });

    await chat.save();

    res.status(201).json({
      message: 'Anonymous message sent',
      chat
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete a single message
 */
const deleteMessage = async (req, res, next) => {
  try {
    const chat = await Chat.findByIdAndDelete(req.params.id);
    if (!chat) {
      return res.status(404).json({ message: 'Message not found' });
    }
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Clear all messages in a chat
 */
const clearChat = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    await Chat.deleteMany({ chatId });
    res.json({ message: 'Chat cleared successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Clear messages before a certain date
 */
const clearMessagesBefore = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { timestamp } = req.body;

    if (!timestamp) {
      return res.status(400).json({ message: 'Timestamp is required' });
    }

    const beforeDate = new Date(timestamp);
    await Chat.deleteMany({
      chatId,
      createdAt: { $lt: beforeDate }
    });

    res.json({ message: 'Messages cleared successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMessages,
  sendMessage,
  sendAnonymousMessage,
  deleteMessage,
  clearChat,
  clearMessagesBefore
};
