import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Search, GraduationCap, User, MessageCircle, BookOpen, Gamepad2, HelpCircle, Trophy, MapPin, Bell, ShieldCheck, LogOut } from 'lucide-react';

const MAIN_ITEMS = [
  { path: '/feed', icon: Home, label: 'Home' },
  { path: '/explore', icon: Search, label: 'Explore' },
  { path: '/education', icon: GraduationCap, label: 'Learn' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const SECONDARY_ITEMS = [
  { path: '/direct-chat', icon: MessageCircle, label: 'Messages' },
  { path: '/library', icon: BookOpen, label: 'Library' },
  { path: '/games', icon: Gamepad2, label: 'Games' },
  { path: '/quiz', icon: HelpCircle, label: 'Quiz' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { path: '/lost-and-found', icon: MapPin, label: 'Lost & Found' },
  { path: '/notifications', icon: Bell, label: 'Notifications' },
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleNav = (path) => {
    navigate(path);
  };

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full z-40" style={{ width: 'var(--sidebar-width)', backgroundColor: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}>
      {/* Logo */}
      <div className="flex items-center h-[56px] px-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xl font-bold tracking-tight">AFIT</span>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5 px-3 pt-4 pb-3">
        {MAIN_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className="flex items-center gap-3 px-3 h-11 rounded-lg transition-colors btn-press"
              style={{
                backgroundColor: active ? 'var(--bg-tertiary)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-2" style={{ borderTop: '1px solid var(--border)' }} />

      {/* Secondary nav */}
      <nav className="flex flex-col gap-0.5 px-3 py-1 flex-1 overflow-y-auto">
        {SECONDARY_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className="flex items-center gap-3 px-3 h-10 rounded-lg transition-colors btn-press"
              style={{
                backgroundColor: active ? 'var(--bg-tertiary)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-sm">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 shrink-0" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        {user?.role === 'admin' && (
          <button
            onClick={() => handleNav('/admin')}
            className="flex items-center gap-3 px-3 h-10 w-full rounded-lg transition-colors btn-press mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ShieldCheck size={20} />
            <span className="text-sm">Admin</span>
          </button>
        )}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
            {user?.name?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.name || 'User'}</p>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{user?.department || 'AFIT'}</p>
          </div>
          <button onClick={logout} className="p-1.5 rounded-lg btn-press" style={{ color: 'var(--text-tertiary)' }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
