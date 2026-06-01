import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Search, Grid, BookOpen, Users, Hash, Loader2 } from 'lucide-react';

const FILTERS = [
  { key: 'posts', icon: Grid, label: 'Posts' },
  { key: 'modules', icon: BookOpen, label: 'Modules' },
  { key: 'people', icon: Users, label: 'People' },
  { key: 'tags', icon: Hash, label: 'Tags' },
];

const Explore = () => {
  useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/posts?limit=30');
      setPosts(res.data?.posts || []);
    } catch (err) {
      console.error('Explore fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const filteredPosts = posts.filter(p =>
    !query || p.content?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search AFIT..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none' }}
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
        {FILTERS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all btn-press"
            style={{
              backgroundColor: activeFilter === key ? 'var(--accent)' : 'var(--bg-secondary)',
              color: activeFilter === key ? 'white' : 'var(--text-secondary)'
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : activeFilter === 'posts' ? (
        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-0.5 px-0">
          {filteredPosts.map(post => (
            <div
              key={post._id}
              onClick={() => navigate('/feed')}
              className="aspect-square relative overflow-hidden cursor-pointer group"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
              <div className="w-full h-full flex items-center justify-center p-3 text-center">
                <span className="text-xs leading-tight line-clamp-4" style={{ color: 'var(--text-tertiary)' }}>
                  {post.content || '📝'}
                </span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <div className="flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  <span className="text-xs font-semibold text-white">{post.likes?.length || 0}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredPosts.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-16 text-center px-8">
              <Search size={40} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>No posts found</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-8">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{activeFilter} coming soon</p>
        </div>
      )}
    </div>
  );
};

export default Explore;
