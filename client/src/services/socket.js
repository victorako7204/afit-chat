import { chatAPI } from './api';
import { io } from 'socket.io-client';

let socketInstance = null;
let connected = false;
let currentRoom = null;
let currentUserId = null;

// FIXED: Force production URL for ALL users (mobile + desktop)
const SOCKET_URL = 'https://afit-chat-server.onrender.com';

export const socket = {
  on: (event, callback) => {
    if (socketInstance) {
      socketInstance.on(event, callback);
    }
  },
  off: (event, callback) => {
    if (socketInstance) {
      if (callback) {
        socketInstance.off(event, callback);
      } else {
        socketInstance.off(event);
      }
    }
  },
  emit: (event, data) => {
    if (socketInstance) {
      socketInstance.emit(event, data);
    }
  }
};

export const connectSocket = (userId = null) => {
  if (typeof window === 'undefined') return;
  if (socketInstance && connected) return;
  
  if (userId) {
    currentUserId = userId;
  }

  try {
    console.log('🔌 Connecting to:', SOCKET_URL);
    
    const socketConfig = {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
      upgrade: true,
      timeout: 20000,
      withCredentials: true
    };
    
    socketInstance = io(SOCKET_URL, socketConfig);
    
    socketInstance.on('connect', () => {
      connected = true;
      console.log('✅ Socket connected:', socketInstance.id);
      
      if (currentUserId) {
        socketInstance.emit('userConnected', { userId: currentUserId });
      }
      
      if (currentRoom) {
        socketInstance.emit('joinChatRoom', { chatId: currentRoom });
      }
    });
    
    socketInstance.on('disconnect', (reason) => {
      connected = false;
      console.log('🔌 Socket disconnected:', reason);
    });
    
    socketInstance.on('connect_error', (error) => {
      connected = false;
      console.error('❌ Socket connection error:', error.message);
    });

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Socket reconnect attempt: ${attemptNumber}`);
    });

    socketInstance.on('reconnect', () => {
      connected = true;
      console.log('✅ Socket reconnected');
      
      if (currentUserId) {
        socketInstance.emit('userConnected', { userId: currentUserId });
      }
    });
    
    console.log('🔌 Attempting to connect...');
    
  } catch (error) {
    console.error('❌ Socket.io initialization error:', error);
    connected = false;
  }
};

export const setSocketUser = (userId) => {
  currentUserId = userId;
  if (socketInstance && connected) {
    socketInstance.emit('userConnected', { userId });
  }
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    connected = false;
    currentRoom = null;
    console.log('🔌 Socket manually disconnected');
  }
};

export const joinRoom = (chatId) => {
  if (socketInstance) {
    currentRoom = chatId;
    if (connected) {
      socketInstance.emit('joinChatRoom', { chatId });
    }
  }
};

export const leaveRoom = (chatId) => {
  if (socketInstance) {
    socketInstance.emit('leaveRoom', { chatId });
    if (currentRoom === chatId) {
      currentRoom = null;
    }
  }
};

export const sendMessageSocket = (data) => {
  if (socketInstance && connected) {
    socketInstance.emit('sendMessage', data);
  } else {
    chatAPI.sendMessage(data);
  }
};

export const isSocketConnected = () => connected;

const socketExport = {
  connectSocket,
  disconnectSocket,
  joinRoom,
  leaveRoom,
  sendMessageSocket,
  isSocketConnected,
  setSocketUser,
  socket
};

export default socketExport;
