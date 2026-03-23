import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { socket } from '../services/socket';
import { useAuth } from './AuthContext';

export const OnlineUsersContext = createContext();

export const OnlineUsersProvider = ({ children }) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const isUserOnline = useCallback((targetUserId) => {
    if (!targetUserId) return false;
    if (!Array.isArray(onlineUsers)) return false;
    const targetStr = String(targetUserId).trim();
    return onlineUsers.map(id => String(id).trim()).includes(targetStr);
  }, [onlineUsers]);

  const incrementNotification = useCallback(() => {
    setNotificationCount(prev => (typeof prev === 'number' ? prev + 1 : 1));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotificationCount(0);
  }, []);

  useEffect(() => {
    if (!user) {
      setOnlineUsers([]);
      setNotificationCount(0);
      return;
    }

    socket.emit('getOnlineUsers');

    const handleOnlineUsersList = (data) => {
      if (!data) return;
      const userIds = Array.isArray(data) ? data : (data.userIds || []);
      const userIdStr = String(user._id);
      const filtered = userIds
        .filter(id => id && String(id).trim() !== userIdStr.trim())
        .map(id => String(id).trim());
      setOnlineUsers(filtered);
    };

    const handleUserOnline = (data) => {
      if (!data) return;
      const onlineId = String(data.userId || data).trim();
      const userIdStr = String(user._id).trim();
      if (onlineId && onlineId !== userIdStr) {
        setOnlineUsers(prev => {
          if (!Array.isArray(prev)) return [onlineId];
          if (prev.some(id => String(id).trim() === onlineId)) return prev;
          return [...prev, onlineId];
        });
      }
    };

    const handleUserOffline = (data) => {
      if (!data) return;
      const offlineId = String(data.userId || data).trim();
      setOnlineUsers(prev => {
        if (!Array.isArray(prev)) return [];
        return prev.filter(id => String(id).trim() !== offlineId);
      });
    };

    const handleNewMessageNotification = (data) => {
      if (!data) return;
      if (data.chatType === 'private' && data.recipientId) {
        const recipientId = String(data.recipientId).trim();
        if (recipientId === String(user._id).trim()) {
          incrementNotification();
        }
      }
    };

    socket.on('onlineUsersList', handleOnlineUsersList);
    socket.on('userOnline', handleUserOnline);
    socket.on('userOffline', handleUserOffline);
    socket.on('newMessageNotification', handleNewMessageNotification);

    return () => {
      socket.off('onlineUsersList', handleOnlineUsersList);
      socket.off('userOnline', handleUserOnline);
      socket.off('userOffline', handleUserOffline);
      socket.off('newMessageNotification', handleNewMessageNotification);
    };
  }, [user, incrementNotification]);

  return (
    <OnlineUsersContext.Provider
      value={{
        onlineUsers,
        isUserOnline,
        notificationCount,
        incrementNotification,
        clearNotifications
      }}
    >
      {children}
    </OnlineUsersContext.Provider>
  );
};

export const useOnlineUsers = () => {
  const context = useContext(OnlineUsersContext);
  if (!context) {
    throw new Error('useOnlineUsers must be used within an OnlineUsersProvider');
  }
  return context;
};
