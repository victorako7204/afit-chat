/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOnlineUsers } from '../context/OnlineUsersContext';
import { useNotifications } from '../context/NotificationContext';
import { ThemeContext } from '../App';
import { authAPI } from '../services/api';
import { socket, connectSocket, joinRoom, sendMessageSocket } from '../services/socket';
import { Button, Card, Input, Modal } from '../components/UI';
import { CornerUpLeft, X, UserPlus, Search, Trash2 } from 'lucide-react';

const DirectChat = () => {
  const { user } = useAuth();
  const { isUserOnline } = useOnlineUsers();
  const { getUnreadCount, clearUnread, setCurrentChatPartner: setPartnerWithClear, fetchUnreadFromServer } = useNotifications();
  const { darkMode } = useContext(ThemeContext);
  const [activeConversations, setActiveConversations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showFindModal, setShowFindModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  const generateChatId = useCallback((userId1, userId2) => {
    const sorted = [String(userId1), String(userId2)].sort();
    return `dm-${sorted[0]}-${sorted[1]}`;
  }, []);

  const fetchActiveConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authAPI.getUsers();
      const userList = res.data.filter(u => String(u._id) !== String(user._id));
      
      const conversationsWithMessages = userList.filter(u => u.lastMessage || u.lastMessageAt);
      
      const sorted = [...conversationsWithMessages].sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });

      setActiveConversations(sorted);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  }, [user]);

  const fetchAllUsers = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authAPI.getUsers();
      const userList = res.data
        .filter(u => String(u._id) !== String(user._id))
        .map(u => ({
          ...u,
          hasConversation: activeConversations.some(conv => String(conv._id) === String(u._id))
        }));
      setAllUsers(userList);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, [user, activeConversations]);

  const addToActiveConversations = useCallback((userData) => {
    setActiveConversations(prev => {
      const exists = prev.some(u => String(u._id) === String(userData._id));
      if (exists) return prev;
      return [{
        ...userData,
        lastMessage: null,
        lastMessageAt: new Date().toISOString()
      }, ...prev];
    });
  }, []);

  const updateConversationInList = useCallback((targetId, messageText, timestamp, isSentByMe = false) => {
    setActiveConversations(prev => {
      const exists = prev.some(u => String(u._id) === String(targetId));
      if (!exists) return prev;
      
      const updated = prev.map(u => {
        if (String(u._id) === String(targetId)) {
          return {
            ...u,
            lastMessage: isSentByMe ? `You: ${messageText}` : messageText,
            lastMessageAt: timestamp || new Date().toISOString()
          };
        }
        return u;
      });
      return [...updated].sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
    });
  }, []);

  const handleSelectUser = useCallback((selectedUserData) => {
    setSelectedUser(selectedUserData);
    setPartnerWithClear(selectedUserData);
    setMessages([]);
    setLoading(true);
    setShowSidebar(false);
    setReplyingTo(null);
    
    const timeout = setTimeout(() => {
      console.warn('Chat history load timeout - messages may not load');
      setLoading(false);
    }, 5000);
    
    if (user && selectedUserData) {
      const chatId = generateChatId(user._id, selectedUserData._id);
      joinRoom(chatId);
      authAPI.clearUnread(chatId).catch(console.error);
    }
    
    return () => clearTimeout(timeout);
  }, [user, generateChatId, setPartnerWithClear]);

  const handleStartConversation = (userData) => {
    addToActiveConversations(userData);
    setShowFindModal(false);
    handleSelectUser(userData);
  };

  const handleSetReply = (msg) => {
    setReplyingTo({
      _id: msg._id,
      message: msg.message,
      senderName: msg.senderName || msg.senderId?.name || selectedUser?.name || 'User'
    });
    inputRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleDeleteMessage = (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    socket.emit('deleteMessage', {
      chatId: generateChatId(user._id, selectedUser._id),
      messageId: msgId,
      userId: user._id
    });
  };

  useEffect(() => {
    if (user?._id) {
      fetchActiveConversations();
      fetchAllUsers();
      fetchUnreadFromServer();
      connectSocket(user._id);
    }
  }, [user?._id, fetchActiveConversations, fetchAllUsers, fetchUnreadFromServer, user]);

  useEffect(() => {
    const handleReceiveMessage = (message) => {
      if (!message || !user) return;
      const senderIdStr = String(message.senderId?._id || message.senderId || '');
      const recipientIdStr = String(message.recipientId?._id || message.recipientId || '');
      const myIdStr = String(user._id);
      const isFromMe = senderIdStr === myIdStr;
      const msgId = message._id || message.messageId;

      const targetUserId = isFromMe ? recipientIdStr : senderIdStr;
      updateConversationInList(targetUserId, message.message, message.createdAt, isFromMe);

      if (isFromMe) {
        if (selectedUser && String(selectedUser._id) === recipientIdStr) {
          if (message.deleted) {
            setMessages(prev => prev.map(m => 
              m._id === msgId ? { ...m, deleted: true, message: '' } : m
            ));
          } else {
            setMessages(prev => {
              const exists = prev.some(m => m._id === msgId);
              return exists ? prev : [...prev, message];
            });
          }
        }
        return;
      }

      if (selectedUser && String(selectedUser._id) === senderIdStr) {
        if (message.deleted) {
          setMessages(prev => prev.map(m => 
            m._id === msgId ? { ...m, deleted: true, message: '' } : m
          ));
        } else {
          setMessages(prev => {
            const exists = prev.some(m => m._id === msgId);
            return exists ? prev : [...prev, message];
          });
        }
      }
    };

    const handleChatHistory = (data) => {
      if (selectedUser && user && data.chatId === generateChatId(user._id, selectedUser._id)) {
        setMessages(data.messages || []);
        setLoading(false);
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m => 
        m._id === messageId ? { ...m, deleted: true, message: '' } : m
      ));
    };

    const handleMessageError = (data) => {
      alert(`Chat Error: ${data.message}`);
    };

    const handleDeleteError = (data) => {
      alert(`Delete Error: ${data.message}`);
    };

    const handleSocketConnect = () => {
      console.log('🔌 Socket reconnected, rejoining chat...');
      if (selectedUser && user) {
        const chatId = generateChatId(user._id, selectedUser._id);
        socket.emit('joinChatRoom', { chatId });
      }
    };

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('chatHistory', handleChatHistory);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('messageError', handleMessageError);
    socket.on('deleteError', handleDeleteError);
    socket.on('connect', handleSocketConnect);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('chatHistory', handleChatHistory);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('messageError', handleMessageError);
      socket.off('deleteError', handleDeleteError);
      socket.off('connect', handleSocketConnect);
    };
  }, [selectedUser, user, generateChatId, updateConversationInList]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeMenu && menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !user) return;
    const messageText = newMessage.trim();
    const messageData = {
      chatId: generateChatId(user._id, selectedUser._id),
      message: messageText,
      chatType: 'private',
      senderId: user._id,
      senderName: user.name,
      recipientId: selectedUser._id,
      replyTo: replyingTo?._id || null,
      replyToMessage: replyingTo?.message || null,
      replyToSender: replyingTo?.senderName || null
    };
    sendMessageSocket(messageData);
    updateConversationInList(selectedUser._id, messageText, new Date().toISOString(), true);
    setNewMessage('');
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  const renderUserItem = (u) => {
    const unreadCount = getUnreadCount(u._id);
    const isOnline = isUserOnline(u._id);
    const isSelected = selectedUser && String(selectedUser._id) === String(u._id);
    const displayMessage = u.lastMessage || 'No messages yet';

    return (
      <div
        key={u._id}
        onClick={() => handleSelectUser(u)}
        className={`flex items-center gap-3 p-3 cursor-pointer transition-all border-b overflow-x-hidden ${
          darkMode ? 'border-slate-800' : 'border-gray-100'
        } ${isSelected ? (darkMode ? 'bg-blue-600/20' : 'bg-blue-50') : (darkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50')}`}
      >
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm md:text-lg shadow-sm">
            {u.name?.charAt(0).toUpperCase()}
          </div>
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${darkMode ? 'border-slate-900' : 'border-white'} ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline">
            <h4 className={`text-sm font-semibold truncate ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>{u.name}</h4>
            {u.lastMessageAt && (
              <span className="text-[10px] md:text-xs text-gray-500">
                {new Date(u.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center mt-0.5">
            <p className={`text-xs truncate ${unreadCount > 0 ? 'text-blue-500 font-bold' : (darkMode ? 'text-slate-400' : 'text-gray-500')}`}>
              {displayMessage}
            </p>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full h-4 w-4 md:h-5 md:w-5 flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    );
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
          <div className={`max-w-[75%] md:max-w-md rounded-2xl px-3 md:px-4 py-2 ${
            darkMode ? 'bg-slate-800/50 text-slate-500' : 'bg-gray-100 text-gray-400'
          }`}>
            <p className="text-sm italic">This message was deleted</p>
          </div>
        </div>
      );
    }

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
          className={`max-w-[85%] md:max-w-md rounded-2xl px-3 md:px-4 py-2 cursor-pointer transition-all ${
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
            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>

        {isMenuOpen && (
          <div 
            ref={menuRef}
            className={`absolute -top-12 right-0 z-50 flex items-center gap-3 p-2 rounded-xl backdrop-blur-md bg-slate-900/90 shadow-xl animate-in fade-in zoom-in-95 duration-100 border border-white/10`}
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

  const filteredUsers = allUsers.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="px-4 md:px-6 max-w-7xl mx-auto">
      <div className="flex h-[calc(100vh-120px)] gap-0 lg:gap-4">
        {/* Mobile Sidebar Overlay */}
        {showSidebar && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Left Sidebar - Conversation List (30%) */}
        <div className={`
          fixed lg:relative z-50 lg:z-auto inset-y-0 left-0 h-full lg:h-auto
          transform transition-transform duration-300 ease-in-out w-80 lg:w-[30%]
          ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <Card padding="none" className={`h-full flex flex-col ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
            <div className={`p-3 md:p-4 border-b ${darkMode ? 'border-slate-800' : 'border-gray-200'} flex items-center justify-between`}>
              <span className={`font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>Messages</span>
              <button 
                onClick={() => setShowSidebar(false)}
                className={`lg:hidden p-2 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}
              >
                <svg className={`w-5 h-5 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Find Classmates Button */}
            <div className={`p-3 border-b ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
              <button
                onClick={() => setShowFindModal(true)}
                className={`w-full py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  darkMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <UserPlus className="w-5 h-5" />
                Find Classmates
              </button>
            </div>
            
            <div className={`p-3 ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                darkMode ? 'bg-white/5' : 'bg-gray-100'
              }`}>
                <Search className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`flex-1 bg-transparent text-sm outline-none ${
                    darkMode ? 'text-white placeholder-slate-500' : 'text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {activeConversations.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                <div className={`p-4 text-center ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1">Click "Find Classmates" to start chatting</p>
                </div>
              ) : (
                activeConversations.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase())).map(renderUserItem)
              )}
            </div>
          </Card>
        </div>

        {/* Right Side - Chat Window (70%) */}
        <Card padding="none" className={`flex-1 flex flex-col ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
          {selectedUser ? (
            <>
              {/* Chat Header */}
              <div className={`p-3 md:p-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowSidebar(true)}
                    className={`lg:hidden p-2 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}
                  >
                    <svg className={`w-5 h-5 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm md:text-base">
                    {selectedUser.name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm md:text-base ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>{selectedUser.name}</h3>
                    <p className="text-xs text-green-500">{isUserOnline(selectedUser._id) ? 'Online' : 'Offline'}</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
                {loading ? (
                  <div className="text-center p-4 text-sm">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center p-4 text-sm text-gray-500">No messages yet. Start the conversation!</div>
                ) : (
                  messages.map(renderMessage)
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className={`p-3 md:p-4 border-t ${darkMode ? 'border-slate-800' : 'border-gray-200'} flex flex-col gap-2`}>
                {replyingTo && (
                  <div className={`p-2 rounded-lg flex items-center gap-2 ${
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
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    placeholder="Type a message..." 
                    className={`flex-1 p-2 md:p-3 rounded-lg border text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`} 
                  />
                  <Button type="submit" className="px-4 md:px-6">Send</Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <svg className={`w-16 h-16 mb-4 ${darkMode ? 'text-slate-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm md:text-base">Select a conversation to start chatting</p>
              <button 
                onClick={() => setShowSidebar(true)}
                className={`mt-4 lg:hidden px-4 py-2 rounded-lg ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-gray-100 text-gray-700'}`}
              >
                View Chats
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Find Classmates Modal */}
      {showFindModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md max-h-[80vh] rounded-2xl overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div className={`p-4 border-b ${darkMode ? 'border-slate-800' : 'border-gray-200'} flex items-center justify-between`}>
              <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Find Classmates</h3>
              <button
                onClick={() => setShowFindModal(false)}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className={`p-4 border-b ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                darkMode ? 'bg-white/5' : 'bg-gray-100'
              }`}>
                <Search className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`flex-1 bg-transparent text-sm outline-none ${
                    darkMode ? 'text-white placeholder-slate-500' : 'text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[50vh] p-2">
              {filteredUsers.map(u => (
                <div
                  key={u._id}
                  onClick={() => handleStartConversation(u)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                      {u.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${darkMode ? 'border-slate-900' : 'border-white'} ${isUserOnline(u._id) ? 'bg-green-500' : 'bg-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{u.name}</h4>
                    {u.department && (
                      <p className={`text-xs truncate ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{u.department}</p>
                    )}
                  </div>
                  {u.hasConversation && (
                    <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                      Existing
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectChat;
