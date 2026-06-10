import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { chatAPI } from '../services/api';
import {
  connectSocket, joinRoom, leaveRoom, sendMessageSocket,
  listenToMessages, listenToMessageDeleted, listenToMessageEdited,
  listenToTyping, emitTyping, emitDeleteMessage
} from '../services/socket';
import { CornerUpLeft, X, Pin, Trash2, Send, Loader2, MessageCircle, Check, CheckCheck } from 'lucide-react';

const PUBLIC_CHAT_ID = 'public-chat';

const PINNED_MESSAGES = [
  { id: 'pinned-1', message: 'Welcome to AFIT Chat! Please be respectful to all users.', senderName: 'Admin', time: 'Always' },
  { id: 'pinned-2', message: 'Reminder: Check the Education Hub for course materials and study resources.', senderName: 'Admin', time: 'Always' }
];

const PublicChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [showPinned, setShowPinned] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const LIMIT = 50;

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await chatAPI.getMessages(PUBLIC_CHAT_ID, LIMIT, 0);
      const data = res.data?.data || res.data;
      const fetchedMessages = data.messages || [];
      setMessages(fetchedMessages);
      setHasMore(data.hasMore ?? data.pagination?.hasMore ?? false);
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
    fetchMessages();
    joinRoom(PUBLIC_CHAT_ID);

    const handleNewMessage = (message) => {
      if (message.chatId === PUBLIC_CHAT_ID) {
        setMessages((prev) => {
          const exists = prev.some(m => m._id === message._id || m.tempId === message.tempId);
          if (!exists) return [...prev, message];
          return prev.map(m => (m.tempId === message.tempId && !m._id) ? { ...m, ...message, status: 'sent' } : m);
        });
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, isDeleted: true, message: '' } : m
      ));
    };

    const handleMessageEdited = ({ messageId, newContent, editedAt }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, message: newContent, editedAt } : m
      ));
    };

    const handleTyping = (data) => {
      if (data.chatId === PUBLIC_CHAT_ID && String(data.userId) !== String(user?._id)) {
        setTypingUsers(prev => ({ ...prev, [data.userId]: data }));
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUsers({});
        }, 3000);
      }
    };

    listenToMessages(handleNewMessage);
    listenToMessageDeleted(handleMessageDeleted);
    listenToMessageEdited(handleMessageEdited);
    listenToTyping(handleTyping);

    return () => {
      leaveRoom(PUBLIC_CHAT_ID);
    };
  }, [fetchMessages, user?._id]);

  useEffect(() => {
    if (!loading && messages.length > 0) scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const loadOlderMessages = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const res = await chatAPI.getMessages(PUBLIC_CHAT_ID, LIMIT, 0, oldest.createdAt);
      const { messages: olderMessages, hasMore: more } = res.data?.data || res.data;
      setMessages((prev) => [...(Array.isArray(olderMessages) ? olderMessages : []), ...prev]);
      setHasMore(more);
    } catch (err) {
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSetReply = (msg) => {
    setReplyingTo({
      _id: msg._id,
      message: msg.message,
      senderName: msg.senderName || msg.senderId?.name || 'Anonymous'
    });
    inputRef.current?.focus();
  };

  const handleCancelReply = () => setReplyingTo(null);

  const handleDeleteMessage = (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    emitDeleteMessage(msgId);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMsg = {
      _id: tempId,
      tempId,
      senderId: { _id: user._id, name: user.name },
      senderName: user.name,
      message: newMessage.trim(),
      chatType: 'public',
      chatId: PUBLIC_CHAT_ID,
      status: 'sending',
      createdAt: new Date().toISOString(),
      replyTo: replyingTo?._id || null,
      replyToMessage: replyingTo?.message || null,
      replyToSender: replyingTo?.senderName || null
    };

    setMessages(prev => [...prev, optimisticMsg]);

    sendMessageSocket({
      chatId: PUBLIC_CHAT_ID,
      message: newMessage.trim(),
      replyTo: replyingTo?._id || null,
      tempId,
      onSent: (messageId) => {
        setMessages(prev => prev.map(m =>
          m.tempId === tempId ? { ...m, _id: messageId, status: 'sent', tempId: undefined } : m
        ));
      },
      onFailed: () => {
        setMessages(prev => prev.map(m =>
          m.tempId === tempId ? { ...m, status: 'failed' } : m
        ));
      }
    });

    setNewMessage('');
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  const handleRetry = (msg) => {
    if (msg.status !== 'failed') return;
    const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setMessages(prev => prev.map(m =>
      m._id === msg._id ? { ...m, _id: tempId, tempId, status: 'sending' } : m
    ));
    sendMessageSocket({
      chatId: PUBLIC_CHAT_ID,
      message: msg.message,
      replyTo: msg.replyTo || null,
      tempId,
      onSent: (messageId) => {
        setMessages(prev => prev.map(m =>
          m.tempId === tempId ? { ...m, _id: messageId, status: 'sent', tempId: undefined } : m
        ));
      },
      onFailed: () => {
        setMessages(prev => prev.map(m =>
          m.tempId === tempId ? { ...m, status: 'failed' } : m
        ));
      }
    });
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    emitTyping(PUBLIC_CHAT_ID, e.target.value.length > 0);
  };

  const renderStatus = (status) => {
    if (status === 'sending') return <Loader2 size={12} className="animate-spin" style={{ color: 'rgba(255,255,255,0.6)' }} />;
    if (status === 'sent') return <Check size={12} style={{ color: 'rgba(255,255,255,0.6)' }} />;
    if (status === 'delivered') return <CheckCheck size={12} style={{ color: 'rgba(255,255,255,0.6)' }} />;
    if (status === 'read') return <CheckCheck size={12} style={{ color: '#53bdeb' }} />;
    return null;
  };

  const typingNow = Object.values(typingUsers).filter(t => t.isTyping && String(t.userId) !== String(user?._id));

  const renderMessage = (msg, index) => {
    const isOwn = String(msg.senderId?._id || msg.senderId) === String(user?._id);
    const isDeleted = msg.isDeleted;
    const isMenuOpen = activeMenu === msg._id;
    const isFailed = msg.status === 'failed';

    if (isDeleted) {
      return (
        <div key={msg._id || index} className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm italic" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
            This message was deleted
          </div>
        </div>
      );
    }

    const senderName = msg.senderId?.name || msg.senderName || 'Anonymous';
    const timestamp = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <div key={msg._id || index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} relative`}>
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-2 cursor-pointer transition-all ${isMenuOpen ? 'ring-2' : ''} ${isFailed ? 'opacity-70' : ''}`}
          style={{
            backgroundColor: isOwn ? 'var(--accent)' : 'var(--bg-secondary)',
            color: isOwn ? 'white' : 'var(--text-primary)',
            borderColor: isMenuOpen ? 'var(--accent)' : 'transparent'
          }}
          onClick={() => setActiveMenu(isMenuOpen ? null : msg._id)}
        >
          {!isOwn && (
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>{senderName}</p>
          )}

          {msg.replyToMessage && (
            <div className="mb-2 p-2 rounded-lg text-xs" style={{ backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : 'var(--bg-tertiary)' }}>
              <div className="flex items-center gap-1 mb-0.5">
                <CornerUpLeft size={12} />
                <span className="font-medium">{msg.replyToSender || 'Unknown'}</span>
              </div>
              <p className="truncate opacity-80">{msg.replyToMessage}</p>
            </div>
          )}

          <p className="text-sm break-words">{msg.message}</p>
          {msg.editedAt && <span className="text-[10px] opacity-50 mr-1">(edited)</span>}
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[10px]" style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
              {timestamp}
            </span>
            {isOwn && renderStatus(msg.status)}
          </div>
        </div>

        {isFailed && (
          <button
            onClick={() => handleRetry(msg)}
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--danger)', color: 'white' }}
          >
            Retry
          </button>
        )}

        {isMenuOpen && !isFailed && (
          <div
            ref={menuRef}
            className="absolute -top-12 right-0 z-50 flex items-center gap-2 p-1.5 rounded-xl"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); handleSetReply(msg); setActiveMenu(null); }}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--accent)' }}
            >
              <CornerUpLeft size={16} />
            </button>
            {isOwn && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg._id); setActiveMenu(null); }}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--danger)' }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-lg font-semibold">Public Chat</h2>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Chat with everyone on campus</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-lg font-semibold">Public Chat</h2>
        </div>
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button onClick={() => fetchMessages(true)} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 className="text-lg font-semibold">Public Chat</h2>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Chat with everyone on campus</p>
        </div>
        <button
          onClick={() => setShowPinned(!showPinned)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{
            backgroundColor: showPinned ? 'rgba(0,149,246,0.15)' : 'var(--bg-tertiary)',
            color: showPinned ? 'var(--accent)' : 'var(--text-secondary)'
          }}
        >
          <Pin size={14} />
          {showPinned ? 'Hide' : 'Show'} Pins
        </button>
      </div>

      {showPinned && (
        <div className="p-3" style={{ backgroundColor: 'rgba(255,193,7,0.08)', borderBottom: '1px solid rgba(255,193,7,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Pin size={14} style={{ color: '#ffc107' }} />
            <span className="text-xs font-semibold" style={{ color: '#ffc107' }}>Pinned Messages</span>
          </div>
          <div className="space-y-2">
            {PINNED_MESSAGES.map(pin => (
              <div key={pin.id} className="p-2 rounded-lg text-sm" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <p>{pin.message}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>- {pin.senderName}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageCircle size={48} style={{ color: 'var(--text-tertiary)' }} />
              <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          <>
            {hasMore && (
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
            {messages.map(renderMessage)}
            {typingNow.length > 0 && (
              <div className="flex justify-start">
                <div className="text-xs italic px-2 py-1" style={{ color: 'var(--text-tertiary)' }}>
                  {typingNow.map(t => t.userName).join(', ')} typing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="p-3" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)' }}>
        {replyingTo && (
          <div className="mb-2 p-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <CornerUpLeft size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
              Replying to: {replyingTo.senderName}
            </span>
            <button type="button" onClick={handleCancelReply} className="p-0.5 rounded-full" style={{ color: 'var(--text-tertiary)' }}>
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none' }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-4 py-2.5 rounded-xl transition-opacity"
            style={{ backgroundColor: 'var(--accent)', color: 'white', opacity: !newMessage.trim() ? 0.4 : 1 }}
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default PublicChat;
