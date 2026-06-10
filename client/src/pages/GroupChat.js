import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupAPI, chatAPI } from '../services/api';
import {
  connectSocket, joinRoom, leaveRoom, sendMessageSocket,
  listenToMessages, listenToMessageDeleted, listenToMessageEdited
} from '../services/socket';
import { Send, Loader2, CornerUpLeft, X } from 'lucide-react';

const GroupChat = () => {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', department: '' });
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const LIMIT = 50;

  const chatRoomId = `group:${groupId}`;

  const isAdmin = group?.admins?.some(a => a._id === user?._id) || false;
  const isMember = group?.members?.some(m => m._id === user?._id) || false;
  const isLocked = group?.isLocked || false;
  const canSendMessage = !isLocked || isAdmin;

  const fetchGroup = useCallback(async () => {
    try {
      const res = await groupAPI.getGroup(groupId);
      setGroup(res.data?.data?.group || res.data?.group || res.data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatAPI.getMessages(chatRoomId, LIMIT, 0);
      const data = res.data?.data || res.data;
      const fetched = data.messages || [];
      setMessages(fetched);
      setHasMore(data.hasMore ?? data.pagination?.hasMore ?? false);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [chatRoomId]);

  useEffect(() => {
    connectSocket();
    fetchGroup();

    return () => {
      leaveRoom(chatRoomId);
    };
  }, [groupId, chatRoomId, fetchGroup]);

  useEffect(() => {
    if (group) {
      joinRoom(chatRoomId);
      fetchMessages();
    }
  }, [group, chatRoomId, fetchMessages]);

  useEffect(() => {
    const handleNewMessage = (message) => {
      if (message && message.chatId === chatRoomId) {
        setMessages((prev) => {
          if (!prev || !Array.isArray(prev)) return [message];
          const exists = prev.some(m => m && (m._id === message._id || m.tempId === message.tempId));
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

    const cleanupMessages = listenToMessages(handleNewMessage);
    const cleanupDeleted = listenToMessageDeleted(handleMessageDeleted);

    return () => {
      cleanupMessages?.();
      cleanupDeleted?.();
    };
  }, [chatRoomId]);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  const loadOlderMessages = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const res = await chatAPI.getMessages(chatRoomId, LIMIT, 0, oldest.createdAt);
      const data = res.data?.data || res.data;
      const olderMessages = data.messages || [];
      setMessages((prev) => [...olderMessages, ...prev]);
      setHasMore(data.hasMore ?? false);
    } catch (err) {
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !canSendMessage) return;

    const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const optimisticMsg = {
      _id: tempId,
      tempId,
      senderId: { _id: user._id, name: user.name },
      senderName: user.name,
      message: newMessage.trim(),
      chatType: 'group',
      chatId: chatRoomId,
      status: 'sending',
      createdAt: new Date().toISOString(),
      replyTo: replyingTo?._id || null,
      replyToMessage: replyingTo?.message || null,
      replyToSender: replyingTo?.senderName || null
    };

    setMessages(prev => [...prev, optimisticMsg]);

    sendMessageSocket({
      chatId: chatRoomId,
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

  const handleToggleLock = async () => {
    if (!group || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await groupAPI.toggleLock(group._id);
      const updated = res.data?.data?.group || res.data?.group || res.data;
      setGroup(updated);
    } catch (err) {
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!group?.inviteCode) return;
    const inviteLink = `${window.location.origin}/groups?invite=${group.inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
    }
  };

  const handleMakeAdmin = async (targetUserId) => {
    if (!group || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await groupAPI.makeAdmin(group._id, targetUserId);
      const updated = res.data?.data?.group || res.data?.group || res.data;
      setGroup(updated);
    } catch (err) {
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!group || regeneratingCode) return;
    setRegeneratingCode(true);
    try {
      const res = await groupAPI.regenerateInviteCode(group._id);
      setGroup(prev => ({ ...prev, inviteCode: res.data?.data?.inviteCode || res.data?.inviteCode }));
    } catch (err) {
    } finally {
      setRegeneratingCode(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Group not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/groups')} className="btn-press">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold">{group.name}</h2>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {group.members?.length || 0} members
              {isLocked && <span style={{ color: 'var(--danger)' }}> · Locked</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowInviteModal(true)} className="px-3 py-1.5 text-xs font-semibold rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            Invite
          </button>
          <button onClick={() => setShowMembersModal(true)} className="px-3 py-1.5 text-xs font-semibold rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            Members
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
          if (!msg) return null;
          const isOwn = String(msg.senderId?._id || msg.senderId) === String(user?._id);
          const isDeleted = msg.isDeleted;
          if (isDeleted) {
            return (
              <div key={msg._id || index} className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm italic" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                  This message was deleted
                </div>
              </div>
            );
          }
          return (
            <div key={msg._id || index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%] rounded-2xl px-4 py-2" style={{
                backgroundColor: isOwn ? 'var(--accent)' : 'var(--bg-secondary)',
                color: isOwn ? 'white' : 'var(--text-primary)'
              }}>
                {!isOwn && (
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>{msg.senderId?.name || msg.senderName || 'Unknown'}</p>
                )}
                {msg.replyToMessage && (
                  <div className="mb-2 p-2 rounded-lg text-xs" style={{ backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : 'var(--bg-tertiary)' }}>
                    <CornerUpLeft size={12} />
                    <span className="font-medium">{msg.replyToSender}</span>
                    <p className="truncate opacity-80">{msg.replyToMessage}</p>
                  </div>
                )}
                <p className="text-sm break-words">{msg.message}</p>
                <span className="text-[10px] opacity-70 float-right ml-2 mt-1" style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {canSendMessage ? (
        <form onSubmit={handleSendMessage} className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          {replyingTo && (
            <div className="mb-2 p-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <CornerUpLeft size={14} style={{ color: 'var(--accent)' }} />
              <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                Replying to: {replyingTo.senderName}
              </span>
              <button type="button" onClick={() => setReplyingTo(null)}><X size={16} /></button>
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
      ) : (
        <div className="p-4 text-center" style={{ backgroundColor: 'rgba(255,0,0,0.05)', borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--danger)' }}>This group is locked by admin.</p>
        </div>
      )}

      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={() => setShowMembersModal(false)}>
          <div className="w-full max-w-[500px] rounded-t-2xl overflow-hidden max-h-[80vh]" style={{ backgroundColor: 'var(--bg-secondary)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm font-semibold">Group Members</span>
              <button onClick={() => setShowMembersModal(false)}><X size={20} /></button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-3 space-y-2">
              {group.members?.map((member) => {
                if (!member || !member._id) return null;
                const memberIsAdmin = group.admins?.some(a => a._id === member._id) || false;
                const memberIsCreator = group.createdBy?._id === member._id || false;
                const canPromote = isAdmin && !memberIsAdmin && !memberIsCreator && member._id !== user?._id;
                return (
                  <div key={member._id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: 'var(--accent)' }}>
                        {member.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{member.name || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {memberIsCreator && <span className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: 'rgba(255,193,7,0.2)', color: '#ffc107' }}>Creator</span>}
                      {memberIsAdmin && <span className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: 'rgba(0,149,246,0.2)', color: 'var(--accent)' }}>Admin</span>}
                      {canPromote && (
                        <button onClick={() => handleMakeAdmin(member._id)} disabled={actionLoading} className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                          Make Admin
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={() => setShowInviteModal(false)}>
          <div className="w-full max-w-[400px] rounded-t-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm font-semibold">Invite to Group</span>
              <button onClick={() => setShowInviteModal(false)}><X size={20} /></button>
            </div>
            <div className="p-6 text-center">
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Share this invite code with others</p>
              <p className="text-2xl font-bold font-mono tracking-widest" style={{ color: 'var(--accent)' }}>{group.inviteCode || 'N/A'}</p>
              <button onClick={handleCopyInviteLink} className="mt-4 px-4 py-2 text-sm font-semibold rounded-lg w-full" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                {copied ? 'Copied!' : 'Copy Invite Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupChat;
