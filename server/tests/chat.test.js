const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Chat = require('../models/Chat');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const chatService = require('../services/chatService');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Chat.deleteMany({});
  await Conversation.deleteMany({});
  await User.deleteMany({});
});

describe('Chat Model', () => {
  const validMessage = {
    senderId: new mongoose.Types.ObjectId(),
    senderName: 'Test User',
    realSenderId: new mongoose.Types.ObjectId(),
    message: 'Hello world',
    chatType: 'public',
    chatId: 'public-chat'
  };

  it('should create a message with default status "sent"', async () => {
    const chat = await Chat.create(validMessage);
    expect(chat.status).toBe('sent');
    expect(chat.isDeleted).toBe(false);
  });

  it('should require message field', async () => {
    await expect(Chat.create({ ...validMessage, message: undefined })).rejects.toThrow();
  });

  it('should enforce maxLength of 2000', async () => {
    const longMsg = 'x'.repeat(2001);
    await expect(Chat.create({ ...validMessage, message: longMsg })).rejects.toThrow();
  });

  it('should reject invalid chatType', async () => {
    await expect(Chat.create({ ...validMessage, chatType: 'invalid' })).rejects.toThrow();
  });

  it('should allow anonymous chat type', async () => {
    const chat = await Chat.create({
      ...validMessage,
      chatType: 'anonymous',
      senderName: 'Anonymous #123',
      realSenderId: validMessage.senderId
    });
    expect(chat.chatType).toBe('anonymous');
    expect(chat.senderName).toBe('Anonymous #123');
  });

  it('should support soft delete fields', async () => {
    const chat = await Chat.create(validMessage);
    chat.isDeleted = true;
    chat.deletedAt = new Date();
    chat.deletedBy = new mongoose.Types.ObjectId();
    await chat.save();
    const found = await Chat.findById(chat._id);
    expect(found.isDeleted).toBe(true);
    expect(found.deletedAt).toBeDefined();
    expect(found.deletedBy).toBeDefined();
  });

  it('should support status transitions', async () => {
    const chat = await Chat.create(validMessage);
    expect(chat.status).toBe('sent');
    chat.status = 'delivered';
    chat.deliveredAt = new Date();
    await chat.save();
    expect(chat.status).toBe('delivered');
    chat.status = 'read';
    chat.readAt = new Date();
    await chat.save();
    expect(chat.status).toBe('read');
  });
});

describe('Conversation Model', () => {
  it('should findOrCreateDM with sorted chatId', async () => {
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();
    const conv = await Conversation.findOrCreateDM(id1, id2);
    expect(conv.chatId).toContain('dm:');
    expect(conv.participants).toHaveLength(2);
    expect(conv.type).toBe('private');
  });

  it('should not create duplicate DMs', async () => {
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();
    const conv1 = await Conversation.findOrCreateDM(id1, id2);
    const conv2 = await Conversation.findOrCreateDM(id1, id2);
    expect(String(conv1._id)).toBe(String(conv2._id));
  });

  it('should increment unread count atomically', async () => {
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();
    const conv = await Conversation.findOrCreateDM(id1, id2);
    await Conversation.incrementUnread(conv.chatId, id2);
    await Conversation.incrementUnread(conv.chatId, id2);
    const updated = await Conversation.findById(conv._id);
    expect(updated.unreadCount.get(String(id2))).toBe(2);
  });

  it('should clear unread count', async () => {
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();
    const conv = await Conversation.findOrCreateDM(id1, id2);
    await Conversation.incrementUnread(conv.chatId, id2);
    await Conversation.clearUnread(conv.chatId, id2);
    const updated = await Conversation.findById(conv._id);
    expect(updated.unreadCount.get(String(id2))).toBe(0);
  });

  it('should update last message', async () => {
    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();
    const conv = await Conversation.findOrCreateDM(id1, id2);
    await Conversation.updateLastMessage(conv.chatId, {
      content: 'Hello!',
      senderId: id1,
      senderName: 'User1',
      sentAt: new Date()
    });
    const updated = await Conversation.findById(conv._id);
    expect(updated.lastMessage.content).toBe('Hello!');
    expect(updated.lastMessage.senderName).toBe('User1');
  });
});

describe('chatService.createMessage', () => {
  it('should create a public message', async () => {
    const msg = await chatService.createMessage({
      senderId: new mongoose.Types.ObjectId(),
      senderName: 'Test',
      realSenderId: new mongoose.Types.ObjectId(),
      message: 'Hello public',
      chatType: 'public',
      chatId: 'public-chat'
    });
    expect(msg.message).toBe('Hello public');
    expect(msg.chatType).toBe('public');
  });

  it('should reject empty message', async () => {
    await expect(chatService.createMessage({
      senderId: new mongoose.Types.ObjectId(),
      senderName: 'Test',
      realSenderId: new mongoose.Types.ObjectId(),
      message: '',
      chatType: 'public',
      chatId: 'public-chat'
    })).rejects.toThrow('Message cannot be empty');
  });

  it('should reject message exceeding 2000 chars', async () => {
    await expect(chatService.createMessage({
      senderId: new mongoose.Types.ObjectId(),
      senderName: 'Test',
      realSenderId: new mongoose.Types.ObjectId(),
      message: 'x'.repeat(2001),
      chatType: 'public',
      chatId: 'public-chat'
    })).rejects.toThrow('Message exceeds maximum length');
  });

  it('should enforce 500 char limit for anonymous', async () => {
    await expect(chatService.createMessage({
      senderId: new mongoose.Types.ObjectId(),
      senderName: 'Anonymous',
      realSenderId: new mongoose.Types.ObjectId(),
      message: 'x'.repeat(501),
      chatType: 'anonymous',
      chatId: 'anonymous-chat'
    })).rejects.toThrow('Message exceeds maximum length');
  });

  it('should generate anonymous name', async () => {
    const userId = new mongoose.Types.ObjectId();
    const msg = await chatService.createMessage({
      senderId: userId,
      senderName: 'Real Name',
      realSenderId: userId,
      message: 'Anonymous test',
      chatType: 'anonymous',
      chatId: 'anonymous-chat'
    });
    expect(msg.senderName).toMatch(/^Anonymous #\d+$/);
  });

  it('should create DM and update conversation', async () => {
    const user1 = new mongoose.Types.ObjectId();
    const user2 = new mongoose.Types.ObjectId();
    const sorted = [String(user1), String(user2)].sort();
    const chatId = `dm:${sorted[0]}:${sorted[1]}`;

    await Conversation.findOrCreateDM(user1, user2);

    const msg = await chatService.createMessage({
      senderId: user1,
      senderName: 'User1',
      realSenderId: user1,
      message: 'Hello DM',
      chatType: 'private',
      chatId,
      recipientId: user2
    });

    expect(msg.message).toBe('Hello DM');
    expect(msg.chatType).toBe('private');

    const conv = await Conversation.findOne({ chatId });
    expect(conv.lastMessage.content).toBe('Hello DM');
    expect(conv.unreadCount.get(String(user2))).toBe(1);
  });
});

describe('chatService.getMessages', () => {
  it('should return empty array for empty chat', async () => {
    const result = await chatService.getMessages('nonexistent');
    expect(result.messages).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it('should return messages in ascending order', async () => {
    const senderId = new mongoose.Types.ObjectId();
    for (let i = 0; i < 5; i++) {
      await Chat.create({
        senderId,
        senderName: 'Test',
        realSenderId: senderId,
        message: `Message ${i}`,
        chatType: 'public',
        chatId: 'test-chat'
      });
    }
    const result = await chatService.getMessages('test-chat', { limit: 50 });
    expect(result.messages).toHaveLength(5);
    expect(result.messages[0].message).toBe('Message 0');
    expect(result.messages[4].message).toBe('Message 4');
  });

  it('should support cursor pagination with "before"', async () => {
    const senderId = new mongoose.Types.ObjectId();
    const created = [];
    for (let i = 0; i < 10; i++) {
      const chat = await Chat.create({
        senderId,
        senderName: 'Test',
        realSenderId: senderId,
        message: `Message ${i}`,
        chatType: 'public',
        chatId: 'pagination-test'
      });
      created.push(chat);
    }

    const midPoint = created[4].createdAt;
    const result = await chatService.getMessages('pagination-test', {
      limit: 50,
      before: midPoint
    });
    expect(result.messages.length).toBeGreaterThan(0);
    result.messages.forEach(m => {
      expect(new Date(m.createdAt).getTime()).toBeLessThan(new Date(midPoint).getTime());
    });
  });

  it('should limit results', async () => {
    const senderId = new mongoose.Types.ObjectId();
    for (let i = 0; i < 10; i++) {
      await Chat.create({
        senderId,
        senderName: 'Test',
        realSenderId: senderId,
        message: `Message ${i}`,
        chatType: 'public',
        chatId: 'limit-test'
      });
    }
    const result = await chatService.getMessages('limit-test', { limit: 3 });
    expect(result.messages).toHaveLength(3);
    expect(result.hasMore).toBe(true);
  });
});

describe('chatService.markDelivered', () => {
  it('should update status to delivered', async () => {
    const chat = await Chat.create({
      senderId: new mongoose.Types.ObjectId(),
      senderName: 'Test',
      realSenderId: new mongoose.Types.ObjectId(),
      message: 'Deliver me',
      chatType: 'public',
      chatId: 'delivery-test'
    });

    await chatService.markDelivered(chat._id);
    const updated = await Chat.findById(chat._id);
    expect(updated.status).toBe('delivered');
    expect(updated.deliveredAt).toBeDefined();
  });
});

describe('chatService.markRead', () => {
  it('should mark all unread messages as read', async () => {
    const sender = new mongoose.Types.ObjectId();
    const recipient = new mongoose.Types.ObjectId();
    const sorted = [String(sender), String(recipient)].sort();
    const chatId = `dm:${sorted[0]}:${sorted[1]}`;

    await Conversation.findOrCreateDM(sender, recipient);

    for (let i = 0; i < 3; i++) {
      await Chat.create({
        senderId: sender,
        senderName: 'Sender',
        realSenderId: sender,
        message: `Message ${i}`,
        chatType: 'private',
        chatId,
        recipientId: recipient,
        status: 'sent'
      });
    }

    await chatService.markRead(chatId, recipient);
    const messages = await Chat.find({ chatId, recipientId: recipient });
    messages.forEach(m => {
      expect(m.status).toBe('read');
      expect(m.readAt).toBeDefined();
    });
  });
});

describe('chatService.deleteMessage', () => {
  it('should soft delete own message', async () => {
    const userId = new mongoose.Types.ObjectId();
    const chat = await Chat.create({
      senderId: userId,
      senderName: 'Test',
      realSenderId: userId,
      message: 'Delete me',
      chatType: 'public',
      chatId: 'delete-test'
    });

    await chatService.deleteMessage(chat._id, userId);
    const updated = await Chat.findById(chat._id);
    expect(updated.isDeleted).toBe(true);
    expect(updated.deletedAt).toBeDefined();
    expect(String(updated.deletedBy)).toBe(String(userId));
  });

  it('should allow admin to delete others messages', async () => {
    const owner = new mongoose.Types.ObjectId();
    const admin = new mongoose.Types.ObjectId();
    const chat = await Chat.create({
      senderId: owner,
      senderName: 'Test',
      realSenderId: owner,
      message: 'Admin delete me',
      chatType: 'public',
      chatId: 'admin-delete'
    });

    await chatService.deleteMessage(chat._id, admin, true);
    const updated = await Chat.findById(chat._id);
    expect(updated.isDeleted).toBe(true);
  });

  it('should reject delete by non-owner without admin', async () => {
    const owner = new mongoose.Types.ObjectId();
    const other = new mongoose.Types.ObjectId();
    const chat = await Chat.create({
      senderId: owner,
      senderName: 'Test',
      realSenderId: owner,
      message: 'Protected',
      chatType: 'public',
      chatId: 'protected'
    });

    await expect(chatService.deleteMessage(chat._id, other))
      .rejects.toThrow('Not authorized');
  });
});

describe('chatService.editMessage', () => {
  it('should edit message within 15 minutes', async () => {
    const userId = new mongoose.Types.ObjectId();
    const chat = await Chat.create({
      senderId: userId,
      senderName: 'Test',
      realSenderId: userId,
      message: 'Original',
      chatType: 'public',
      chatId: 'edit-test'
    });

    const edited = await chatService.editMessage(chat._id, userId, 'Edited!');
    expect(edited.message).toBe('Edited!');
    expect(edited.editedAt).toBeDefined();
  });

  it('should reject edit of deleted message', async () => {
    const userId = new mongoose.Types.ObjectId();
    const chat = await Chat.create({
      senderId: userId,
      senderName: 'Test',
      realSenderId: userId,
      message: 'Will be deleted',
      chatType: 'public',
      chatId: 'edit-deleted'
    });
    chat.isDeleted = true;
    await chat.save();

    await expect(chatService.editMessage(chat._id, userId, 'New'))
      .rejects.toThrow('Cannot edit a deleted message');
  });

  it('should reject edit by non-owner', async () => {
    const owner = new mongoose.Types.ObjectId();
    const other = new mongoose.Types.ObjectId();
    const chat = await Chat.create({
      senderId: owner,
      senderName: 'Test',
      realSenderId: owner,
      message: 'Original',
      chatType: 'public',
      chatId: 'edit-other'
    });

    await expect(chatService.editMessage(chat._id, other, 'Hacked!'))
      .rejects.toThrow('Not authorized');
  });
});

describe('chatService.getUnreadCounts', () => {
  it('should return total unread counts', async () => {
    const user1 = new mongoose.Types.ObjectId();
    const user2 = new mongoose.Types.ObjectId();
    const sorted = [String(user1), String(user2)].sort();
    const chatId = `dm:${sorted[0]}:${sorted[1]}`;

    await Conversation.findOrCreateDM(user1, user2);

    for (let i = 0; i < 3; i++) {
      await Chat.create({
        senderId: user1,
        senderName: 'User1',
        realSenderId: user1,
        message: `Msg ${i}`,
        chatType: 'private',
        chatId,
        recipientId: user2
      });
      await Conversation.incrementUnread(chatId, user2);
    }

    const result = await chatService.getUnreadCounts(user2);
    expect(result.totalUnread).toBe(3);
    expect(result.conversations).toHaveLength(1);
  });
});
