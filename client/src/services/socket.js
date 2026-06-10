import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.MODE === 'production' ? 'https://afit-chat-server.onrender.com' : 'http://localhost:5000');

let socketInstance = null;
let connectionStatus = 'disconnected';
let pendingMessages = new Map();
let roomListeners = new Map();
let statusListeners = [];

export const socket = {
  on: (event, callback) => {
    if (socketInstance) socketInstance.on(event, callback);
  },
  off: (event, callback) => {
    if (socketInstance) {
      if (callback) socketInstance.off(event, callback);
      else socketInstance.off(event);
    }
  },
  emit: (event, data, callback) => {
    if (socketInstance) {
      if (callback) socketInstance.emit(event, data, callback);
      else socketInstance.emit(event, data);
    }
  },
  id: null
};

const notifyStatusListeners = (status) => {
  connectionStatus = status;
  statusListeners.forEach(fn => fn(status));
};

export const onConnectionStatusChange = (fn) => {
  statusListeners.push(fn);
  return () => {
    statusListeners = statusListeners.filter(f => f !== fn);
  };
};

export const getConnectionStatus = () => connectionStatus;

const processPendingMessages = () => {
  if (pendingMessages.size === 0) return;
  const entries = [...pendingMessages.entries()];
  entries.forEach(([tempId, pending]) => {
    if (pending.retryCount < 2) {
      pending.retryCount += 1;
      socket.emit('sendMessage', {
        chatId: pending.chatId,
        message: pending.message,
        replyTo: pending.replyTo,
        tempId
      }, (response) => {
        if (response?.success) {
          pendingMessages.delete(tempId);
          if (pending.onSent) pending.onSent(response.messageId);
        } else if (pending.retryCount >= 2) {
          pendingMessages.delete(tempId);
          if (pending.onFailed) pending.onFailed();
        }
      });
    } else {
      pendingMessages.delete(tempId);
      if (pending.onFailed) pending.onFailed();
    }
  });
};

export const connectSocket = () => {
  if (socketInstance && socketInstance.connected) return;

  if (socketInstance) {
    socketInstance.connect();
    return;
  }

  notifyStatusListeners('connecting');

  socketInstance = io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5
  });

  socket.on = (event, callback) => socketInstance.on(event, callback);
  socket.off = (event, callback) => {
    if (callback) socketInstance.off(event, callback);
    else socketInstance.off(event);
  };
  socket.emit = (event, data, callback) => {
    if (callback) socketInstance.emit(event, data, callback);
    else socketInstance.emit(event, data);
  };

  socketInstance.on('connect', () => {
    socket.id = socketInstance.id;
    notifyStatusListeners('connected');
    processPendingMessages();
  });

  socketInstance.on('disconnect', (reason) => {
    socket.id = null;
    notifyStatusListeners('disconnected');
  });

  socketInstance.on('reconnecting', (attempt) => {
    notifyStatusListeners('reconnecting');
  });

  socketInstance.on('reconnect', () => {
    socket.id = socketInstance.id;
    notifyStatusListeners('connected');
    processPendingMessages();
  });

  socketInstance.on('connect_error', (error) => {
    notifyStatusListeners('disconnected');
  });
};

export const joinRoom = (chatId) => {
  return new Promise((resolve, reject) => {
    if (!socketInstance || !socketInstance.connected) {
      resolve();
      return;
    }
    socket.emit('joinChat', { chatId }, (response) => {
      if (response?.success) {
        resolve();
      } else {
        reject(new Error(response?.error || 'Failed to join room'));
      }
    });
    setTimeout(() => resolve(), 5000);
  });
};

export const leaveRoom = (chatId) => {
  if (socketInstance) {
    socket.emit('leaveChat', { chatId });
  }
};

export const sendMessageSocket = ({ chatId, message, replyTo, tempId, onSent, onFailed }) => {
  const id = tempId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  pendingMessages.set(id, {
    chatId,
    message,
    replyTo,
    retryCount: 0,
    onSent,
    onFailed
  });

  if (socketInstance && socketInstance.connected) {
    socket.emit('sendMessage', { chatId, message, replyTo, tempId: id }, (response) => {
      if (response?.success) {
        pendingMessages.delete(id);
        if (onSent) onSent(response.messageId);
      } else if (response?.error) {
        pendingMessages.delete(id);
        if (onFailed) onFailed(response.error);
      }
    });

    setTimeout(() => {
      const pending = pendingMessages.get(id);
      if (pending && pending.retryCount === 0) {
        pending.retryCount = 1;
        socket.emit('sendMessage', { chatId, message, replyTo, tempId: id }, (response) => {
          if (response?.success) {
            pendingMessages.delete(id);
            if (onSent) onSent(response.messageId);
          } else {
            pendingMessages.delete(id);
            if (onFailed) onFailed(response?.error || 'Timeout');
          }
        });
      }
    }, 5000);
  }

  return id;
};

export const listenToMessages = (callback) => {
  if (!socketInstance) return () => {};
  socketInstance.on('newMessage', callback);
  return () => { socketInstance.off('newMessage', callback); };
};

export const listenToDelivery = (callback) => {
  if (!socketInstance) return () => {};
  socketInstance.on('messageDelivered', callback);
  return () => { socketInstance.off('messageDelivered', callback); };
};

export const listenToReadReceipts = (callback) => {
  if (!socketInstance) return () => {};
  socketInstance.on('messagesRead', callback);
  return () => { socketInstance.off('messagesRead', callback); };
};

export const listenToTyping = (callback) => {
  if (!socketInstance) return () => {};
  socketInstance.on('typing', callback);
  return () => { socketInstance.off('typing', callback); };
};

export const listenToMessageDeleted = (callback) => {
  if (!socketInstance) return () => {};
  socketInstance.on('messageDeleted', callback);
  return () => { socketInstance.off('messageDeleted', callback); };
};

export const listenToMessageEdited = (callback) => {
  if (!socketInstance) return () => {};
  socketInstance.on('messageEdited', callback);
  return () => { socketInstance.off('messageEdited', callback); };
};

export const listenToMissedMessages = (callback) => {
  if (!socketInstance) return () => {};
  socketInstance.on('missedMessages', callback);
  return () => { socketInstance.off('missedMessages', callback); };
};

export const setSocketUser = (userId) => {
  if (socketInstance && socketInstance.connected) {
    socket.emit('userConnected', { userId });
  }
};

export const disconnectSocket = () => {
  if (socketInstance) {
    pendingMessages.clear();
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
    socket.id = null;
    socket.on = (event, callback) => {};
    socket.off = (event, callback) => {};
    socket.emit = (event, data, callback) => {};
    notifyStatusListeners('disconnected');
  }
};

export const emitTyping = (chatId, isTyping) => {
  socket.emit('typing', { chatId, isTyping });
};

export const emitMarkRead = (chatId) => {
  socket.emit('markRead', { chatId });
};

export const emitDeleteMessage = (messageId) => {
  socket.emit('deleteMessage', { messageId });
};

export const emitEditMessage = (messageId, newContent) => {
  socket.emit('editMessage', { messageId, newContent });
};

export const isSocketConnected = () => {
  return !!(socketInstance && socketInstance.connected);
};

const socketExport = {
  connectSocket, disconnectSocket, joinRoom, leaveRoom,
  sendMessageSocket, isSocketConnected, setSocketUser, socket,
  listenToMessages, listenToDelivery, listenToReadReceipts,
  listenToTyping, listenToMessageDeleted, listenToMessageEdited,
  listenToMissedMessages, onConnectionStatusChange, getConnectionStatus,
  emitTyping, emitMarkRead, emitDeleteMessage, emitEditMessage
};

export default socketExport;
