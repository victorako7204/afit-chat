import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, PlusSquare, GraduationCap, User, Menu } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/feed', icon: Home, label: 'Home' },
  { path: '/explore', icon: Search, label: 'Explore' },
  null,
  { path: '/education', icon: GraduationCap, label: 'Learn' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const BottomNav = ({ onMoreOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="flex-shrink-0" style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
      <div className="flex items-center justify-around h-[49px] px-2">
        {NAV_ITEMS.map((item, i) => {
          if (item === null) {
            return (
              <button
                key="create"
                onClick={() => navigate('/feed')}
                className="flex items-center justify-center w-11 h-11 rounded-full"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <PlusSquare size={20} strokeWidth={2} color="white" />
              </button>
            );
          }
          const { path, icon: Icon, label } = item;
          const active = location.pathname === path || (path === '/feed' && location.pathname === '/');

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center justify-center gap-0.5 w-14 h-full btn-press"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.5}
                color={active ? 'var(--accent)' : 'var(--text-secondary)'}
                fill={path === '/profile' && active ? 'var(--accent)' : 'none'}
              />
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}
              >
                {label}
              </span>
            </button>
          );
        })}
        <button
          onClick={onMoreOpen}
          className="flex flex-col items-center justify-center gap-0.5 w-14 h-full btn-press"
        >
          <Menu size={22} strokeWidth={1.5} color="var(--text-secondary)" />
          <span className="text-[10px] font-medium leading-none" style={{ color: 'var(--text-secondary)' }}>More</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
