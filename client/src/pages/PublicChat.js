/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';
import axios from 'axios';
import { socket, connectSocket, joinRoom, leaveRoom, sendMessageSocket } from '../services/socket';
import { Button, Card } from '../components/UI';
import { CornerUpLeft, X, Pin, Trash2 } from 'lucide-react';

const PUBLIC_CHAT_ID = 'public-chat';

const PINNED_MESSAGES = [
  { id: 'pinned-1', message: 'Welcome to AFIT Chat! Please be respectful to all users.', senderName: 'Admin', time: 'Always' },
  { id: 'pinned-2', message: 'Reminder: Check the Education Hub for course materials and study resources.', senderName: 'Admin', time: 'Always' }
];

const PublicChat = () => {
  const { user } = useAuth();
  const { darkMode } = useContext(ThemeContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const LIMIT = 50;

  const fetchMessages = useCallback(async (isInitial = true) => {
    if (isInitial) {
      setLoading(true);
    }
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
            if (!exists) {
              return [...prev, message];
            }
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
    if (!loading && messages.length > 0) {
      scrollToBottom();
    }
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

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

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
        <div 
          key={msg._id || index} 
          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
        >
          <div className={`max-w-[80%] md:max-w-lg rounded-2xl px-3 md:px-4 py-2 ${
            darkMode ? 'bg-slate-800/50 text-slate-500' : 'bg-gray-100 text-gray-400'
          }`}>
            <p className="text-sm italic">This message was deleted</p>
          </div>
        </div>
      );
    }

    const senderName = msg.senderId?.name || msg.senderName || 'Anonymous';
    const timestamp = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const handleMessageClick = () => {
      setActiveMenu(isMenuOpen ? null : msg._id);
    };

    const handleReply = () => {
      handleSetReply(msg);
      setActiveMenu(null);
    };

    const handleDelete = () => {
      handleDeleteMessage(msg._id);
      setActiveMenu(null);
    };

    return (
      <div 
        key={msg._id || index} 
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} relative`}
      >
        <div 
          className={`max-w-[85%] md:max-w-lg rounded-2xl px-3 md:px-4 py-2 cursor-pointer transition-all ${
            isMenuOpen 
              ? (isOwn 
                  ? (darkMode ? 'ring-2 ring-blue-400 shadow-lg shadow-blue-500/30' : 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/30')
                  : (darkMode ? 'ring-2 ring-slate-400 shadow-lg shadow-slate-500/30' : 'ring-2 ring-gray-400 shadow-lg shadow-gray-500/30'))
              : ''
          } ${
            isOwn 
              ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
              : (darkMode ? 'bg-slate-700 text-slate-100' : 'bg-gray-200 text-gray-900')
          }`}
          onClick={handleMessageClick}
        >
          {!isOwn && (
            <p className={`text-xs font-semibold mb-1 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
              {senderName}
            </p>
          )}
          
          {msg.replyToMessage && (
            <div className={`mb-2 p-2 rounded-lg text-xs ${
              isOwn 
                ? 'bg-blue-700/50 text-blue-100' 
                : (darkMode ? 'bg-slate-600/50 text-slate-300' : 'bg-gray-300/50 text-gray-600')
            }`}>
              <div className="flex items-center gap-1 mb-0.5">
                <CornerUpLeft className="w-3 h-3" />
                <span className="font-medium">{msg.replyToSender || 'Unknown'}</span>
              </div>
              <p className="truncate opacity-80">{msg.replyToMessage}</p>
            </div>
          )}
          
          <p className="text-sm md:text-base break-words">{msg.message}</p>
          <span className={`text-[10px] md:text-xs opacity-70 float-right ml-2 ${
            isOwn ? 'text-blue-100' : (darkMode ? 'text-slate-400' : 'text-gray-500')
          }`}>
            {timestamp}
          </span>
        </div>

        {isMenuOpen && (
          <div 
            ref={menuRef}
            className="absolute -top-12 right-0 z-50 flex items-center gap-3 p-2 rounded-xl backdrop-blur-md bg-slate-900/90 shadow-xl animate-in fade-in zoom-in-95 duration-100 border border-white/10"
          >
            <button
              onClick={(e) => { e.stopPropagation(); handleReply(); }}
              className="p-2 rounded-lg transition-all hover:bg-blue-500/30 text-blue-400"
            >
              <CornerUpLeft className="w-4 h-4" />
            </button>
            {isOwn && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                className="p-2 rounded-lg transition-all hover:bg-red-500/30 text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="px-4 md:px-6 max-w-3xl mx-auto">
        <Card padding="none" className="overflow-hidden">
          <div className={`p-4 md:p-6 border-b ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
            <h2 className={`text-lg md:text-xl font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>Public Chat</h2>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Chat with everyone on campus</p>
          </div>
          <div className={`h-[32rem] flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mx-auto" />
              <p className={`mt-4 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Loading messages...</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 md:px-6 max-w-3xl mx-auto">
        <Card padding="none" className="overflow-hidden">
          <div className={`p-4 md:p-6 border-b ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
            <h2 className={`text-lg md:text-xl font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>Public Chat</h2>
          </div>
          <div className={`h-[32rem] flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
            <div className="text-center">
              <p className="text-red-500 mb-4 text-sm md:text-base">{error}</p>
              <Button onClick={() => fetchMessages(true)}>Retry</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 max-w-3xl mx-auto">
      <Card padding="none" className="overflow-hidden">
        {/* Header */}
        <div className={`p-4 md:p-6 border-b ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg md:text-xl font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>Public Chat</h2>
              <p className={`text-xs md:text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Chat with everyone on campus</p>
            </div>
            <button
              onClick={() => setShowPinned(!showPinned)}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1 transition-all ${
                showPinned 
                  ? (darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')
                  : (darkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500')
              }`}
            >
              <Pin className="w-4 h-4" />
              {showPinned ? 'Hide' : 'Show'} Pins
            </button>
          </div>
        </div>

        {/* Pinned Messages */}
        {showPinned && PINNED_MESSAGES.length > 0 && (
          <div className={`p-3 md:p-4 border-b ${darkMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Pin className={`w-4 h-4 ${darkMode ? 'text-amber-400' : 'text-amber-500'}`} />
              <span className={`text-xs font-semibold ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>Pinned Messages</span>
            </div>
            <div className="space-y-2">
              {PINNED_MESSAGES.map(pin => (
                <div key={pin.id} className={`p-2 rounded-lg text-sm ${darkMode ? 'bg-white/5' : 'bg-white'}`}>
                  <p className={darkMode ? 'text-slate-200' : 'text-gray-700'}>{pin.message}</p>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                    - {pin.senderName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className={`h-[calc(100vh-320px)] md:h-[32rem] overflow-y-auto p-3 md:p-4 ${darkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className={`w-12 h-12 md:w-16 md:h-16 mx-auto ${darkMode ? 'text-slate-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className={`mt-4 text-sm md:text-base ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>No messages yet. Start the conversation!</p>
              </div>
            </div>
          ) : (
            <>
              {hasMore && (
                <div className="text-center mb-3 md:mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadOlderMessages}
                    disabled={loadingMore}
                    className="text-xs md:text-sm"
                  >
                    {loadingMore ? 'Loading...' : 'View Older Messages'}
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {messages.map(renderMessage)}
              </div>
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className={`p-3 md:p-4 border-t ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
          {replyingTo && (
            <div className={`mb-2 p-2 rounded-lg flex items-center gap-2 ${
              darkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-200'
            }`}>
              <CornerUpLeft className={`w-4 h-4 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} />
              <span className={`text-sm flex-1 truncate ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                Replying to: {replyingTo.senderName}
              </span>
              <button
                type="button"
                onClick={handleCancelReply}
                className={`p-1 rounded-full hover:bg-white/10 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}
              >
                <X className="w-4 h-4" />
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
              className={`flex-1 px-3 md:px-4 py-2 md:py-2.5 rounded-lg border text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-gray-50 border-gray-200'}`}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim()}
              className="px-4 md:px-6 text-sm"
            >
              Send
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default PublicChat;
