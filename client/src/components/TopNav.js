import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TOP_LEVEL_ROUTES = ['/feed', '/dashboard', '/education', '/profile', '/leaderboard', '/public-chat', '/games'];

const TopNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isDeepRoute = !TOP_LEVEL_ROUTES.includes(location.pathname) && 
    !TOP_LEVEL_ROUTES.some(r => r !== '/' && location.pathname === r);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2">
        {isDeepRoute ? (
          <>
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Go back"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <button
              onClick={() => navigate('/feed')}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Dashboard"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">Λ</span>
            </div>
            <span className="text-lg font-bold text-gray-900">Afit Chat</span>
          </>
        )}
      </div>
      {!isDeepRoute && (
        <button
          onClick={() => navigate('/public-chat')}
          className="px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-md shadow-blue-500/30"
        >
          Chat
        </button>
      )}
    </header>
  );
};

export default TopNav;
