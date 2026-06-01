import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, PlusSquare, Heart, User } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/feed', icon: Home, label: 'Home' },
  { path: '/education', icon: Search, label: 'Explore' },
  { path: '/public-chat', icon: PlusSquare, label: 'Chat' },
  { path: '/direct-chat', icon: Heart, label: 'Messages' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="sticky bottom-0 z-50 flex-shrink-0" style={{backgroundColor:'var(--bg-primary)', borderTop:'1px solid var(--border)'}}>
      <div className="flex items-center justify-around h-12 px-2">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex items-center justify-center w-12 h-10 btn-press"
            >
              <Icon
                size={24}
                strokeWidth={active ? 2.5 : 1.5}
                color={active ? 'var(--accent)' : 'var(--text-primary)'}
                fill={active ? 'var(--accent)' : 'none'}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
