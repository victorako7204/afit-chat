import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { socket } from '../services/socket';
import { useAuth } from './AuthContext';
import { chatAPI } from '../services/api';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState({});
  const [currentChatPartner, setCurrentChatPartner] = useState(null);

  const getUnreadCount = useCallback((senderId) => {
    if (!senderId || !unreadMessages) return 0;
    const count = unreadMessages[String(senderId)] || 0;
    return typeof count === 'number' ? count : 0;
  }, [unreadMessages]);

  const getTotalUnread = useCallback(() => {
    if (!unreadMessages || typeof unreadMessages !== 'object') return 0;
    return Object.values(unreadMessages).reduce((sum, count) => {
      return sum + (typeof count === 'number' ? count : 0);
    }, 0);
  }, [unreadMessages]);

  const incrementUnread = useCallback((senderId) => {
    if (!senderId) return;
    const sid = String(senderId);
    setUnreadMessages((prev) => {
      if (!prev || typeof prev !== 'object') return { [sid]: 1 };
      const current = prev[sid] || 0;
      return { ...prev, [sid]: current + 1 };
    });
  }, []);

  const clearUnread = useCallback((senderId) => {
    if (!senderId) return;
    const sid = String(senderId);
    setUnreadMessages((prev) => {
      if (!prev || typeof prev !== 'object') return {};
      const newUnread = { ...prev };
      delete newUnread[sid];
      return newUnread;
    });
  }, []);

  const clearAllUnread = useCallback(() => {
    setUnreadMessages({});
  }, []);

  const setCurrentChatPartnerWithClear = useCallback((partner) => {
    setCurrentChatPartner(partner);
    if (partner?._id) {
      clearUnread(partner._id);
    }
  }, [clearUnread]);

  const fetchUnreadFromServer = useCallback(async () => {
    if (!user?._id) return;
    try {
      const data = await chatAPI.getUnreadCount();
      if (typeof data?.data?.unreadCount === 'number') {
        setUnreadMessages({ serverCount: data.data.unreadCount });
      }
    } catch (error) {
    }
  }, [user?._id]);

  useEffect(() => {
    if (!user) {
      setUnreadMessages({});
      return;
    }
    fetchUnreadFromServer();
  }, [user, fetchUnreadFromServer]);

  useEffect(() => {
    if (!user) {
      setUnreadMessages({});
      return;
    }

    const handleReceiveMessage = (data) => {
      if (!data || !data.senderId) return;

      const senderId = String(data.senderId?._id || data.senderId);
      const currentUserId = String(user._id);
      const isSelfMessage = senderId === currentUserId;
      const isCurrentChat = currentChatPartner && String(currentChatPartner._id) === senderId;

      if (!isSelfMessage && !isCurrentChat) {
        incrementUnread(senderId);
      }
    };

    socket.on('newMessage', handleReceiveMessage);

    return () => {
      socket.off('newMessage', handleReceiveMessage);
    };
  }, [user, currentChatPartner, incrementUnread]);

  return (
    <NotificationContext.Provider
      value={{
        unreadMessages,
        getUnreadCount,
        getTotalUnread,
        incrementUnread,
        clearUnread,
        clearAllUnread,
        fetchUnreadFromServer,
        currentChatPartner,
        setCurrentChatPartner: setCurrentChatPartnerWithClear
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
