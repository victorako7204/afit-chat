import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { socket, connectSocket, joinRoom, leaveRoom, sendMessageSocket } from '../services/socket';
import { CornerUpLeft, X, Pin, Trash2, Send, Loader2, MessageCircle } from 'lucide-react';

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
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [showPinned, setShowPinned] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const LIMIT = 50;

  const fetchMessages = useCallback(async (isInitial = true) => {
    if (isInitial) setLoading(true);
    setError(null);

    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/chat/${PUBLIC_CHAT_ID}?limit=${LIMIT}&skip=0`
      );
      const { messages: fetchedMessages, pagination } = res.data;
      setMessages(fetchedMessages);
      setSkip(fetchedMessages.length);
      setHasMore(pagination.hasMore);
    } catch (err) {
      console.error('Error fetching messages:', err);
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
    fetchMessages(true);
    joinRoom(PUBLIC_CHAT_ID);

    const handleReceiveMessage = (message) => {
      if (message.chatId === PUBLIC_CHAT_ID) {
        const msgId = message._id || message.messageId;
        if (message.deleted) {
          setMessages(prev => prev.map(m =>
            m._id === msgId ? { ...m, deleted: true, message: '' } : m
          ));
        } else {
          setMessages((prev) => {
            const exists = prev.some(m => m._id === msgId);
            if (!exists) return [...prev, message];
            return prev;
          });
        }
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, deleted: true, message: '' } : m
      ));
    };

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('messageDeleted', handleMessageDeleted);

    return () => {
      leaveRoom(PUBLIC_CHAT_ID);
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('messageDeleted', handleMessageDeleted);
    };
  }, [fetchMessages]);

  useEffect(() => {
    if (!loading && messages.length > 0) scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeMenu && menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

  const loadOlderMessages = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/chat/${PUBLIC_CHAT_ID}?limit=${LIMIT}&skip=${skip}`
      );
      const { messages: olderMessages, pagination } = res.data;
      setMessages((prev) => [...olderMessages, ...prev]);
      setSkip(skip + olderMessages.length);
      setHasMore(pagination.hasMore);
    } catch (err) {
      console.error('Error loading older messages:', err);
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
    socket.emit('deleteMessage', {
      chatId: PUBLIC_CHAT_ID,
      messageId: msgId,
      userId: user._id
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const messageData = {
      chatId: PUBLIC_CHAT_ID,
      message: newMessage.trim(),
      chatType: 'public',
      senderId: user._id,
      senderName: user.name,
      replyTo: replyingTo?._id || null,
      replyToMessage: replyingTo?.message || null,
      replyToSender: replyingTo?.senderName || null
    };

    sendMessageSocket(messageData);
    setNewMessage('');
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  const renderMessage = (msg, index) => {
    const isOwn = String(msg.senderId?._id || msg.senderId) === String(user?._id);
    const isDeleted = msg.deleted;
    const isMenuOpen = activeMenu === msg._id;

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
          className={`max-w-[85%] rounded-2xl px-4 py-2 cursor-pointer transition-all ${isMenuOpen ? 'ring-2' : ''}`}
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
          <span className="text-[10px] opacity-70 float-right ml-2" style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
            {timestamp}
          </span>
        </div>

        {isMenuOpen && (
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
      {/* Header */}
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

      {/* Pinned Messages */}
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

      {/* Messages */}
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
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
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
            onChange={(e) => setNewMessage(e.target.value)}
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
