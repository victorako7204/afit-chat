/* eslint-disable */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeContext } from '../App';

const BottomNav = () => {
  const { darkMode } = React.useContext(ThemeContext);
  const location = useLocation();

  const navItems = [
    { path: '/public-chat', label: 'Chat', icon: 'chat' },
    { path: '/games', label: 'Games', icon: 'gamepad' },
    { path: '/feed', label: 'Feed', icon: 'feed' },
    { path: '/profile', label: 'Profile', icon: 'profile' }
  ];

  const icons = {
    chat: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    gamepad: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
    feed: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-.586-1.414l-4.5-4.5A2 2 0 0015.586 3H19a2 2 0 002-2v10a2 2 0 01-2 2h-2z" />
      </svg>
    ),
    profile: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  };

  const bgColor = darkMode 
    ? 'bg-slate-950/95 backdrop-blur-xl border-t border-slate-800' 
    : 'bg-white/95 backdrop-blur-xl border-t border-gray-200';

  return (
    <nav className={`fixed bottom-0 left-0 right-0 ${bgColor} lg:hidden z-50 safe-area-inset-bottom`}>
      <div className="flex items-center justify-around py-2 px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === '/public-chat' && location.pathname.startsWith('/direct-chat')) ||
            (item.path === '/games' && (location.pathname.startsWith('/chess') || location.pathname.startsWith('/tictactoe')));
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'text-blue-500' 
                  : darkMode ? 'text-slate-500' : 'text-gray-400'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${
                isActive 
                  ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30 text-white' 
                  : ''
              }`}>
                {icons[item.icon]}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-blue-500' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
