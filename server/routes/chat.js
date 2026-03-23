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

// Public routes for authenticated users (with suspension check)
router.get('/:chatId', auth, checkNotSuspended, getMessages);
router.post('/', auth, checkNotSuspended, sendMessage);
router.post('/anonymous', sendAnonymousMessage);

// Admin routes for chat management
router.delete('/message/:id', auth, admin, deleteMessage);
router.delete('/clear/:chatId', auth, admin, clearChat);
router.delete('/clear-before/:chatId', auth, admin, clearMessagesBefore);

module.exports = router;
