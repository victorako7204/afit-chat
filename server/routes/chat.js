const express = require('express');
const router = express.Router();
const { auth, checkNotSuspended } = require('../middleware/auth');
const chatService = require('../services/chatService');
const Chat = require('../models/Chat');
const Conversation = require('../models/Conversation');

router.get('/conversations', auth, async (req, res, next) => {
  try {
    const conversations = await chatService.getConversations(req.user._id);
    res.json({ success: true, data: { conversations } });
  } catch (error) {
    next(error);
  }
});

router.get('/unread', auth, async (req, res, next) => {
  try {
    const result = await chatService.getUnreadCounts(req.user._id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/:chatId/messages', auth, checkNotSuspended, async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50, before } = req.query;

    if (chatId.startsWith('dm:')) {
      const parts = chatId.split(':');
      const user1 = parts[1];
      const user2 = parts[2];
      const currentId = String(req.user._id);
      if (currentId !== user1 && currentId !== user2) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not a participant in this conversation' }
        });
      }
    }

    if (chatId.startsWith('group:')) {
      const groupId = chatId.replace('group:', '');
      const Group = require('../models/Group');
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' }
        });
      }
      const isMember = group.members.some(m => String(m) === String(req.user._id));
      if (!isMember) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not a member of this group' }
        });
      }
    }

    const result = await chatService.getMessages(chatId, {
      page: parseInt(page),
      limit: parseInt(limit),
      before: before || undefined
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/:chatId/messages', auth, checkNotSuspended, async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { message, replyTo } = req.body;

    const result = await chatService.createMessage({
      senderId: req.user._id,
      senderName: req.user.name,
      realSenderId: req.user._id,
      message,
      chatType: chatId === 'public-chat' ? 'public' : chatId.startsWith('dm:') ? 'private' : chatId.startsWith('group:') ? 'group' : 'public',
      chatId,
      recipientId: chatId.startsWith('dm:') ? req.body.recipientId : null,
      replyTo
    });

    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('newMessage', result);
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.put('/:chatId/read', auth, async (req, res, next) => {
  try {
    const { chatId } = req.params;
    await chatService.markRead(chatId, req.user._id);

    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('messagesRead', { userId: req.user._id, chatId });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/messages/:messageId', auth, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'moderator';
    const result = await chatService.deleteMessage(messageId, req.user._id, isAdmin);

    const io = req.app.get('io');
    if (io) {
      io.to(result.chatId).emit('messageDeleted', { messageId, chatId: result.chatId });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.put('/messages/:messageId', auth, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { message } = req.body;
    const result = await chatService.editMessage(messageId, req.user._id, message);

    const io = req.app.get('io');
    if (io) {
      io.to(result.chatId).emit('messageEdited', {
        messageId,
        chatId: result.chatId,
        newContent: result.message,
        editedAt: result.editedAt
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

const sendAnonymousMessage = async (req, res, next) => {
  try {
    const { message, chatId } = req.body;

    const result = await chatService.createMessage({
      senderId: req.user?._id || null,
      senderName: 'Anonymous',
      realSenderId: req.user?._id || null,
      message,
      chatType: 'anonymous',
      chatId: chatId || 'anonymous-chat'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('newMessage', result);
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

router.post('/anonymous', sendAnonymousMessage);

router.delete('/message/:id', auth, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'moderator';
    const result = await chatService.deleteMessage(req.params.id, req.user._id, isAdmin);

    const io = req.app.get('io');
    if (io) {
      io.to(result.chatId).emit('messageDeleted', { messageId: req.params.id, chatId: result.chatId });
    }

    res.json({ success: true, data: { message: 'Message deleted' } });
  } catch (error) {
    next(error);
  }
});

router.delete('/clear/:chatId', auth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin or Moderator access required' }
      });
    }
    const { chatId } = req.params;
    await Chat.updateMany({ chatId }, { isDeleted: true, deletedAt: new Date(), deletedBy: req.user._id });
    res.json({ success: true, data: { message: 'Chat cleared' } });
  } catch (error) {
    next(error);
  }
});

router.delete('/clear-before/:chatId', auth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin or Moderator access required' }
      });
    }
    const { chatId } = req.params;
    const { timestamp } = req.body;
    if (!timestamp) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Timestamp is required' }
      });
    }
    await Chat.updateMany(
      { chatId, createdAt: { $lt: new Date(timestamp) } },
      { isDeleted: true, deletedAt: new Date(), deletedBy: req.user._id }
    );
    res.json({ success: true, data: { message: 'Messages cleared' } });
  } catch (error) {
    next(error);
  }
});

router.put('/unread/clear/:chatId', auth, async (req, res, next) => {
  try {
    const { chatId } = req.params;
    await Conversation.clearUnread(chatId, req.user._id);
    res.json({ success: true, data: { message: 'Unread cleared' } });
  } catch (error) {
    next(error);
  }
});

router.get('/unread/count', auth, async (req, res, next) => {
  try {
    const result = await chatService.getUnreadCounts(req.user._id);
    res.json({ success: true, data: { unreadCount: result.totalUnread } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
