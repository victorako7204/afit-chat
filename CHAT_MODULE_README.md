# AFIT Chat - Module 2: Reliable Chat System

## Socket.io Event Reference

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `joinChat` | `{ chatId }` | Join a chat room (public, dm:, group:) |
| `leaveChat` | `{ chatId }` | Leave a chat room |
| `sendMessage` | `{ chatId, message, replyTo?, tempId }` | Send a new message |
| `typing` | `{ chatId, isTyping }` | Typing indicator |
| `markRead` | `{ chatId }` | Mark all messages as read |
| `deleteMessage` | `{ messageId }` | Soft-delete a message |
| `editMessage` | `{ messageId, newContent }` | Edit a message (within 15min) |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `newMessage` | `{ ...message, tempId? }` | New message in a room |
| `messageSent` | `{ success, tempId, messageId }` | Confirmation of sent message |
| `messageDelivered` | `{ messageId }` | Message delivered to recipient |
| `messagesRead` | `{ userId, chatId }` | Messages read by user |
| `typing` | `{ userId, userName, isTyping, chatId }` | Typing status |
| `messageDeleted` | `{ messageId, chatId }` | Message was deleted |
| `messageEdited` | `{ messageId, chatId, newContent, editedAt }` | Message was edited |
| `missedMessages` | `{ messages, chatId }` | Messages received while offline |
| `joinedChat` | `{ success, chatId }` | Confirmation of room join |

## REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/chat/:chatId/messages` | Get paginated messages |
| POST | `/api/v1/chat/:chatId/messages` | Send a message |
| PUT | `/api/v1/chat/:chatId/read` | Mark chat as read |
| DELETE | `/api/v1/chat/messages/:messageId` | Delete a message |
| PUT | `/api/v1/chat/messages/:messageId` | Edit a message |
| GET | `/api/v1/chat/conversations` | Get all conversations |
| GET | `/api/v1/chat/unread` | Get unread counts |

## Testing

```bash
cd server
npm install
npm test -- --forceExit
```

## Reconnection Recovery

On reconnect:
1. User fetches all conversations
2. Joins all chat rooms
3. Queries for messages with `status: 'sent'` (not delivered) addressed to them
4. Marks them as `delivered`
5. Emits `missedMessages` event with the undelivered messages
