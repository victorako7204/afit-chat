/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOnlineUsers } from '../context/OnlineUsersContext';
import { useNotifications } from '../context/NotificationContext';
import { authAPI, chatAPI } from '../services/api';
import { socket, connectSocket, joinRoom, sendMessageSocket } from '../services/socket';
import { CornerUpLeft, X, UserPlus, Search, Trash2, Camera, Image, Mic } from 'lucide-react';

const DirectChat = () => {
  const { user } = useAuth();
  const { isUserOnline } = useOnlineUsers();
  const { getUnreadCount, clearUnread, setCurrentChatPartner: setPartnerWithClear, fetchUnreadFromServer } = useNotifications();
  const [activeConversations, setActiveConversations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFindModal, setShowFindModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showConvList, setShowConvList] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const generateChatId = useCallback((userId1, userId2) => {
    const sorted = [String(userId1), String(userId2)].sort();
    return `dm-${sorted[0]}-${sorted[1]}`;
  }, []);

  const fetchActiveConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authAPI.getUsers();
      const userList = res.data.filter(u => String(u._id) !== String(user._id));
      const sorted = [...userList.filter(u => u.lastMessage || u.lastMessageAt)].sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
      setActiveConversations(sorted);
    } catch (err) { console.error(err); }
  }, [user]);

  const fetchAllUsers = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authAPI.getUsers();
      const userList = res.data.filter(u => String(u._id) !== String(user._id)).map(u => ({ ...u, hasConversation: activeConversations.some(conv => String(conv._id) === String(u._id)) }));
      setAllUsers(userList);
    } catch (err) { console.error(err); }
  }, [user, activeConversations]);

  const addToActiveConversations = useCallback((userData) => {
    setActiveConversations(prev => {
      const exists = prev.some(u => String(u._id) === String(userData._id));
      if (exists) return prev;
      return [{ ...userData, lastMessage: null, lastMessageAt: new Date().toISOString() }, ...prev];
    });
  }, []);

  const updateConversationInList = useCallback((targetId, messageText, timestamp, isSentByMe = false) => {
    setActiveConversations(prev => {
      const exists = prev.some(u => String(u._id) === String(targetId));
      if (!exists) return prev;
      const updated = prev.map(u => {
        if (String(u._id) === String(targetId)) {
          return { ...u, lastMessage: isSentByMe ? `You: ${messageText}` : messageText, lastMessageAt: timestamp || new Date().toISOString() };
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

  const handleSelectUser = useCallback(async (selectedUserData) => {
    setSelectedUser(selectedUserData);
    setPartnerWithClear(selectedUserData);
    setMessages([]);
    setLoading(true);
    setShowConvList(false);
    setReplyingTo(null);
    if (user && selectedUserData) {
      const chatId = generateChatId(user._id, selectedUserData._id);
      joinRoom(chatId);
      chatAPI.clearUnread(chatId).catch(() => {});
      chatAPI.getPrivateMessages(selectedUserData._id).then(res => {
        if (res.data?.messages?.length > 0) setMessages(res.data.messages);
        setLoading(false);
      }).catch(() => {});
    }
    setTimeout(() => setLoading(false), 5000);
  }, [user, generateChatId, setPartnerWithClear]);

  const handleStartConversation = (userData) => {
    addToActiveConversations(userData);
    setShowFindModal(false);
    handleSelectUser(userData);
  };

  const handleSetReply = (msg) => {
    setReplyingTo({ _id: msg._id, message: msg.message, senderName: msg.senderName || msg.senderId?.name || selectedUser?.name || 'User' });
    inputRef.current?.focus();
  };

  const handleDeleteMessage = (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    socket.emit('deleteMessage', { chatId: generateChatId(user._id, selectedUser._id), messageId: msgId, userId: user._id });
  };

  useEffect(() => {
    if (user?._id) { fetchActiveConversations(); fetchAllUsers(); fetchUnreadFromServer(); connectSocket(user._id); }
  }, [user?._id, fetchActiveConversations, fetchAllUsers, fetchUnreadFromServer, user]);

  useEffect(() => {
    const handleReceiveMessage = (message) => {
      if (!message || !user) return;
      const senderIdStr = String(message.senderId?._id || message.senderId || '');
      const recipientIdStr = String(message.recipientId?._id || message.recipientId || '');
      const myIdStr = String(user._id);
      const isFromMe = senderIdStr === myIdStr;
      const targetUserId = isFromMe ? recipientIdStr : senderIdStr;
      updateConversationInList(targetUserId, message.message, message.createdAt, isFromMe);
      if (isFromMe) {
        if (selectedUser && String(selectedUser._id) === recipientIdStr) {
          setMessages(prev => message.deleted ? prev.map(m => m._id === (message._id || message.messageId) ? { ...m, deleted: true, message: '' } : m) : prev.some(m => m._id === (message._id || message.messageId)) ? prev : [...prev, message]);
        }
        return;
      }
      if (selectedUser && String(selectedUser._id) === senderIdStr) {
        setMessages(prev => message.deleted ? prev.map(m => m._id === (message._id || message.messageId) ? { ...m, deleted: true, message: '' } : m) : prev.some(m => m._id === (message._id || message.messageId)) ? prev : [...prev, message]);
      }
    };
    const handleChatHistory = (data) => {
      const expectedChatId = generateChatId(user._id, selectedUser._id);
      if (selectedUser && user && data.chatId === expectedChatId) { setMessages(data.messages || []); setLoading(false); }
    };
    const handleMessageDeleted = ({ messageId, _id }) => {
      const id = _id || messageId;
      setMessages(prev => prev.map(m => m._id === id ? { ...m, deleted: true, message: '' } : m));
    };
    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('chatHistory', handleChatHistory);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('connect', () => { if (selectedUser && user) socket.emit('joinChatRoom', { chatId: generateChatId(user._id, selectedUser._id) }); });
    socket.on('joinChatRoomRequest', (data) => { if (data?.chatId) socket.emit('joinChatRoom', { chatId: data.chatId }); });
    return () => { socket.off('receiveMessage', handleReceiveMessage); socket.off('chatHistory', handleChatHistory); socket.off('messageDeleted', handleMessageDeleted); };
  }, [selectedUser, user, generateChatId, updateConversationInList]);

  useEffect(() => { if (!loading && messages.length > 0) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !user) return;
    const messageText = newMessage.trim();
    const messageData = { chatId: generateChatId(user._id, selectedUser._id), message: messageText, chatType: 'private', senderId: user._id, senderName: user.name, recipientId: selectedUser._id, replyTo: replyingTo?._id || null, replyToMessage: replyingTo?.message || null, replyToSender: replyingTo?.senderName || null };
    sendMessageSocket(messageData);
    updateConversationInList(selectedUser._id, messageText, new Date().toISOString(), true);
    setNewMessage('');
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return new Date(date).toLocaleDateString();
  };

  const filteredUsers = allUsers.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col h-full" style={{backgroundColor:'var(--bg-primary)'}}>
      {selectedUser && !showConvList ? (
        /* Conversation View */
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 h-11 shrink-0" style={{borderBottom:'1px solid var(--border)'}}>
            <button onClick={() => { setSelectedUser(null); setShowConvList(true); }} className="btn-press">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0" style={{backgroundColor:'var(--bg-tertiary)'}}>
              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white" style={{backgroundColor:'var(--accent)'}}>
                {selectedUser.name?.[0] || '?'}
              </div>
            </div>
            <span className="text-sm font-semibold flex-1">{selectedUser.name}</span>
            <button className="btn-press">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-none">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color:'var(--text-tertiary)'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm" style={{color:'var(--text-secondary)'}}>No messages yet</p>
                <p className="text-xs mt-1" style={{color:'var(--text-tertiary)'}}>Send a message to start the conversation</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isOwn = String(msg.senderId?._id || msg.senderId) === String(user?._id);
                const isDeleted = msg.deleted;
                return (
                  <div key={msg._id || index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${index > 0 && messages[index-1]?.senderId === msg.senderId ? 'mt-0.5' : 'mt-3'}`}>
                    {isDeleted ? (
                      <div className="chat-bubble-them opacity-50 text-xs italic">This message was deleted</div>
                    ) : (
                      <div className={`${isOwn ? 'chat-bubble-me' : 'chat-bubble-them'} relative group`}
                        onDoubleClick={() => isOwn && handleDeleteMessage(msg._id)}
                      >
                        {msg.replyToMessage && (
                          <div className={`mb-1.5 px-2 py-1 rounded text-[11px] ${isOwn ? 'bg-white/15' : 'bg-black/20'}`}>
                            <p className="font-medium opacity-80">{msg.replyToSender || 'Unknown'}</p>
                            <p className="truncate opacity-60">{msg.replyToMessage}</p>
                          </div>
                        )}
                        <p className="text-sm break-words">{msg.message}</p>
                        <div className={`flex items-center justify-end gap-1 mt-0.5`}>
                          <span className="text-[10px] opacity-60">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          {isOwn && (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply indicator */}
          {replyingTo && (
            <div className="flex items-center gap-2 px-4 py-2" style={{backgroundColor:'var(--bg-secondary)', borderTop:'1px solid var(--border)'}}>
              <CornerUpLeft size={14} style={{color:'var(--accent)'}} />
              <span className="text-xs flex-1 truncate" style={{color:'var(--text-secondary)'}}>
                Replying to {replyingTo.senderName}
              </span>
              <button onClick={() => setReplyingTo(null)} className="btn-press"><X size={14} /></button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 px-4 py-2 shrink-0" style={{borderTop:'1px solid var(--border)'}}>
            <button type="button" className="btn-press">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color:'var(--text-secondary)'}}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input
              ref={inputRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Message..."
              className="flex-1 px-4 py-2 text-sm rounded-full outline-none border-none"
              style={{backgroundColor:'var(--bg-tertiary)',color:'var(--text-primary)'}}
            />
            <button type="button" className="btn-press">
              <Mic size={22} style={{color:'var(--text-secondary)'}} />
            </button>
            {newMessage.trim() ? (
              <button type="submit" className="btn-press">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" style={{color:'var(--accent)'}}>
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            ) : null}
          </form>
        </div>
      ) : (
        /* Conversation List */
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 h-11 shrink-0" style={{borderBottom:'1px solid var(--border)'}}>
            <span className="text-base font-bold">{user?.name || 'Messages'}</span>
            <button onClick={() => setShowFindModal(true)} className="btn-press">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>

          <div className="px-4 py-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{backgroundColor:'var(--bg-tertiary)'}}>
              <Search size={16} style={{color:'var(--text-tertiary)'}} />
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none border-none"
                style={{color:'var(--text-primary)'}}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-none">
            {activeConversations.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color:'var(--text-tertiary)'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                </svg>
                <p className="text-sm" style={{color:'var(--text-secondary)'}}>No messages yet</p>
                <p className="text-xs mt-1" style={{color:'var(--text-tertiary)'}}>Tap the + to start a conversation</p>
              </div>
            ) : (
              activeConversations.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase())).map(u => {
                const unreadCount = getUnreadCount(u._id);
                const isOnline = isUserOnline(u._id);
                return (
                  <div key={u._id} onClick={() => handleSelectUser(u)} className="flex items-center gap-3 px-4 py-[14px] cursor-pointer btn-press" style={{height:72}}>
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-full overflow-hidden" style={{backgroundColor:'var(--bg-tertiary)'}}>
                        <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white" style={{backgroundColor:'var(--accent)'}}>
                          {u.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      </div>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2" style={{backgroundColor:'#31c24d', borderColor:'var(--bg-primary)'}} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className={`text-sm truncate ${unreadCount > 0 ? 'font-bold' : 'font-medium'}`}>
                          {u.name}
                        </span>
                        {u.lastMessageAt && (
                          <span className="text-[11px] shrink-0 ml-2" style={{color:'var(--text-tertiary)'}}>{timeAgo(u.lastMessageAt)}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <span className={`text-xs truncate ${unreadCount > 0 ? 'font-semibold' : ''}`} style={{color: unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)'}}>
                          {u.lastMessage || 'Start chatting...'}
                        </span>
                        {unreadCount > 0 && (
                          <div className="w-2 h-2 rounded-full shrink-0 ml-2" style={{backgroundColor:'var(--accent)'}} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Find Classmates Modal */}
      {showFindModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{backgroundColor:'rgba(0,0,0,0.7)'}} onClick={() => setShowFindModal(false)}>
          <div className="w-full max-w-[500px] rounded-t-2xl overflow-hidden max-h-[80vh]" style={{backgroundColor:'var(--bg-secondary)'}} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:'1px solid var(--border)'}}>
              <span className="text-sm font-semibold">New Message</span>
              <button onClick={() => setShowFindModal(false)} className="btn-press"><X size={20} /></button>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{backgroundColor:'var(--bg-tertiary)'}}>
                <Search size={16} style={{color:'var(--text-tertiary)'}} />
                <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 bg-transparent text-sm outline-none border-none" style={{color:'var(--text-primary)'}} />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[50vh]">
              {filteredUsers.map(u => (
                <div key={u._id} onClick={() => handleStartConversation(u)} className="flex items-center gap-3 px-4 py-3 cursor-pointer btn-press">
                  <div className="w-11 h-11 rounded-full overflow-hidden shrink-0" style={{backgroundColor:'var(--bg-tertiary)'}}>
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white" style={{backgroundColor:'var(--accent)'}}>
                      {u.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    {u.department && <p className="text-xs truncate" style={{color:'var(--text-tertiary)'}}>{u.department}</p>}
                  </div>
                  {u.hasConversation && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{backgroundColor:'rgba(0,149,246,0.15)',color:'var(--accent)'}}>Existing</span>
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
