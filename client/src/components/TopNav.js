import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const ROOT_ROUTES = ['/feed', '/explore', '/education', '/profile', '/library', '/games', '/quiz', '/leaderboard', '/lost-and-found', '/groups', '/public-chat', '/direct-chat'];

const TopNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = ROOT_ROUTES.includes(location.pathname);
  const showBack = !isRoot && !location.pathname.startsWith('/dm/') && !location.pathname.startsWith('/group/') && !location.pathname.startsWith('/profile/');

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 h-11 flex-shrink-0" style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
      {showBack ? (
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 btn-press">
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
      ) : (
        <span className="text-lg font-bold">AFIT</span>
      )}
    </header>
  );
};

export default TopNav;
