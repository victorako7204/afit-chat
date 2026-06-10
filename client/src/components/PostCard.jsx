import React, { useState, useRef, useCallback, memo } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Edit, Trash2, Loader2 } from 'lucide-react';

const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'demo';

const PostImage = memo(({ publicId, imageUrl, alt }) => {
  const [loaded, setLoaded] = useState(false);
  const src = publicId
    ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_400,q_auto:good,f_auto/${publicId}`
    : imageUrl;

  return (
    <div className="relative w-full aspect-square" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {!loaded && <div className="absolute inset-0 skeleton animate-pulse" />}
      <img
        src={src}
        srcSet={publicId ? `
          https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_400,q_auto:good,f_auto/${publicId} 400w,
          https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_600,q_auto:good,f_auto/${publicId} 600w
        ` : undefined}
        sizes="(max-width: 768px) 100vw, 600px"
        alt={alt || ''}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
});

const PostCard = memo(({ post, onLike, onComment, onDelete, onEdit, currentUserId }) => {
  const [showHeart, setShowHeart] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const lastTapRef = useRef(0);
  const heartTimeoutRef = useRef(null);
  const editInputRef = useRef(null);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!post.isLikedByUser) onLike?.(post._id);
      setShowHeart(true);
      if (heartTimeoutRef.current) clearTimeout(heartTimeoutRef.current);
      heartTimeoutRef.current = setTimeout(() => setShowHeart(false), 800);
    }
    lastTapRef.current = now;
  }, [post._id, post.isLikedByUser, onLike]);

  const handleLikeClick = useCallback((e) => {
    e.stopPropagation();
    onLike?.(post._id);
  }, [post._id, onLike]);

  const handleCommentClick = useCallback(() => {
    onComment?.(post._id);
  }, [post._id, onComment]);

  const handleDelete = useCallback(() => {
    if (window.confirm('Delete this post? This cannot be undone.')) {
      onDelete?.(post._id);
    }
  }, [post._id, onDelete]);

  const handleEditStart = useCallback(() => {
    setEditContent(post.content || '');
    setEditError(null);
    setIsEditing(true);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }, [post.content]);

  const handleEditSave = useCallback(async () => {
    if (!editContent.trim() || editContent === post.content) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    setEditError(null);
    try {
      await onEdit?.(post._id, editContent.trim());
      setIsEditing(false);
    } catch {
      setEditError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [editContent, post._id, post.content, onEdit]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditError(null);
    setEditContent(post.content || '');
  }, [post.content]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/post/${post._id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
    }
  }, [post._id]);

  const timeAgo = (date) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  const isOwn = String(post.authorId?._id || post.authorId) === String(currentUserId);
  const canEdit = isOwn && !post.editedAt && (Date.now() - new Date(post.createdAt).getTime() < 15 * 60 * 1000);

  return (
    <div className="flex flex-col" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            {post.authorAvatar && !post.isAnonymous ? (
              <img src={post.authorAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: post.isAnonymous ? '#ffc107' : 'var(--accent)', color: 'white' }}>
                {post.isAnonymous ? '?' : (post.authorName?.[0] || 'U')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{post.authorName || 'Unknown'}</span>
            {post.isAnonymous && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(255,193,7,0.2)', color: '#ffc107' }}>
                Anonymous
              </span>
            )}
          </div>
          {post.department && (
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{post.department}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canEdit && !isEditing && (
            <button onClick={handleEditStart} className="p-1.5 rounded-lg btn-press" style={{ color: 'var(--text-secondary)' }}>
              <Edit size={14} />
            </button>
          )}
          {isOwn && (
            <button onClick={handleDelete} className="p-1.5 rounded-lg btn-press" style={{ color: 'var(--text-secondary)' }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {post.image && (
        <div className="relative w-full cursor-pointer" onClick={handleDoubleTap}>
          <PostImage
            publicId={post.imagePublicId}
            imageUrl={post.image}
            alt="Post image"
          />
          {showHeart && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Heart size={100} fill="white" stroke="none" className="animate-heart-pop" />
            </div>
          )}
        </div>
      )}

      {isEditing ? (
        <div className="px-4 py-2">
          <textarea
            ref={editInputRef}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            className="w-full resize-none text-sm p-2 rounded-lg outline-none"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--accent)' }}
            rows={3}
            maxLength={500}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={handleEditCancel}
              className="text-xs px-3 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleEditSave}
              disabled={isSaving || !editContent.trim()}
              className="text-xs px-3 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--accent)', color: 'white' }}
            >
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
            </button>
          </div>
          {editError && (
            <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{editError}</p>
          )}
        </div>
      ) : (
        <div className="px-4 py-2">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {post.content}
            {post.editedAt && <span className="text-[10px] ml-1 opacity-50">(edited)</span>}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4">
          <button onClick={handleLikeClick} className="btn-press flex items-center gap-1">
            <Heart
              size={20}
              fill={post.isLikedByUser ? 'var(--danger)' : 'none'}
              stroke={post.isLikedByUser ? 'var(--danger)' : 'var(--text-primary)'}
            />
            {post.likeCount > 0 && (
              <span className="text-xs font-semibold">{post.likeCount}</span>
            )}
          </button>
          <button onClick={handleCommentClick} className="btn-press flex items-center gap-1">
            <MessageCircle size={20} stroke="var(--text-primary)" />
            {post.commentCount > 0 && (
              <span className="text-xs font-semibold">{post.commentCount}</span>
            )}
          </button>
          <button onClick={handleShare} className="btn-press">
            <Share2 size={20} stroke="var(--text-primary)" />
          </button>
        </div>
        <button className="btn-press">
          <Bookmark size={20} stroke="var(--text-primary)" fill="none" />
        </button>
      </div>

      <div className="px-4 pb-1 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          {timeAgo(post.createdAt)}
        </span>
        {post.isPending && (
          <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            <Loader2 size={10} className="animate-spin" /> Sending...
          </span>
        )}
      </div>

      {post.comments?.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {post.comments.slice(0, 2).map((comment) => (
            <div key={comment._id} className="text-sm">
              <span className="font-semibold mr-1.5 text-xs">
                {comment.authorName}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                {comment.content}
              </span>
            </div>
          ))}
          {post.commentCount > 2 && (
            <button
              onClick={handleCommentClick}
              className="text-xs"
              style={{ color: 'var(--text-tertiary)' }}
            >
              View all {post.commentCount} comments
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default PostCard;
