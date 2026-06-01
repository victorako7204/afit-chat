import { useNavigate } from 'react-router-dom';
import { MessageCircle, BookOpen, Gamepad2, HelpCircle, Trophy, MapPin, Bell, Users, MessageSquare, UserMinus, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DRAWER_ITEMS = [
  { path: '/direct-chat', icon: MessageCircle, label: 'Messages', color: '#0095F6' },
  { path: '/public-chat', icon: MessageSquare, label: 'Public Chat', color: '#A8A8A8' },
  { path: '/groups', icon: Users, label: 'Groups', color: '#A8A8A8' },
  { path: '/anonymous-chat', icon: UserMinus, label: 'Anonymous Chat', color: '#A8A8A8' },
  { path: '/library', icon: BookOpen, label: 'Library', color: '#00D26A' },
  { path: '/games', icon: Gamepad2, label: 'Games', color: '#ED4956' },
  { path: '/quiz', icon: HelpCircle, label: 'Quiz', color: '#0095F6' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard', color: '#FFD700' },
  { path: '/lost-and-found', icon: MapPin, label: 'Lost & Found', color: '#FF8C00' },
  { path: '/notifications', icon: Bell, label: 'Notifications', color: '#0095F6' },
];

const MoreDrawer = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleClick = (path) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} />
      <div
        className="relative w-full max-w-[400px] md:rounded-xl rounded-t-2xl overflow-hidden animate-slide-up"
        style={{ backgroundColor: 'var(--bg-secondary)', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold">More</span>
          <button onClick={onClose} className="p-1 btn-press" style={{ color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-2" style={{ maxHeight: 'calc(80vh - 48px)' }}>
          <div className="grid grid-cols-3 gap-2">
            {DRAWER_ITEMS.map(({ path, icon: Icon, label, color }) => (
              <button
                key={path}
                onClick={() => handleClick(path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl transition-colors btn-press"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
                  <Icon size={20} color={color} />
                </div>
                <span className="text-[11px] font-medium text-center leading-tight" style={{ color: 'var(--text-primary)' }}>{label}</span>
              </button>
            ))}
          </div>
          {user?.role === 'admin' && (
            <>
              <div className="mx-2 my-3" style={{ borderTop: '1px solid var(--border)' }} />
              <button
                onClick={() => handleClick('/admin')}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors btn-press"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <ShieldCheck size={20} color="#ED4956" />
                <span className="text-sm font-medium">Admin Panel</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoreDrawer;
