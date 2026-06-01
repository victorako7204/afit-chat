import React, { useState, useRef } from 'react';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';

const PostCard = ({ post, onLike, onComment, currentUserId, onUserClick }) => {
  const [showHeart, setShowHeart] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const lastTapRef = useRef(0);
  const heartTimeoutRef = useRef(null);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!post.isLikedByUser) onLike?.(post._id);
      setShowHeart(true);
      if (heartTimeoutRef.current) clearTimeout(heartTimeoutRef.current);
      heartTimeoutRef.current = setTimeout(() => setShowHeart(false), 800);
    }
    lastTapRef.current = now;
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  return (
    <div className="flex flex-col" style={{borderBottom:'1px solid var(--border)'}}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onUserClick?.(post.authorId?._id || post.authorId)}>
          <div className="w-8 h-8 rounded-full overflow-hidden" style={{backgroundColor:'var(--bg-tertiary)'}}>
            {post.authorId?.avatar ? (
              <img src={post.authorId.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{backgroundColor:'var(--accent)', color:'white'}}>
                {(post.authorId?.name || 'U')[0]}
              </div>
            )}
          </div>
          <span className="text-sm font-semibold">{post.authorId?.name || 'Anonymous'}</span>
        </div>
        <button className="btn-press">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{color:'var(--text-secondary)'}}>
            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Image / Content */}
      <div className="relative w-full aspect-square cursor-pointer" onClick={handleDoubleTap} style={{backgroundColor:'var(--bg-secondary)'}}>
        {!imgLoaded && <div className="absolute inset-0 skeleton" />}
        {post.image ? (
          <img
            src={post.image}
            alt=""
            className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-6 text-center" style={{color:'var(--text-secondary)'}}>
            <p className="text-sm leading-relaxed">{post.content}</p>
          </div>
        )}
        {showHeart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart size={100} fill="white" stroke="none" className="animate-heart-pop" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4">
          <button onClick={() => onLike?.(post._id)} className="btn-press">
            <Heart
              size={22}
              fill={post.isLikedByUser ? 'var(--danger)' : 'none'}
              stroke={post.isLikedByUser ? 'var(--danger)' : 'var(--text-primary)'}
            />
          </button>
          <button onClick={() => onComment?.(post._id)} className="btn-press">
            <MessageCircle size={22} stroke="var(--text-primary)" />
          </button>
          <button className="btn-press">
            <Share2 size={22} stroke="var(--text-primary)" />
          </button>
        </div>
        <button className="btn-press">
          <Bookmark size={22} stroke="var(--text-primary)" fill="none" />
        </button>
      </div>

      {/* Likes */}
      {post.likesCount > 0 && (
        <div className="px-4 pb-1">
          <span className="text-sm font-semibold">{post.likesCount.toLocaleString()} likes</span>
        </div>
      )}

      {/* Caption */}
      <div className="px-4 pb-1">
        <span className="text-sm">
          <span className="font-semibold mr-1.5">{post.authorId?.name || 'Anonymous'}</span>
          {post.content && post.image && (
            <span style={{color:'var(--text-primary)'}}>{post.content}</span>
          )}
        </span>
      </div>

      {/* Comments preview */}
      {post.comments?.length > 0 && (
        <div className="px-4 pb-1">
          <button className="text-sm" style={{color:'var(--text-tertiary)'}}>
            View all {post.comments.length} comments
          </button>
        </div>
      )}

      {/* Timestamp */}
      <div className="px-4 pb-3">
        <span className="text-[10px] uppercase tracking-wide" style={{color:'var(--text-tertiary)'}}>
          {timeAgo(post.createdAt)}
        </span>
      </div>
    </div>
  );
};

export default PostCard;
