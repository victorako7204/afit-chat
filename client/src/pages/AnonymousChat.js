import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatAPI } from '../services/api';
import { socket, connectSocket, joinRoom, leaveRoom } from '../services/socket';
import { Button, Card, ChatBubble } from '../components/UI';

const AnonymousChat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatId = 'anonymous-chat';
  const LIMIT = 20;

  const fetchMessages = useCallback(async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await chatAPI.getMessages(chatId, LIMIT, loadMore ? skip : 0);
      const { messages: newMessages, pagination } = res.data;

      if (loadMore) {
        setMessages((prev) => [...newMessages, ...prev]);
        setSkip(skip + LIMIT);
      } else {
        setMessages(newMessages);
        setSkip(LIMIT);
      }

      setHasMore(pagination.hasMore);
    } catch (err) {
      // Silently handle error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [chatId, skip]);

  useEffect(() => {
    connectSocket();
    joinRoom(chatId);

    socket.on('receiveMessage', (message) => {
      if (message.chatType === 'anonymous' && message.chatId === chatId) {
        setMessages((prev) => [...prev, message]);
      }
    });

    return () => {
      leaveRoom(chatId);
      socket.off('receiveMessage');
    };
  }, [chatId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadOlderMessages = () => {
    if (!loadingMore && hasMore) {
      fetchMessages(true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);

    try {
      const res = await chatAPI.sendAnonymousMessage({
        chatId,
        message: newMessage.trim(),
        chatType: 'anonymous'
      });
      setMessages((prev) => [...prev, res.data.chat]);
      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      // Silently handle error
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <Card padding="none" className="overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Anonymous Chat</h2>
              <p className="text-sm text-gray-600">Share your thoughts freely. Your identity is protected.</p>
            </div>
          </div>
        </div>

        <div className="h-96 overflow-y-auto p-4 bg-gray-50">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-yellow-600 border-t-transparent mx-auto" />
                <p className="mt-3 text-gray-500">Loading messages...</p>
              </div>
            </div>
          ) : (
            <>
              {hasMore && (
                <div className="text-center mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadOlderMessages}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Loading...' : 'View Older Messages'}
                  </Button>
                </div>
              )}

              {messages.map((msg, index) => (
                <ChatBubble
                  key={msg._id || index}
                  message={msg.message}
                  isOwn={false}
                  isAnonymous={true}
                  timestamp={new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Share something anonymously..."
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-yellow-500 hover:bg-yellow-600"
            >
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AnonymousChat;
