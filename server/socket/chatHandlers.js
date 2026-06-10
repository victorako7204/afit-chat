const chatService = require('../services/chatService');
const Conversation = require('../models/Conversation');
const Chat = require('../models/Chat');

module.exports = (io, socket) => {
  socket.on('joinChat', async ({ chatId }, callback) => {
    try {
      if (!chatId) return;

      if (chatId.startsWith('dm:')) {
        const parts = chatId.split(':');
        const user1 = parts[1];
        const user2 = parts[2];
        const currentId = String(socket.user?.userId || '');
        if (currentId !== user1 && currentId !== user2) {
          if (callback) callback({ error: 'Not a participant' });
          return;
        }
      }

      if (chatId.startsWith('group:')) {
        const Group = require('../models/Group');
        const groupId = chatId.replace('group:', '');
        const group = await Group.findById(groupId);
        if (!group) {
          if (callback) callback({ error: 'Group not found' });
          return;
        }
        const isMember = group.members.some(m => String(m) === String(socket.user?.userId));
        if (!isMember) {
          if (callback) callback({ error: 'Not a member' });
          return;
        }
      }

      socket.join(chatId);
      if (callback) callback({ success: true, chatId });
    } catch (error) {
      if (callback) callback({ error: error.message });
    }
  });

  socket.on('leaveChat', ({ chatId }) => {
    if (chatId) {
      socket.leave(chatId);
    }
  });

  socket.on('sendMessage', async ({ chatId, message, replyTo, tempId }, callback) => {
    try {
      if (!chatId || !message || !message.trim()) {
        if (callback) callback({ error: 'Message cannot be empty' });
        return;
      }

      const user = socket.user;
      if (!user) {
        if (callback) callback({ error: 'Authentication required' });
        return;
      }

      let chatType = 'public';
      if (chatId.startsWith('dm:')) chatType = 'private';
      else if (chatId.startsWith('group:')) chatType = 'group';

      const recipientId = chatType === 'private' ? (() => {
        const parts = chatId.split(':');
        const user1 = parts[1];
        const user2 = parts[2];
        return String(user.userId) === user1 ? user2 : user1;
      })() : null;

      const saved = await chatService.createMessage({
        senderId: user.userId,
        senderName: user.name,
        realSenderId: user.userId,
        message,
        chatType,
        chatId,
        recipientId,
        replyTo
      });

      const messageObj = {
        ...saved,
        tempId: tempId || null
      };

      io.to(chatId).emit('newMessage', messageObj);

      if (chatType === 'private' && recipientId) {
        io.to(`user:${recipientId}`).emit('newMessageNotification', {
          senderId: String(user.userId),
          senderName: user.name,
          message: message.substring(0, 50),
          chatId,
          timestamp: new Date().toISOString()
        });
      }

      if (callback) callback({ success: true, tempId, messageId: saved._id });
    } catch (error) {
      if (callback) callback({ error: error.message });
    }
  });

  socket.on('typing', ({ chatId, isTyping }) => {
    if (!chatId || !socket.user) return;
    socket.to(chatId).emit('typing', {
      userId: socket.user.userId,
      userName: socket.user.name,
      isTyping,
      chatId
    });
  });

  socket.on('markRead', async ({ chatId }) => {
    if (!chatId || !socket.user) return;
    try {
      await chatService.markRead(chatId, socket.user.userId);
      socket.to(chatId).emit('messagesRead', {
        userId: socket.user.userId,
        chatId
      });
    } catch (error) {
    }
  });

  socket.on('deleteMessage', async ({ messageId }) => {
    if (!messageId || !socket.user) return;
    try {
      const isAdmin = socket.user.role === 'admin' || socket.user.role === 'moderator';
      const result = await chatService.deleteMessage(messageId, socket.user.userId, isAdmin);
      io.to(result.chatId).emit('messageDeleted', {
        messageId,
        chatId: result.chatId
      });
    } catch (error) {
    }
  });

  socket.on('editMessage', async ({ messageId, newContent }) => {
    if (!messageId || !newContent || !socket.user) return;
    try {
      const result = await chatService.editMessage(messageId, socket.user.userId, newContent);
      io.to(result.chatId).emit('messageEdited', {
        messageId,
        chatId: result.chatId,
        newContent: result.message,
        editedAt: result.editedAt
      });
    } catch (error) {
    }
  });
};
