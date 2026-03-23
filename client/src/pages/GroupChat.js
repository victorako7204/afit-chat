import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupAPI, chatAPI } from '../services/api';
import { socket, connectSocket, joinRoom, leaveRoom, sendMessageSocket } from '../services/socket';
import { Button, Card, ChatBubble, Modal } from '../components/UI';

const GroupChat = () => {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', department: '' });
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const LIMIT = 20;

  const chatRoomId = `group-${groupId}`;

  const isAdmin = group?.admins?.some(a => a._id === user?._id) || false;
  const isMember = group?.members?.some(m => m._id === user?._id) || false;
  const isLocked = group?.isLocked || false;
  const canSendMessage = !isLocked || isAdmin;

  const fetchGroup = useCallback(async () => {
    try {
      const res = await groupAPI.getGroups();
      const found = res.data.find(g => g._id === groupId);
      if (found) {
        setGroup(found);
      } else {
        navigate('/groups');
      }
    } catch (err) {
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  }, [groupId, navigate]);

  const fetchMessages = useCallback(async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await chatAPI.getMessages(chatRoomId, LIMIT, loadMore ? skip : 0);
      const { messages: newMessages, pagination } = res.data;

      if (loadMore) {
        setMessages((prev) => {
          if (!prev || !Array.isArray(prev)) return newMessages || [];
          return [...(newMessages || []), ...prev];
        });
        setSkip((prev) => prev + LIMIT);
      } else {
        setMessages(newMessages || []);
        setSkip(LIMIT);
      }

      setHasMore(pagination?.hasMore || false);
    } catch (err) {
      // Silently handle error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [chatRoomId, skip]);

  useEffect(() => {
    fetchGroup();
    connectSocket();

    return () => {
      leaveRoom(chatRoomId);
      socket.off('receiveMessage');
    };
  }, [groupId, chatRoomId, fetchGroup]);

  useEffect(() => {
    if (group) {
      joinRoom(chatRoomId);
      setSkip(0);
      setMessages([]);
      fetchMessages(false);

      socket.off('receiveMessage');
      socket.on('receiveMessage', (message) => {
        if (message && message.chatId === chatRoomId) {
          setMessages((prev) => {
            if (!prev || !Array.isArray(prev)) return [message];
            const exists = prev.some(m => m && m._id === message._id);
            if (!exists) {
              return [...prev, message];
            }
            return prev;
          });
        }
      });
    }
  }, [group, chatRoomId, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !canSendMessage) return;

    const messageData = {
      chatId: chatRoomId,
      message: newMessage.trim(),
      chatType: 'group',
      senderId: user._id,
      senderName: user.name
    };

    sendMessageSocket(messageData);
    setNewMessage('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleToggleLock = async () => {
    if (!group || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await groupAPI.toggleLock(group._id);
      setGroup(res.data.group);
    } catch (err) {
      console.error('Error toggling lock:', err);
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
      console.error('Failed to copy invite link:', err);
    }
  };

  const handleMakeAdmin = async (targetUserId) => {
    if (!group || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await groupAPI.makeAdmin(group._id, targetUserId);
      setGroup(res.data.group);
    } catch (err) {
      console.error('Error making admin:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditModal = () => {
    setEditForm({
      name: group?.name || '',
      description: group?.description || '',
      department: group?.department || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!group || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await groupAPI.updateGroup(group._id, editForm);
      setGroup(res.data.group);
      setShowEditModal(false);
    } catch (err) {
      console.error('Error updating group:', err);
      alert(err?.response?.data?.message || 'Failed to update group');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!group || regeneratingCode) return;
    setRegeneratingCode(true);
    try {
      const res = await groupAPI.regenerateInviteCode(group._id);
      setGroup(prev => ({ ...prev, inviteCode: res.data.inviteCode }));
    } catch (err) {
      console.error('Error regenerating invite code:', err);
    } finally {
      setRegeneratingCode(false);
    }
  };

  const handleCopyGroupInviteLink = async () => {
    if (!group?.inviteCode) return;
    const inviteLink = `${window.location.origin}/groups?invite=${group.inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy invite link:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <Card className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent mx-auto" />
          <p className="mt-4 text-gray-500">Loading group...</p>
        </Card>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <Card className="text-center py-12">
          <p className="text-gray-500">Group not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/groups')} className="mb-4">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Groups
        </Button>
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{group.name}</h2>
                <p className="text-sm text-gray-500">
                  {group.description} · {group.members?.length || 0} members
                  {isLocked && <span className="ml-2 text-red-500 font-medium">(Locked)</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowInviteModal(true)}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Invite
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowMembersModal(true)}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Members
              </Button>
              {isAdmin && (
                <>
                  <Button variant="outline" size="sm" onClick={handleOpenEditModal}>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Edit
                  </Button>
                  <Button
                    variant={isLocked ? 'danger' : 'outline'}
                    size="sm"
                    onClick={handleToggleLock}
                    disabled={actionLoading}
                  >
                    {isLocked ? 'Unlock' : 'Lock'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        {isMember ? (
          <>
            <div className="h-96 overflow-y-auto p-4 bg-gray-50">
              {loading && messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent" />
                </div>
              ) : messages && messages.length > 0 ? (
                <>
                  {hasMore && (
                    <div className="text-center mb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchMessages(true)}
                        disabled={loadingMore}
                      >
                        {loadingMore ? 'Loading...' : 'View Older Messages'}
                      </Button>
                    </div>
                  )}

                  {messages.map((msg, index) => {
                    if (!msg) return null;
                    const isOwn = msg.senderId && (msg.senderId._id === user?._id || msg.senderId === user?._id);
                    return (
                      <ChatBubble
                        key={msg._id || `msg-${index}`}
                        message={msg.message || ''}
                        isOwn={isOwn}
                        sender={msg.senderId && (msg.senderId.name || msg.senderName)}
                        timestamp={msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No messages yet. Start the conversation!
                </div>
              )}
            </div>

            {canSendMessage ? (
              <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
                <div className="flex gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <Button type="submit" disabled={!newMessage.trim()} className="bg-purple-600 hover:bg-purple-700">
                    Send
                  </Button>
                </div>
              </form>
            ) : (
              <div className="p-4 text-center bg-red-50 border-t border-gray-200">
                <p className="text-red-500 font-medium">This group is locked by admin.</p>
              </div>
            )}
          </>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="mt-3">Join this group to participate in the chat</p>
            </div>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        title="Group Members"
        size="md"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {group.members?.map((member) => {
            if (!member || !member._id) return null;
            const memberIsAdmin = group.admins?.some(a => a._id === member._id) || false;
            const memberIsCreator = group.createdBy?._id === member._id || false;
            const canPromote = isAdmin && !memberIsAdmin && !memberIsCreator && member._id !== user?._id;
            
            return (
              <div key={member._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold">
                    {member.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{member.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{member.matricNo || ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {memberIsCreator && (
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Creator</span>
                  )}
                  {memberIsAdmin && (
                    <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Admin</span>
                  )}
                  {canPromote && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMakeAdmin(member._id)}
                      disabled={actionLoading}
                    >
                      Make Admin
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite to Group"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">Share this invite link with others to join the group</p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-400 mb-2">Invite Code</p>
              <p className="text-2xl font-bold font-mono tracking-widest text-purple-600">{group.inviteCode || 'N/A'}</p>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={handleCopyInviteLink}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Invite Link
              </>
            )}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Group Settings"
        size="md"
      >
        <form onSubmit={handleUpdateGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter group name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={2}
              placeholder="Group description (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              type="text"
              value={editForm.department}
              onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Department (optional)"
            />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium text-gray-900">Invite Code</h4>
                <p className="text-sm text-gray-500">Share this code with others to invite them</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-purple-100 text-purple-700 font-mono font-bold rounded">
                  {group.inviteCode || 'N/A'}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateInviteCode}
                  disabled={regeneratingCode}
                >
                  {regeneratingCode ? 'Generating...' : 'Regenerate'}
                </Button>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleCopyGroupInviteLink}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Link Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Copy Invite Link
                </>
              )}
            </Button>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium text-gray-900">Group Lock</h4>
                <p className="text-sm text-gray-500">
                  {isLocked ? 'Only admins can send messages' : 'All members can send messages'}
                </p>
              </div>
              <Button
                type="button"
                variant={isLocked ? 'outline' : 'danger'}
                size="sm"
                onClick={handleToggleLock}
                disabled={actionLoading}
              >
                {isLocked ? 'Unlock Group' : 'Lock Group'}
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={actionLoading || !editForm.name.trim()}>
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default GroupChat;
