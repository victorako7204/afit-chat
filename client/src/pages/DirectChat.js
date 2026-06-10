import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOnlineUsers } from '../context/OnlineUsersContext';
import { chatAPI, authAPI } from '../services/api';
import {
  connectSocket, joinRoom, leaveRoom, sendMessageSocket,
  listenToMessages, listenToMessageDeleted, listenToMessageEdited,
  listenToTyping, listenToReadReceipts, emitTyping, emitMarkRead,
  emitDeleteMessage, setSocketUser
} from '../services/socket';
import { CornerUpLeft, X, UserPlus, Search, Trash2, Check, CheckCheck, Loader2 } from 'lucide-react';

const DirectChat = () => {
  const { user } = useAuth();
  const { isUserOnline } = useOnlineUsers();
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [showFindModal, setShowFindModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showConvList, setShowConvList] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});
  const [readByUser, setReadByUser] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const generateChatId = useCallback((userId1, userId2) => {
    const sorted = [String(userId1), String(userId2)].sort();
    return `dm:${sorted[0]}:${sorted[1]}`;
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await chatAPI.getConversations();
      setConversations(res.data?.data?.conversations || []);
    } catch (err) {
    }
  }, [user]);

  const fetchAllUsers = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authAPI.getUsers();
      const users = res.data?.data?.users || [];
      setAllUsers(users);
    } catch (err) {
    }
  }, [user]);

  const handleSelectUser = useCallback(async (selectedUserData) => {
    setSelectedUser(selectedUserData);
    setMessages([]);
    setLoading(true);
    setShowConvList(false);
    setReplyingTo(null);
    setReadByUser({});

    if (user && selectedUserData) {
      const chatId = generateChatId(user._id, selectedUserData._id);
      await joinRoom(chatId);
      emitMarkRead(chatId);

      try {
        const res = await chatAPI.getMessages(chatId, 50, 0);
        const data = res.data?.data || res.data;
        const fetched = data.messages || [];
        setMessages(fetched);
      } catch (err) {
      }
    }
    setLoading(false);
  }, [user, generateChatId]);

  const handleStartConversation = (userData) => {
    setShowFindModal(false);
    setSearchTerm('');
    handleSelectUser(userData);
  };

  useEffect(() => {
    if (user?._id) {
      connectSocket();
      setSocketUser(user._id);
      fetchConversations();
      fetchAllUsers();
    }
  }, [user?._id, fetchConversations, fetchAllUsers]);

  useEffect(() => {
    const handleNewMessage = (msg) => {
      if (!msg || !user) return;

      const senderId = String(msg.senderId?._id || msg.senderId || '');
      const recipientId = String(msg.recipientId?._id || msg.recipientId || '');
      const myId = String(user._id);
      const isFromMe = senderId === myId;

      if (!isFromMe && recipientId !== myId) return;

      const otherUserId = isFromMe ? recipientId : senderId;

      if (selectedUser && String(selectedUser._id) === otherUserId) {
        setMessages(prev => {
          const exists = prev.some(m => m._id === msg._id || m.tempId === msg.tempId);
          if (!exists) return [...prev, msg];
          return prev.map(m => (m.tempId === msg.tempId && !m._id) ? { ...m, ...msg, status: 'sent' } : m);
        });
        if (!isFromMe) {
          emitMarkRead(msg.chatId);
        }
      }

      setConversations(prev => {
        const idx = prev.findIndex(c => {
          const otherP = c.participants?.find(p => String(p._id || p) !== String(user?._id));
          return String(otherP?._id || otherP || '') === otherUserId;
        });
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lastMessage: { content: msg.message, sentAt: msg.createdAt } };
        return updated;
      });
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

    const handleReadReceipts = ({ userId: readerId, chatId }) => {
      if (!selectedUser || !chatId) return;
      setMessages(prev => prev.map(m => {
        const sender = String(m.senderId?._id || m.senderId || '');
        if (sender !== String(user?._id)) return m;
        if (String(readerId) !== String(selectedUser._id)) return m;
        return { ...m, status: 'read', readAt: new Date().toISOString() };
      }));
    };

    const handleTyping = (data) => {
      if (!selectedUser || String(data.userId) !== String(selectedUser._id)) return;
      setTypingUsers(prev => ({ ...prev, [data.userId]: data }));
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers({});
      }, 3000);
    };

    const cleanupMessages = listenToMessages(handleNewMessage);
    const cleanupDeleted = listenToMessageDeleted(handleMessageDeleted);
    const cleanupEdited = listenToMessageEdited(handleMessageEdited);
    const cleanupRead = listenToReadReceipts(handleReadReceipts);
    const cleanupTyping = listenToTyping(handleTyping);

    return () => {
      cleanupMessages?.();
      cleanupDeleted?.();
      cleanupEdited?.();
      cleanupRead?.();
      cleanupTyping?.();
      if (selectedUser && user) {
        const chatId = generateChatId(user._id, selectedUser._id);
        leaveRoom(chatId);
      }
    };
  }, [selectedUser, user, fetchConversations, generateChatId]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !user) return;

    const chatId = generateChatId(user._id, selectedUser._id);
    const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const optimisticMsg = {
      _id: tempId,
      tempId,
      senderId: { _id: user._id, name: user.name },
      senderName: user.name,
      message: newMessage.trim(),
      chatType: 'private',
      chatId,
      recipientId: selectedUser._id,
      status: 'sending',
      createdAt: new Date().toISOString(),
      replyTo: replyingTo?._id || null,
      replyToMessage: replyingTo?.message || null,
      replyToSender: replyingTo?.senderName || null
    };

    setMessages(prev => [...prev, optimisticMsg]);

    sendMessageSocket({
      chatId,
      message: newMessage.trim(),
      replyTo: replyingTo?._id || null,
      tempId,
      onSent: (messageId) => {
        setMessages(prev => prev.map(m =>
          m.tempId === tempId ? { ...m, _id: messageId, status: 'sent', tempId: undefined } : m
        ));
        fetchConversations();
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

  const handleSetReply = (msg) => {
    setReplyingTo({
      _id: msg._id,
      message: msg.message,
      senderName: msg.senderName || msg.senderId?.name || selectedUser?.name || 'User'
    });
    inputRef.current?.focus();
  };

  const handleDeleteMessage = (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    emitDeleteMessage(msgId);
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (selectedUser && user) {
      const chatId = generateChatId(user._id, selectedUser._id);
      emitTyping(chatId, e.target.value.length > 0);
    }
  };

  const renderStatus = (status) => {
    if (status === 'sending') return <Loader2 size={12} className="animate-spin" style={{ color: 'rgba(255,255,255,0.6)' }} />;
    if (status === 'sent') return <Check size={12} style={{ color: 'rgba(255,255,255,0.6)' }} />;
    if (status === 'delivered') return <CheckCheck size={12} style={{ color: 'rgba(255,255,255,0.6)' }} />;
    if (status === 'read') return <CheckCheck size={12} style={{ color: '#53bdeb' }} />;
    return null;
  };

  const timeAgo = (date) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return new Date(date).toLocaleDateString();
  };

  const filteredUsers = allUsers.filter(u =>
    u._id && String(u._id) !== String(user?._id) &&
    u.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isTyping = selectedUser && typingUsers[selectedUser._id]?.isTyping;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {selectedUser && !showConvList ? (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-4 h-11 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => { setSelectedUser(null); setShowConvList(true); }} className="btn-press">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: 'var(--accent)' }}>
                {selectedUser.name?.[0] || '?'}
              </div>
            </div>
            <span className="text-sm font-semibold flex-1">{selectedUser.name}</span>
            {isUserOnline(selectedUser._id) && (
              <span className="text-[10px]" style={{ color: '#31c24d' }}>Online</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-none">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-tertiary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No messages yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Send a message to start the conversation</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isOwn = String(msg.senderId?._id || msg.senderId) === String(user?._id);
                const isDeleted = msg.isDeleted;
                return (
                  <div key={msg._id || index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${index > 0 && messages[index - 1]?.senderId === msg.senderId ? 'mt-0.5' : 'mt-3'}`}>
                    {isDeleted ? (
                      <div className="chat-bubble-them opacity-50 text-xs italic">This message was deleted</div>
                    ) : (
                      <div className={`${isOwn ? 'chat-bubble-me' : 'chat-bubble-them'} relative group`}>
                        {msg.replyToMessage && (
                          <div className={`mb-1.5 px-2 py-1 rounded text-[11px] ${isOwn ? 'bg-white/15' : 'bg-black/20'}`}>
                            <p className="font-medium opacity-80">{msg.replyToSender || 'Unknown'}</p>
                            <p className="truncate opacity-60">{msg.replyToMessage}</p>
                          </div>
                        )}
                        <p className="text-sm break-words">{msg.message}</p>
                        {msg.editedAt && <span className="text-[10px] opacity-50 mr-1">(edited)</span>}
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[10px] opacity-60">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          {isOwn && renderStatus(msg.status)}
                        </div>
                        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 p-1">
                          <button
                            onClick={() => handleSetReply(msg)}
                            className="p-1 rounded-full hover:bg-white/20 transition-colors"
                          >
                            <CornerUpLeft size={12} />
                          </button>
                          {isOwn && (
                            <button
                              onClick={() => handleDeleteMessage(msg._id)}
                              className="p-1 rounded-full hover:bg-white/20 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {isTyping && (
              <div className="flex justify-start">
                <div className="text-xs italic px-2 py-1" style={{ color: 'var(--text-tertiary)' }}>
                  {selectedUser.name} is typing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {replyingTo && (
            <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
              <CornerUpLeft size={14} style={{ color: 'var(--accent)' }} />
              <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                Replying to {replyingTo.senderName}
              </span>
              <button onClick={() => setReplyingTo(null)} className="btn-press"><X size={14} /></button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-center gap-2 px-4 py-2 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              value={newMessage}
              onChange={handleInputChange}
              placeholder="Message..."
              className="flex-1 px-4 py-2 text-sm rounded-full outline-none border-none"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
            />
            {newMessage.trim() ? (
              <button type="submit" className="btn-press">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}>
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            ) : null}
          </form>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 h-11 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-base font-bold">{user?.name || 'Messages'}</span>
            <button onClick={() => { setShowFindModal(true); fetchAllUsers(); }} className="btn-press">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>

          <div className="px-4 py-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none border-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-none">
            {conversations.length === 0 && allUsers.filter(u => u._id && String(u._id) !== String(user?._id)).filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-tertiary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No messages yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Tap the + to start a conversation</p>
              </div>
            ) : (
              <>
                {conversations.map((conv) => {
                  const otherParticipantId = conv.participants?.find(p => String(p._id || p) !== String(user?._id));
                  const otherUserId = String(otherParticipantId?._id || otherParticipantId || '');
                  const otherName = otherParticipantId?.name || 'Unknown';
                  const unreadCount = conv.unreadCount?.get?.(String(user?._id)) || conv.unreadCount?.[String(user?._id)] || 0;
                  const isOnline = isUserOnline(otherUserId);

                  return (
                    <div
                      key={conv._id}
                      onClick={() => {
                        const userData = { _id: otherUserId, name: otherName, department: otherParticipantId?.department };
                        handleSelectUser(userData);
                      }}
                      className="flex items-center gap-3 px-4 py-[14px] cursor-pointer btn-press"
                      style={{ height: 72 }}
                    >
                      <div className="relative shrink-0">
                        <div className="w-14 h-14 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white" style={{ backgroundColor: 'var(--accent)' }}>
                            {otherName?.[0]?.toUpperCase() || '?'}
                          </div>
                        </div>
                        {isOnline && (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2" style={{ backgroundColor: '#31c24d', borderColor: 'var(--bg-primary)' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className={`text-sm truncate ${unreadCount > 0 ? 'font-bold' : 'font-medium'}`}>
                            {otherName}
                          </span>
                          {conv.lastMessage?.sentAt && (
                            <span className="text-[11px] shrink-0 ml-2" style={{ color: 'var(--text-tertiary)' }}>{timeAgo(conv.lastMessage.sentAt)}</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-0.5">
                          <span className={`text-xs truncate ${unreadCount > 0 ? 'font-semibold' : ''}`} style={{ color: unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                            {conv.lastMessage?.content || 'Start chatting...'}
                          </span>
                          {unreadCount > 0 && (
                            <div className="w-2 h-2 rounded-full shrink-0 ml-2" style={{ backgroundColor: 'var(--accent)' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {showFindModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={() => { setShowFindModal(false); setSearchTerm(''); }}>
          <div className="w-full max-w-[500px] rounded-t-2xl overflow-hidden max-h-[80vh]" style={{ backgroundColor: 'var(--bg-secondary)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm font-semibold">New Message</span>
              <button onClick={() => { setShowFindModal(false); setSearchTerm(''); }} className="btn-press"><X size={20} /></button>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 bg-transparent text-sm outline-none border-none" style={{ color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[50vh]">
              {filteredUsers.map(u => (
                <div key={u._id} onClick={() => handleStartConversation(u)} className="flex items-center gap-3 px-4 py-3 cursor-pointer btn-press">
                  <div className="w-11 h-11 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: 'var(--accent)' }}>
                      {u.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    {u.department && <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{u.department}</p>}
                  </div>
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
