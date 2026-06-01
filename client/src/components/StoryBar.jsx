import React from 'react';

const StoryBar = ({ users = [] }) => {
  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-none" style={{borderBottom:'1px solid var(--border)'}}>
      {users.length === 0 && (
        <>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0">
              <div className="story-ring">
                <div className="w-16 h-16 rounded-full skeleton" />
              </div>
              <div className="w-12 h-2 rounded skeleton" style={{backgroundColor:'var(--bg-tertiary)'}} />
            </div>
          ))}
        </>
      )}
      {users.map((user, i) => (
        <div key={user._id || i} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer btn-press">
          <div className="story-ring">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2" style={{borderColor:'var(--bg-primary)'}}>
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-bold" style={{backgroundColor:'var(--accent)', color:'white'}}>
                  {user.name?.[0] || '?'}
                </div>
              )}
            </div>
          </div>
          <span className="text-xs truncate max-w-[68px] text-center" style={{color:'var(--text-secondary)'}}>
            {user.name || 'User'}
          </span>
        </div>
      ))}
    </div>
  );
};

export default StoryBar;
