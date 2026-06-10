import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { connectSocket, socket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { postsAPI } from '../services/api';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [commentText, setCommentText] = useState({});
  const pendingActionQueue = useRef([]);
  const postsRef = useRef(posts);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const pullStartY = useRef(0);
  const isPulling = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const contentRef = useRef(null);

  const fetchPosts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else if (!cursor) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const params = { limit: 10 };
      if (!isRefresh && cursor) {
        params.cursor = cursor;
      }

      const res = await postsAPI.getPosts(params);
      const { posts: newPosts, nextCursor, hasMore: more } = res.data.data;

      if (isRefresh) {
        setPosts(newPosts);
      } else if (!cursor) {
        setPosts(newPosts);
      } else {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p._id));
          const unique = newPosts.filter(p => !existingIds.has(p._id));
          return [...prev, ...unique];
        });
      }

      setCursor(nextCursor);
      setHasMore(more);
    } catch {
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [cursor]);

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    connectSocket();

    const handleNewPost = (post) => {
      setPosts(prev => {
        const exists = prev.some(p => p._id === post._id);
        if (exists) return prev;
        return [{ ...post, isLikedByUser: false, likeCount: post.likeCount || 0, commentCount: post.commentCount || 0 }, ...prev];
      });
    };

    const handlePostDeleted = ({ postId }) => {
      setPosts(prev => prev.filter(p => p._id !== postId));
    };

    const handlePostEdited = ({ _id, content, editedAt }) => {
      setPosts(prev => prev.map(p =>
        p._id === _id ? { ...p, content, editedAt } : p
      ));
    };

    const handlePostLiked = ({ postId, likeCount }) => {
      setPosts(prev => prev.map(p =>
        p._id === postId ? { ...p, likeCount } : p
      ));
    };

    const handleNewComment = ({ postId, comment }) => {
      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        const exists = p.comments?.some(c => c._id === comment._id);
        if (exists) return p;
        return {
          ...p,
          commentCount: (p.commentCount || 0) + 1,
          comments: [...(p.comments || []).slice(0, 1), comment]
        };
      }));
    };

    socket.on('newPost', handleNewPost);
    socket.on('postDeleted', handlePostDeleted);
    socket.on('postEdited', handlePostEdited);
    socket.on('postLiked', handlePostLiked);
    socket.on('newComment', handleNewComment);

    return () => {
      socket.off('newPost', handleNewPost);
      socket.off('postDeleted', handlePostDeleted);
      socket.off('postEdited', handlePostEdited);
      socket.off('postLiked', handlePostLiked);
      socket.off('newComment', handleNewComment);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      const queue = [...pendingActionQueue.current];
      pendingActionQueue.current = [];
      queue.forEach(action => action());
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore && !isLoading) {
      fetchPosts();
    }
  }, [hasMore, isLoadingMore, isLoading, fetchPosts]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: handleLoadMore,
    hasMore,
    isLoading: isLoadingMore
  });

  const handleRefresh = useCallback(() => {
    setCursor(null);
    fetchPosts(true);
  }, [fetchPosts]);

  const handleCreatePost = useCallback(async (formData, onSuccess) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (isOffline) {
      pendingActionQueue.current.push(async () => {
        try {
          await postsAPI.createPost(formData);
          handleRefresh();
        } catch {
        }
      });
      setIsSubmitting(false);
      onSuccess?.();
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempPost = {
      _id: tempId,
      authorName: formData.isAnonymous ? 'Anonymous' : (user?.name || 'Unknown'),
      authorAvatar: formData.isAnonymous ? null : (user?.avatar || null),
      authorDepartment: user?.department || '',
      content: formData.content,
      image: formData.image || null,
      isAnonymous: formData.isAnonymous || false,
      likeCount: 0,
      commentCount: 0,
      isLikedByUser: false,
      createdAt: new Date().toISOString(),
      editedAt: null,
      isPending: true,
      comments: []
    };

    setPosts(prev => [tempPost, ...prev]);

    try {
      const res = await postsAPI.createPost(formData);
      setPosts(prev => prev.map(p =>
        p._id === tempId ? { ...res.data.data, isPending: false } : p
      ));
      onSuccess?.();
    } catch {
      setPosts(prev => prev.map(p =>
        p._id === tempId ? { ...p, isPending: false, isFailed: true } : p
      ));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isOffline, user, handleRefresh]);

  const handleRetryPost = useCallback(async (post) => {
    if (!post.isFailed) return;
    setPosts(prev => prev.map(p =>
      p._id === post._id ? { ...p, isPending: true, isFailed: false } : p
    ));
    try {
      const res = await postsAPI.createPost({
        content: post.content,
        image: post.image,
        isAnonymous: post.isAnonymous
      });
      setPosts(prev => prev.map(p =>
        p._id === post._id ? { ...res.data.data, isPending: false } : p
      ));
    } catch {
      setPosts(prev => prev.map(p =>
        p._id === post._id ? { ...p, isPending: false, isFailed: true } : p
      ));
    }
  }, []);

  const handleLike = useCallback(async (postId) => {
    const prevPosts = postsRef.current;
    setPosts(prev => prev.map(p => {
      if (p._id !== postId) return p;
      const newLiked = !p.isLikedByUser;
      return {
        ...p,
        isLikedByUser: newLiked,
        likeCount: newLiked ? p.likeCount + 1 : Math.max(0, p.likeCount - 1)
      };
    }));

    try {
      const res = await postsAPI.likePost(postId);
      setPosts(prev => prev.map(p =>
        p._id === postId
          ? { ...p, likeCount: res.data.data.likeCount, isLikedByUser: res.data.data.isLikedByUser }
          : p
      ));
    } catch {
      setPosts(prevPosts);
    }
  }, []);

  const handleDeletePost = useCallback(async (postId) => {
    setPosts(prev => prev.map(p => p._id === postId ? { ...p, isDeleting: true } : p));
    try {
      await postsAPI.deletePost(postId);
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch {
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, isDeleting: false } : p));
    }
  }, []);

  const handleEditPost = useCallback(async (postId, content) => {
    const res = await postsAPI.editPost(postId, content);
    setPosts(prev => prev.map(p =>
      p._id === postId ? { ...p, content: res.data.data.content, editedAt: res.data.data.editedAt } : p
    ));
  }, []);

  const handleCommentToggle = useCallback((postId) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }, []);

  const handleComment = useCallback(async (postId) => {
    const text = commentText[postId]?.trim();
    if (!text) return;

    const tempComment = {
      _id: `temp-${Date.now()}`,
      authorName: user?.name || 'Unknown',
      content: text,
      createdAt: new Date().toISOString(),
      isPending: true
    };

    setCommentText(prev => ({ ...prev, [postId]: '' }));
    setPosts(prev => prev.map(p =>
      p._id === postId
        ? { ...p, comments: [...(p.comments || []), tempComment], commentCount: (p.commentCount || 0) + 1 }
        : p
    ));

    try {
      const res = await postsAPI.commentPost(postId, text, false);
      setPosts(prev => prev.map(p =>
        p._id === postId
          ? {
              ...p,
              comments: p.comments.map(c => c._id === tempComment._id ? { ...res.data.data, isPending: false } : c),
              commentCount: (p.commentCount || 0)
            }
          : p
      ));
    } catch {
      setPosts(prev => prev.map(p =>
        p._id === postId
          ? { ...p, comments: p.comments.filter(c => c._id !== tempComment._id), commentCount: Math.max(0, (p.commentCount || 0) - 1) }
          : p
      ));
    }
  }, [commentText, user]);

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
      handleRefresh();
      setPullDistance(0);
    } else {
      setPullDistance(0);
    }
  };

  const pullProgress = Math.min(pullDistance / 80, 1);

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ backgroundColor: 'var(--bg-primary)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isOffline && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium" style={{ backgroundColor: 'rgba(255,193,7,0.15)', color: '#ffc107' }}>
          <WifiOff size={14} />
          You're offline. Changes will sync when connected.
        </div>
      )}

      <div
        className="flex items-center justify-center overflow-hidden transition-all"
        style={{
          height: pullDistance > 0 || isRefreshing ? `${Math.max(pullDistance, isRefreshing ? 60 : 0)}px` : '0px',
          opacity: pullDistance > 0 || isRefreshing ? 1 : 0,
        }}
      >
        <div className="flex items-center justify-center gap-2" style={{ color: 'var(--accent)' }}>
          {isRefreshing ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <svg
              className="transition-transform"
              style={{ transform: `rotate(${pullProgress * 180}deg)` }}
              width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5"
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

      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
        >
          <div className="w-7 h-7 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
              {user?.name?.[0] || 'U'}
            </div>
          </div>
          What's on your mind?
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
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
          {posts.map(post => (
            <div key={post._id} className="relative">
              <PostCard
                post={post}
                onLike={handleLike}
                onComment={handleCommentToggle}
                onDelete={handleDeletePost}
                onEdit={handleEditPost}
                currentUserId={user?._id}
              />
              {post.isFailed && (
                <div className="flex items-center justify-center gap-2 px-4 py-2" style={{ backgroundColor: 'rgba(255,0,0,0.05)' }}>
                  <span className="text-xs" style={{ color: 'var(--danger)' }}>Failed to post.</span>
                  <button
                    onClick={() => handleRetryPost(post)}
                    className="text-xs font-semibold flex items-center gap-1"
                    style={{ color: 'var(--accent)' }}
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                </div>
              )}
              {expandedComments.has(post._id) && (
                <div className="px-4 py-2 space-y-2" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  {post.comments?.map(comment => (
                    <div key={comment._id} className="flex items-start gap-2 text-sm">
                      <span className="font-semibold text-xs shrink-0">{comment.authorName}</span>
                      <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                        {comment.content}
                        {comment.isPending && (
                          <Loader2 size={10} className="animate-spin inline ml-1" />
                        )}
                      </span>
                    </div>
                  ))}
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleComment(post._id); }}
                    className="flex gap-2 mt-2"
                  >
                    <input
                      value={commentText[post._id] || ''}
                      onChange={e => setCommentText(prev => ({ ...prev, [post._id]: e.target.value }))}
                      placeholder="Add a comment..."
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg outline-none"
                      style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                    />
                    <button
                      type="submit"
                      disabled={!commentText[post._id]?.trim()}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: 'var(--accent)', color: 'white', opacity: commentText[post._id]?.trim() ? 1 : 0.4 }}
                    >
                      Post
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
          {isLoadingMore && (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent)' }} />
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="text-center text-xs py-6" style={{ color: 'var(--text-tertiary)' }}>No more posts</p>
          )}
          <div ref={sentinelRef} className="h-4" />
        </div>
      )}

      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePost}
        user={user}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default Feed;
