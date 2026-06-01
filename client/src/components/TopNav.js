import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';


const TopNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDeep = !['/feed', '/education', '/profile', '/direct-chat', '/public-chat'].includes(location.pathname);

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 h-11 flex-shrink-0" style={{backgroundColor:'var(--bg-primary)', borderBottom:'1px solid var(--border)'}}>
      {isDeep ? (
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 btn-press">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      ) : (
        <span className="text-xl font-bold" style={{fontFamily:'var(--font)'}}>AFIT Chat</span>
      )}
      <div className="flex items-center gap-4">
        {!isDeep && (
          <>
            <button onClick={() => navigate('/feed')} className="btn-press">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </button>
            <button onClick={() => navigate('/direct-chat')} className="btn-press relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default TopNav;
