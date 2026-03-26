import { chatAPI } from './api';
import { io } from 'socket.io-client';

let socketInstance = null;
let connected = false;
let currentRoom = null;
let currentUserId = null;

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 
  (process.env.NODE_ENV === 'production' ? 'https://afit-chat-server.onrender.com' : 'http://localhost:5000');

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
  console.log(`🔵 joinRoom called for: ${chatId}, connected: ${connected}, socketInstance: ${!!socketInstance}`);
  
  if (!socketInstance) {
    console.error('❌ socketInstance is null!');
    return;
  }
  
  currentRoom = chatId;
  
  if (connected) {
    console.log(`✅ Emitting joinChatRoom for: ${chatId}`);
    socketInstance.emit('joinChatRoom', { chatId });
  } else {
    console.warn(`⏳ Socket not connected yet, waiting...`);
    const handleConnect = () => {
      console.log(`✅ Socket connected, now joining: ${chatId}`);
      socketInstance.emit('joinChatRoom', { chatId });
      socketInstance.off('connect', handleConnect);
    };
    socketInstance.once('connect', handleConnect);
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
