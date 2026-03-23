/* eslint-disable */
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { socket } from '../services/socket';
import { useAuth } from './AuthContext';

export const NotificationContext = createContext();

const STORAGE_KEY = 'afit_unread_messages';

const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveToStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save unread messages to storage:', e);
  }
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState({});
  const [currentChatPartner, setCurrentChatPartner] = useState(null);

  useEffect(() => {
    if (user?._id) {
      const stored = loadFromStorage();
      setUnreadMessages(stored);
    } else {
      setUnreadMessages({});
    }
  }, [user?._id]);

  useEffect(() => {
    if (Object.keys(unreadMessages).length > 0) {
      saveToStorage(unreadMessages);
    }
  }, [unreadMessages]);

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
      const updated = { ...prev, [sid]: current + 1 };
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const decrementUnread = useCallback((senderId) => {
    if (!senderId) return;
    const sid = String(senderId);
    setUnreadMessages((prev) => {
      if (!prev || typeof prev !== 'object') return {};
      const newUnread = { ...prev };
      if (newUnread[sid] && newUnread[sid] > 0) {
        newUnread[sid] -= 1;
        if (newUnread[sid] <= 0) {
          delete newUnread[sid];
        }
      }
      saveToStorage(newUnread);
      return newUnread;
    });
  }, []);

  const clearUnread = useCallback((senderId) => {
    if (!senderId) return;
    const sid = String(senderId);
    setUnreadMessages((prev) => {
      if (!prev || typeof prev !== 'object') return {};
      const newUnread = { ...prev };
      delete newUnread[sid];
      saveToStorage(newUnread);
      return newUnread;
    });
  }, []);

  const clearAllUnread = useCallback(() => {
    setUnreadMessages({});
    saveToStorage({});
  }, []);

  const setCurrentChatPartnerWithClear = useCallback((partner) => {
    setCurrentChatPartner(partner);
    if (partner?._id) {
      clearUnread(partner._id);
    }
  }, [clearUnread]);

  useEffect(() => {
    if (!user) {
      setUnreadMessages({});
      return;
    }

    const handleReceiveMessage = (data) => {
      if (!data || !data.senderId) return;
      
      const senderId = String(data.senderId);
      const currentUserId = String(user._id);
      const isSelfMessage = senderId === currentUserId;
      const isCurrentChat = currentChatPartner && String(currentChatPartner._id) === senderId;
      
      if (!isSelfMessage && !isCurrentChat) {
        incrementUnread(senderId);
      }
    };

    const handleNewMessageNotification = (data) => {
      if (!data || !data.senderId) return;
      
      const senderId = String(data.senderId);
      const currentUserId = String(user._id);
      const isSelfMessage = senderId === currentUserId;
      const isCurrentChat = currentChatPartner && String(currentChatPartner._id) === senderId;
      
      if (!isSelfMessage && !isCurrentChat) {
        incrementUnread(senderId);
      }
    };

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('newMessageNotification', handleNewMessageNotification);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('newMessageNotification', handleNewMessageNotification);
    };
  }, [user, currentChatPartner, incrementUnread]);

  return (
    <NotificationContext.Provider
      value={{
        unreadMessages,
        getUnreadCount,
        getTotalUnread,
        incrementUnread,
        decrementUnread,
        clearUnread,
        clearAllUnread,
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
    throw new Error('useNotifications must be used within an NotificationProvider');
  }
  return context;
};
