/* eslint-disable */
import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { ThemeContext } from '../App';

const Sidebar = ({ deferredPrompt, isInstalled }) => {
  const { user, logout } = useAuth();
  const { getTotalUnread } = useNotifications();
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const [totalUnread, setTotalUnread] = useState(0);
  const showBadge = totalUnread > 0;

  useEffect(() => {
    setTotalUnread(getTotalUnread());
  }, [getTotalUnread]);

  const isActiveRoute = (path) => {
    if (path === '/public-chat') {
      return location.pathname === path || location.pathname.startsWith('/direct-chat');
    }
    if (path === '/games') {
      return location.pathname.startsWith('/chess') || location.pathname.startsWith('/tictactoe') || location.pathname.startsWith('/arcade');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleInstall = async () => {
    if (typeof window === 'undefined') return;
    
    setIsInstalling(true);
    
    try {
      if (deferredPrompt) {
        await deferredPrompt.prompt();
        
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
      } else {
        console.log('Install prompt not available');
      }
    } catch (error) {
      console.error('Install failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'home' },
    { path: '/public-chat', label: 'Public Chat', icon: 'chat' },
    { path: '/direct-chat', label: 'Direct Messages', icon: 'mail', showBadge },
    { path: '/groups', label: 'Groups', icon: 'users' },
    { path: '/feed', label: 'Social Feed', icon: 'feed' },
    { path: '/games', label: 'Games Arena', icon: 'gamepad' },
    { path: '/lost-and-found', label: 'Lost & Found', icon: 'search' },
    { path: '/library', label: 'Library', icon: 'book' },
    { path: '/education', label: 'Education Hub', icon: 'education' },
    { path: '/anonymous-chat', label: 'Anonymous Chat', icon: 'mask' },
    { path: '/profile', label: 'My Profile', icon: 'profile' },
  ];

  const icons = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    chat: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    mail: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    search: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    book: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    gamepad: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
    mask: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    education: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    feed: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-.586-1.414l-4.5-4.5A2 2 0 0015.586 3H19a2 2 0 002-2v10a2 2 0 01-2 2h-2z" />
      </svg>
    ),
    profile: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    admin: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    download: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    moon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
    sun: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  };

  const sidebarBg = darkMode 
    ? 'bg-slate-950/95 backdrop-blur-xl border-r border-slate-800' 
    : 'bg-white border-r border-gray-200';
  
  const textPrimary = darkMode ? 'text-slate-100' : 'text-gray-900';
  const textSecondary = darkMode ? 'text-slate-400' : 'text-gray-500';
  
  const activeBg = darkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600';
  const inactiveBg = darkMode ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900';
  
  const borderColor = darkMode ? 'border-slate-800' : 'border-gray-100';

  return (
    <>
      <button
        className={`lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg shadow-md transition-colors ${
          darkMode ? 'bg-slate-800 text-slate-200' : 'bg-white text-gray-600'
        }`}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed left-0 top-0 h-full w-64 ${sidebarBg} z-40 transform transition-all duration-300 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className={`p-6 border-b ${borderColor}`}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-2xl font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Afit Chat</h1>
                <p className={`text-xs ${textSecondary} mt-1`}>Campus Communication Hub</p>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  darkMode 
                    ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' 
                    : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                }`}
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? icons.sun : icons.moon}
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4">
            {menuItems.map((item) => {
              const isActive = isActiveRoute(item.path);
              const itemHasBadge = item.showBadge && showBadge;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 mx-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                    isActive ? activeBg : inactiveBg
                  }`}
                >
                  {icons[item.icon]}
                  <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
                  {itemHasBadge && (
                    <span className={`ml-auto text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 ${
                      darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                    }`}>
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                  {isActive && !itemHasBadge && (
                    <div className={`ml-auto w-1.5 h-1.5 rounded-full ${darkMode ? 'bg-blue-400' : 'bg-blue-600'}`} />
                  )}
                </Link>
              );
            })}

            {user?.role === 'admin' && (
              <>
                <div className={`mx-6 my-4 border-t ${borderColor}`} />
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 mx-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                    location.pathname === '/admin'
                      ? darkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'
                      : inactiveBg
                  }`}
                >
                  {icons.admin}
                  <span>Admin Panel</span>
                </Link>
              </>
            )}

            <div className={`mx-6 my-4 border-t ${borderColor}`} />

            {deferredPrompt && !isInstalled && (
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className={`flex items-center gap-3 mx-3 px-4 py-2.5 rounded-lg transition-all duration-200 w-full disabled:opacity-50 disabled:cursor-not-allowed ${
                  darkMode 
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                {icons.download}
                <span className="font-medium">{isInstalling ? 'Installing...' : 'Install App'}</span>
              </button>
            )}
          </nav>

          <div className={`p-4 border-t ${borderColor} ${darkMode ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-blue-600' : 'bg-blue-600'} flex items-center justify-center text-white font-semibold`}>
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${darkMode ? 'border-slate-900 bg-green-400' : 'border-white bg-green-500'}`} title="Online" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${textPrimary} truncate`}>{user?.name}</p>
                <p className={`text-xs ${darkMode ? 'text-green-400' : 'text-green-600'} truncate`}>Online</p>
              </div>
            </div>
            <button
              onClick={logout}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                darkMode 
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
