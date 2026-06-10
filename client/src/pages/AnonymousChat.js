import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatAPI } from '../services/api';
import {
  connectSocket, joinRoom, leaveRoom, sendMessageSocket,
  listenToMessages, listenToMessageDeleted, listenToMessageEdited
} from '../services/socket';
import { Send, Loader2, Trash2 } from 'lucide-react';

const AnonymousChat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatId = 'anonymous-chat';
  const LIMIT = 50;

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await chatAPI.getMessages(chatId, LIMIT, 0);
      const { messages: fetchedMessages, pagination } = res.data;
      setMessages(fetchedMessages || []);
      setHasMore(pagination?.hasMore || false);
    } catch (err) {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    connectSocket();
    joinRoom(chatId);
    fetchMessages();

    const handleNewMessage = (message) => {
      if (message.chatType === 'anonymous' && message.chatId === chatId) {
        setMessages((prev) => {
          const exists = prev.some(m => m._id === message._id || m.tempId === message.tempId);
          if (!exists) return [...prev, message];
          return prev.map(m => (m.tempId === message.tempId && !m._id) ? { ...m, ...message } : m);
        });
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, isDeleted: true, message: '' } : m
      ));
    };

    const cleanupMessages = listenToMessages(handleNewMessage);
    const cleanupDeleted = listenToMessageDeleted(handleMessageDeleted);

    return () => {
      cleanupMessages?.();
      cleanupDeleted?.();
      leaveRoom(chatId);
    };
  }, [fetchMessages]);

  useEffect(() => {
    if (!loading && messages.length > 0) scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const loadOlderMessages = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const res = await chatAPI.getMessages(chatId, LIMIT, 0, oldest.createdAt);
      const { messages: olderMessages, hasMore: more } = res.data?.data || res.data;
      setMessages((prev) => [...(Array.isArray(olderMessages) ? olderMessages : []), ...prev]);
      setHasMore(more);
    } catch (err) {
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    if (newMessage.trim().length > 500) {
      setError('Anonymous messages are limited to 500 characters');
      return;
    }

    const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const optimisticMsg = {
      _id: tempId,
      tempId,
      senderName: 'Anonymous Student',
      message: newMessage.trim(),
      chatType: 'anonymous',
      chatId,
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setSending(true);

    let settled = false;
    const safetyTimeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setMessages(prev => prev.map(m =>
          m.tempId === tempId ? { ...m, status: 'failed' } : m
        ));
        setSending(false);
      }
    }, 15000);

    sendMessageSocket({
      chatId,
      message: newMessage.trim(),
      tempId,
      onSent: (messageId) => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimeout);
        setMessages(prev => prev.map(m =>
          m.tempId === tempId ? { ...m, _id: messageId, status: 'sent', tempId: undefined } : m
        ));
        setSending(false);
      },
      onFailed: () => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimeout);
        setMessages(prev => prev.map(m =>
          m.tempId === tempId ? { ...m, status: 'failed' } : m
        ));
        setSending(false);
      }
    });

    setNewMessage('');
    inputRef.current?.focus();
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="text-lg font-semibold">Anonymous Chat</h2>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Share your thoughts freely. Your identity is protected.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="text-center py-2">
            <p style={{ color: 'var(--danger)' }} className="text-sm">{error}</p>
          </div>
        )}
        {hasMore && messages.length > 0 && (
          <div className="text-center mb-2">
            <button
              onClick={loadOlderMessages}
              disabled={loadingMore}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              {loadingMore ? 'Loading...' : 'View Older Messages'}
            </button>
          </div>
        )}
        {messages.map((msg, index) => {
          const isDeleted = msg.isDeleted;
          return (
            <div key={msg._id || index} className="flex justify-start">
              {isDeleted ? (
                <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm italic" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                  This message was deleted
                </div>
              ) : (
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-2"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <p className="text-xs font-semibold mb-1" style={{ color: '#ffc107' }}>
                    {msg.senderName || 'Anonymous Student'}
                  </p>
                  <p className="text-sm break-words">{msg.message}</p>
                  <span className="text-[10px] opacity-70 float-right ml-2 mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)' }}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Share something anonymously..."
            maxLength={500}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none' }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2.5 rounded-xl transition-opacity"
            style={{ backgroundColor: '#ffc107', color: 'black', opacity: !newMessage.trim() || sending ? 0.4 : 1 }}
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>500 character limit. 1 message per 3 seconds.</p>
      </form>
    </div>
  );
};

export default AnonymousChat;
