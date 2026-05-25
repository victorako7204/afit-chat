import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const FloatingMenu = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div
      ref={menuRef}
      className={`absolute bottom-16 right-4 z-50 bg-neutral-900/95 text-white p-4 rounded-2xl shadow-xl backdrop-blur-md w-56 transition-all duration-200 origin-bottom-right ${
        isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex flex-col space-y-1">
        <button onClick={() => { navigate('/dashboard'); onClose(); }} className="flex items-center space-x-3 p-2.5 hover:bg-white/10 rounded-lg transition-colors">
          <span className="text-lg">📊</span>
          <span className="text-sm font-medium">Dashboard</span>
        </button>
        <button onClick={() => { navigate('/education'); onClose(); }} className="flex items-center space-x-3 p-2.5 hover:bg-white/10 rounded-lg transition-colors">
          <span className="text-lg">📚</span>
          <span className="text-sm font-medium">Educational Hub</span>
        </button>
        <button onClick={() => { navigate('/quiz'); onClose(); }} className="flex items-center space-x-3 p-2.5 hover:bg-white/10 rounded-lg transition-colors">
          <span className="text-lg">📝</span>
          <span className="text-sm font-medium">Quiz Simulator</span>
        </button>
        <button onClick={() => { navigate('/library'); onClose(); }} className="flex items-center space-x-3 p-2.5 hover:bg-white/10 rounded-lg transition-colors">
          <span className="text-lg">📖</span>
          <span className="text-sm font-medium">Digital Library</span>
        </button>
        <button onClick={() => { navigate('/games'); onClose(); }} className="flex items-center space-x-3 p-2.5 hover:bg-white/10 rounded-lg transition-colors">
          <span className="text-lg">🎮</span>
          <span className="text-sm font-medium">Games Section</span>
        </button>
        <button onClick={() => { navigate('/profile'); onClose(); }} className="flex items-center space-x-3 p-2.5 hover:bg-white/10 rounded-lg transition-colors">
          <span className="text-lg">👤</span>
          <span className="text-sm font-medium">Profile Settings</span>
        </button>
      </div>
    </div>
  );
};

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { path: '/feed', label: 'Home', icon: 'home' },
    { path: '/direct-chat', label: 'Chat', icon: 'chat' },
    { path: '/public-chat', label: 'Public', icon: 'public' },
    { path: null, label: 'More', icon: 'more', isMore: true },
  ];

  const icons = {
    home: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    chat: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
    public: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    more: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
      </svg>
    ),
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] bg-white/95 backdrop-blur-xl border-t border-gray-100 z-50">
      <div className="flex items-center justify-around py-1.5 px-2">
        {navItems.map((item) => {
          if (item.isMore) {
            return (
              <button
                key="more"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className={`flex flex-col items-center gap-0.5 py-1 px-4 transition-colors duration-200 ${
                  isMenuOpen ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <div className="p-1 rounded-xl transition-all">
                  {icons.more}
                </div>
                <span className="text-[10px] font-medium tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 py-1 px-4 transition-colors duration-200 ${
                isActive(item.path) ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <div className="p-1 rounded-xl transition-all">
                {icons[item.icon]}
              </div>
              <span className="text-[10px] font-medium tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <FloatingMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </nav>
  );
};

export default BottomNav;
