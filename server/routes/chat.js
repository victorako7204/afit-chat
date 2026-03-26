const express = require('express');
const router = express.Router();
const { auth, checkNotSuspended } = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  getMessages,
  sendMessage,
  sendAnonymousMessage,
  deleteMessage,
  clearChat,
  clearMessagesBefore
} = require('../controllers/chatController');
const Conversation = require('../models/Conversation');

// Public routes for authenticated users (with suspension check)
router.get('/:chatId', auth, checkNotSuspended, getMessages);
router.post('/', auth, checkNotSuspended, sendMessage);
router.post('/anonymous', sendAnonymousMessage);

// Unread count routes
router.get('/unread/count', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const totalUnread = await Conversation.getUnreadForUser(userId);
    res.json({ unreadCount: totalUnread });
  } catch (error) {
    next(error);
  }
});

router.put('/unread/clear/:chatId', auth, async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    await Conversation.clearUnreadForUser(chatId, userId);
    res.json({ message: 'Unread cleared' });
  } catch (error) {
    next(error);
  }
});

// Admin routes for chat management
router.delete('/message/:id', auth, admin, deleteMessage);
router.delete('/clear/:chatId', auth, admin, clearChat);
router.delete('/clear-before/:chatId', auth, admin, clearMessagesBefore);

module.exports = router;
