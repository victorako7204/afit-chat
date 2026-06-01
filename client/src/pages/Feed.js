/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Heart, MessageCircle, Send, Loader2, X, CornerUpLeft } from 'lucide-react';
import { socket, connectSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import PostCard from '../components/PostCard';
import StoryBar from '../components/StoryBar';

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [commentText, setCommentText] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const pendingPostIds = useRef(new Set());
  const postsEndRef = useRef(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const isPulling = useRef(false);
  const contentRef = useRef(null);

  const loadPosts = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setIsLoading(true);
      else setIsLoadingMore(true);
      const response = await api.get(`/posts?page=${pageNum}&limit=10`);
      const { posts: newPosts, hasMore: more } = response.data;
      const postsWithLikes = newPosts.map(p => ({
        ...p, isLikedByUser: p.likes?.includes(user?._id) || false, likesCount: p.likes?.length || 0
      }));
      if (append) setPosts(prev => [...prev, ...postsWithLikes]);
      else setPosts(postsWithLikes);
      setHasMore(more !== undefined ? more : newPosts.length === 10);
    } catch (err) { console.error('Load posts error:', err); }
    finally { setIsLoading(false); setIsLoadingMore(false); }
  }, [user?._id]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    if (!socket) return;
    const handleNewPost = (post) => {
      if (pendingPostIds.current.has(post._id)) {
        pendingPostIds.current.delete(post._id);
        return;
      }
      setPosts(prev => [{
        ...post, isLikedByUser: post.likes?.includes(user?._id) || false, likesCount: post.likes?.length || 0
      }, ...prev]);
    };
    const handlePostUpdate = (updatedPost) => {
      setPosts(prev => prev.map(p => p._id === updatedPost._id ? { ...p, ...updatedPost, isLikedByUser: updatedPost.likes?.includes(user?._id) || false, likesCount: updatedPost.likes?.length || 0 } : p));
    };
    socket.on('newPost', handleNewPost);
    socket.on('postUpdated', handlePostUpdate);
    return () => { socket.off('newPost', handleNewPost); socket.off('postUpdated', handlePostUpdate); };
  }, [socket, user?._id]);

  const handleCreatePost = async () => {
    if (!newPost.trim() || isPosting) return;
    setIsPosting(true);
    try {
      const localId = `temp-${Date.now()}`;
      pendingPostIds.current.add(localId);
      const response = await api.post('/posts', { content: newPost, isAnonymous });
      setNewPost('');
      setIsAnonymous(false);
      setShowCreateModal(false);
      loadPosts(1);
    } catch (err) { console.error('Create post error:', err); }
    finally { setIsPosting(false); }
  };

  const handleLike = async (postId) => {
    const prev = [...posts];
    setPosts(prev => prev.map(p => p._id === postId ? { ...p, isLikedByUser: !p.isLikedByUser, likesCount: p.isLikedByUser ? p.likesCount - 1 : p.likesCount + 1 } : p));
    try { await api.post(`/posts/${postId}/like`); }
    catch { setPosts(prev); }
  };

  const handleComment = async (postId) => {
    if (!commentText[postId]?.trim()) return;
    try {
      await api.post(`/posts/${postId}/comment`, { text: commentText[postId] });
      setCommentText(prev => ({ ...prev, [postId]: '' }));
      loadPosts(1);
    } catch (err) { console.error('Comment error:', err); }
  };

  const handleScroll = useCallback(() => {
    if (!postsEndRef.current || isLoadingMore || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = document.querySelector('.overflow-y-auto') || {};
    if (scrollHeight - scrollTop - clientHeight < 300) {
      setPage(prev => prev + 1);
    }
  }, [isLoadingMore, hasMore]);

  useEffect(() => {
    const el = document.querySelector('.overflow-y-auto');
    if (el) { el.addEventListener('scroll', handleScroll); return () => el.removeEventListener('scroll', handleScroll); }
  }, [handleScroll]);

  useEffect(() => {
    if (page > 1) loadPosts(page, true);
  }, [page]);

  const [createOpen, setCreateOpen] = useState(false);

  const handleTouchStart = (e) => {
    if (contentRef.current && contentRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - pullStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 120));
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance > 80) {
      setIsRefreshing(true);
      setPullDistance(0);
      loadPosts(1).finally(() => {
        setIsRefreshing(false);
      });
    } else {
      setPullDistance(0);
    }
  };

  const pullProgress = Math.min(pullDistance / 80, 1);

  return (
    <div className="flex flex-col min-h-full" style={{backgroundColor:'var(--bg-primary)'}}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all"
        style={{
          height: pullDistance > 0 || isRefreshing ? `${Math.max(pullDistance, isRefreshing ? 60 : 0)}px` : '0px',
          opacity: pullDistance > 0 || isRefreshing ? 1 : 0,
        }}
      >
        <div
          className={`flex items-center justify-center gap-2 ${isRefreshing ? '' : ''}`}
          style={{ color: 'var(--accent)' }}
        >
          {isRefreshing ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <svg
              className="transition-transform"
              style={{ transform: `rotate(${pullProgress * 180}deg)` }}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
            </svg>
          )}
          <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {isRefreshing ? 'Refreshing...' : pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>
      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{backgroundColor:'rgba(0,0,0,0.7)'}} onClick={() => setShowCreateModal(false)}>
          <div className="w-full max-w-[500px] rounded-t-2xl overflow-hidden" style={{backgroundColor:'var(--bg-secondary)'}} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:'1px solid var(--border)'}}>
              <button onClick={() => setShowCreateModal(false)} className="text-sm font-semibold" style={{color:'var(--text-secondary)'}}>Cancel</button>
              <span className="text-sm font-semibold">New Post</span>
              <button onClick={handleCreatePost} disabled={!newPost.trim() || isPosting} className="text-sm font-semibold" style={{color: newPost.trim() ? 'var(--accent)' : 'var(--text-tertiary)'}}>
                {isPosting ? 'Posting...' : 'Share'}
              </button>
            </div>
            <div className="p-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0" style={{backgroundColor:'var(--bg-tertiary)'}}>
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{backgroundColor:'var(--accent)',color:'white'}}>
                    {user?.name?.[0] || 'U'}
                  </div>
                </div>
                <textarea
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                  placeholder="What's on your mind?"
                  className="flex-1 resize-none text-sm leading-relaxed bg-transparent border-none outline-none"
                  style={{color:'var(--text-primary)', minHeight:120}}
                  rows={5}
                />
              </div>
              <div className="flex items-center justify-between mt-4 pt-3" style={{borderTop:'1px solid var(--border)'}}>
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{color:'var(--text-secondary)'}}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Add Image
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{color:'var(--text-secondary)'}}>
                  <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="sr-only" />
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${isAnonymous ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isAnonymous ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </div>
                  Anonymous
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col">
          {[1,2,3].map(i => (
            <div key={i} className="flex flex-col gap-3 p-4" style={{borderBottom:'1px solid var(--border)'}}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full skeleton" />
                <div className="w-24 h-3 rounded skeleton" />
              </div>
              <div className="w-full aspect-square rounded skeleton" />
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded skeleton" />
                <div className="w-6 h-6 rounded skeleton" />
                <div className="w-6 h-6 rounded skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col" ref={contentRef}>
          <StoryBar users={posts.filter(p => p.authorId).map(p => p.authorId).filter((v,i,a) => a.findIndex(t => t?._id === v?._id) === i).slice(0, 10)} />
          {posts.map(post => (
            <PostCard
              key={post._id}
              post={post}
              onLike={handleLike}
              onComment={(id) => setExpandedComments(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
              currentUserId={user?._id}
              onUserClick={(id) => window.location.href = `/profile/${id}`}
            />
          ))}
          {isLoadingMore && (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin" size={24} style={{color:'var(--accent)'}} />
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="text-center text-xs py-6" style={{color:'var(--text-tertiary)'}}>No more posts</p>
          )}
          <div ref={postsEndRef} />
        </div>
      )}
    </div>
  );
};

export default Feed;
