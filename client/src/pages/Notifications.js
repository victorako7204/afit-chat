import { useState, useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Heart, MessageCircle, UserPlus, BookOpen, Trophy, Bell, CheckCheck, Loader2 } from 'lucide-react';

const ICON_MAP = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  module: BookOpen,
  win: Trophy,
};

const COLOR_MAP = {
  like: '#ED4956',
  comment: '#0095F6',
  follow: '#00D26A',
  module: '#0095F6',
  win: '#FFD700',
};

const Notifications = () => {
  useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/notifications');
        setNotifications(res.data || []);
      } catch (err) {
        console.error('Notifications error:', err);
        const mock = [
          { _id: '1', type: 'like', message: 'John liked your post', createdAt: new Date(), read: false },
          { _id: '2', type: 'comment', message: 'Sarah commented on your post', createdAt: new Date(Date.now() - 3600000), read: false },
          { _id: '3', type: 'follow', message: 'Michael started following you', createdAt: new Date(Date.now() - 86400000), read: true },
          { _id: '4', type: 'module', message: 'New module: Calculus I available', createdAt: new Date(Date.now() - 172800000), read: true },
        ];
        setNotifications(mock);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    try { await api.put('/notifications/read-all'); } catch {}
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const groupByDate = (items) => {
    const groups = {};
    items.forEach(item => {
      const date = new Date(item.createdAt).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  const grouped = groupByDate(notifications);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-lg font-bold">Notifications</span>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-semibold btn-press" style={{ color: 'var(--accent)' }}>
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <Bell size={40} style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>No notifications yet</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="px-4 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-primary)' }}>
                {date === new Date().toLocaleDateString() ? 'Today' : date === new Date(Date.now() - 86400000).toLocaleDateString() ? 'Yesterday' : date}
              </div>
              {items.map(notif => {
                const Icon = ICON_MAP[notif.type] || Bell;
                const color = COLOR_MAP[notif.type] || 'var(--text-secondary)';
                return (
                  <div
                    key={notif._id}
                    className="flex items-center gap-3 px-4 py-3 transition-colors btn-press"
                    style={{
                      backgroundColor: notif.read ? 'transparent' : 'var(--bg-secondary)',
                      borderBottom: '1px solid var(--border)'
                    }}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: color + '20' }}>
                      <Icon size={16} color={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {notif.message}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
