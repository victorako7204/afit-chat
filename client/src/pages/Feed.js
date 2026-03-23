/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart,
  MessageSquare,
  Share2,
  Send,
  Loader2,
  User,
  Lock,
  X,
  Trash2,
  CornerUpLeft
} from 'lucide-react';
import { socket, connectSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';
import api from '../services/api';

const Feed = () => {
  const { user } = useAuth();
  const { darkMode } = React.useContext(ThemeContext);
  
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [commentText, setCommentText] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const pendingPostIds = useRef(new Set());
  
  const postsEndRef = useRef(null);

  const glassCard = `rounded-2xl backdrop-blur-xl border ${
    darkMode ? 'bg-white/5 border-white/10' : 'bg-white/50 border-white/20'
  }`;

  const loadPosts = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      
      const response = await api.get(`/posts?page=${pageNum}&limit=10`);
      const { posts: newPosts, hasMore: more } = response.data;
      
      const postsWithLikes = newPosts.map(p => ({
        ...p,
        isLiked: p.likes?.includes(user?._id),
        likeCount: p.likes?.length || 0
      }));
      
      if (append) {
        setPosts(prev => [...prev, ...postsWithLikes]);
      } else {
        setPosts(postsWithLikes);
      }
      
      setHasMore(more);
      setPage(pageNum);
      
      const likedSet = new Set();
      postsWithLikes.forEach(p => {
        if (p.isLiked) likedSet.add(p._id);
      });
      setLikedPosts(likedSet);
    } catch (error) {
      console.error('Load posts error:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [user?._id]);

  useEffect(() => {
    connectSocket();
    loadPosts();

    return () => {
      socket.off('newPost');
      socket.off('postLiked');
      socket.off('postDeleted');
    };
  }, []);

  useEffect(() => {
    const handleNewPost = (post) => {
      console.log('📝 New post received:', post);
      
      if (pendingPostIds.current.has(post._id)) {
        console.log('🔄 Skipping duplicate post (pending):', post._id);
        pendingPostIds.current.delete(post._id);
        return;
      }
      
      const exists = posts.some(p => p._id === post._id);
      if (exists) {
        console.log('🔄 Skipping duplicate post:', post._id);
        return;
      }
      
      const postWithLike = {
        ...post,
        isLiked: false,
        likeCount: post.likes?.length || 0
      };
      setPosts(prev => [postWithLike, ...prev]);
    };

    const handlePostLiked = ({ postId, likes }) => {
      setPosts(prev => prev.map(p => {
        if (p._id === postId) {
          return {
            ...p,
            likes,
            likeCount: likes.length,
            isLiked: likes.includes(user?._id)
          };
        }
        return p;
      }));
    };

    const handlePostDeleted = ({ postId }) => {
      setPosts(prev => prev.filter(p => p._id !== postId));
    };

    socket.on('newPost', handleNewPost);
    socket.on('postLiked', handlePostLiked);
    socket.on('postDeleted', handlePostDeleted);

    return () => {
      socket.off('newPost');
      socket.off('postLiked');
      socket.off('postDeleted');
    };
  }, [user?._id]);

  const handlePost = async () => {
    if (!newPost.trim() || isPosting) return;
    
    setIsPosting(true);
    try {
      const response = await api.post('/posts', {
        content: newPost.trim(),
        isAnonymous,
        replyTo: replyingTo?._id || null
      });
      
      if (response.data?._id) {
        pendingPostIds.current.add(response.data._id);
      }
      
      setNewPost('');
      setIsAnonymous(false);
      setReplyingTo(null);
    } catch (error) {
      console.error('Post error:', error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      await api.post(`/posts/${postId}/like`);
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api.delete(`/posts/${postId}`);
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      loadPosts(page + 1, true);
    }
  };

  const toggleComments = (postId) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const handleComment = async (postId) => {
    const text = commentText[postId];
    if (!text?.trim()) return;
    
    try {
      await api.post(`/posts/${postId}/comment`, { content: text.trim() });
      setCommentText(prev => ({ ...prev, [postId]: '' }));
    } catch (error) {
      console.error('Comment error:', error);
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="px-4 md:px-6 max-w-2xl mx-auto space-y-4 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 ${glassCard}`}
      >
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1">
            <AnimatePresence>
              {replyingTo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`mb-3 p-2 rounded-lg flex items-center gap-2 ${
                    darkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-200'
                  }`}
                >
                  <CornerUpLeft className={`w-4 h-4 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} />
                  <span className={`text-sm flex-1 truncate ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    Replying to: {replyingTo.isAnonymous ? 'Anonymous' : replyingTo.authorName}
                  </span>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className={`p-1 rounded-full hover:bg-white/10 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value.slice(0, 500))}
              placeholder={replyingTo ? "Write your reply..." : "What's on your mind?"}
              className={`w-full p-3 rounded-xl resize-none border focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                darkMode ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
              rows={3}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <label className={`flex items-center gap-2 cursor-pointer text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <Lock className="w-4 h-4" />
                  Anonymous
                </label>
                <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                  {newPost.length}/500
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handlePost}
                disabled={!newPost.trim() || isPosting}
                className={`px-5 py-2 rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50 ${
                  newPost.trim() 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30' 
                    : darkMode ? 'bg-slate-700 text-slate-500' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isPosting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Post
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className={`w-8 h-8 animate-spin ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
        </div>
      ) : posts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-center py-12 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}
        >
          <p>No posts yet. Be the first to share something!</p>
        </motion.div>
      ) : (
        <>
          <AnimatePresence>
            {posts.map((post, index) => (
              <motion.div
                key={post._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 ${glassCard}`}
              >
                <div className="flex gap-3">
                  {post.isAnonymous ? (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center flex-shrink-0">
                      <Lock className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {post.authorName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {post.replyTo && (
                      <div className={`text-xs mb-1 flex items-center gap-1 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`}>
                        <CornerUpLeft className="w-3 h-3" />
                        <span>Replying to {post.replyToAuthor || 'a post'}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {post.isAnonymous ? 'Anonymous' : post.authorName}
                        </p>
                        {!post.isAnonymous && post.authorDepartment && (
                          <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                            {post.authorDepartment}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                          {formatTime(post.createdAt)}
                        </span>
                        {post.authorId === user?._id && (
                          <button
                            onClick={() => handleDelete(post._id)}
                            className={`p-1 rounded hover:bg-red-500/20 transition-colors ${darkMode ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <p className={`mt-2 whitespace-pre-wrap ${darkMode ? 'text-slate-200' : 'text-gray-700'}`}>
                      {post.content}
                    </p>
                    
                    <div className={`flex items-center gap-1 mt-3 pt-3 border-t ${darkMode ? 'border-white/10 text-slate-400' : 'border-gray-100 text-gray-500'}`}>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleLike(post._id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                          post.isLiked 
                            ? 'bg-red-500/20 text-red-500' 
                            : darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-current' : ''}`} />
                        <span className="text-sm">{post.likeCount}</span>
                      </motion.button>
                      
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toggleComments(post._id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                          darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-sm">{post.comments?.length || 0}</span>
                      </motion.button>
                      
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setReplyingTo(post)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                          darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                        }`}
                      >
                        <CornerUpLeft className="w-4 h-4" />
                      </motion.button>
                      
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                          darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Share2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                    
                    <AnimatePresence>
                      {expandedComments.has(post._id) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 space-y-3"
                        >
                          {post.comments?.map((comment, i) => (
                            <div key={i} className={`p-2 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3" />
                                <span className={`text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                                  {comment.authorId?.name || 'User'}
                                </span>
                              </div>
                              <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                                {comment.content}
                              </p>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={commentText[post._id] || ''}
                              onChange={(e) => setCommentText(prev => ({ ...prev, [post._id]: e.target.value }))}
                              placeholder="Write a comment..."
                              className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                                darkMode ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                              }`}
                              onKeyDown={(e) => e.key === 'Enter' && handleComment(post._id)}
                            />
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleComment(post._id)}
                              className="px-4 py-2 bg-blue-500 text-white rounded-lg"
                            >
                              <Send className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {hasMore && (
            <div className="flex justify-center py-4">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={loadMore}
                disabled={isLoadingMore}
                className={`px-6 py-2 rounded-xl font-medium transition-colors ${
                  darkMode ? 'bg-white/10 text-slate-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isLoadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  'Load More'
                )}
              </motion.button>
            </div>
          )}
        </>
      )}
      <div ref={postsEndRef} />
    </div>
  );
};

export default Feed;
