/* eslint-disable */
import React, { useState, useEffect, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { OnlineUsersProvider } from './context/OnlineUsersContext';
import { NotificationProvider } from './context/NotificationContext';
import { connectSocket } from './services/socket';
import SplashScreen from './components/SplashScreen';
import TopNav from './components/TopNav';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import MoreDrawer from './components/MoreDrawer';
import GlobalAlert from './components/GlobalAlert';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PublicChat from './pages/PublicChat';
import DirectChat from './pages/DirectChat';
import Groups from './pages/Groups';
import GroupChat from './pages/GroupChat';
import LostAndFound from './pages/LostAndFound';
import Library from './pages/Library';
import AnonymousChat from './pages/AnonymousChat';
import AdminDashboard from './pages/AdminDashboard';
import EducationHub from './pages/EducationHub';
import QuizSimulator from './pages/QuizSimulator';
import ChessGame from './pages/ChessGame';
import TicTacToe from './pages/TicTacToe';
import GameLobby from './pages/GameLobby';
import GameArcade from './pages/GameArcade';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import LeaderboardPage from './pages/LeaderboardPage';
import Explore from './pages/Explore';
import Notifications from './pages/Notifications';

export const ThemeContext = createContext({ darkMode: true, toggleDarkMode: () => {} });

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor:'var(--bg-primary)'}}>
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
};

const MOBILE_ROUTES = [
  '/feed', '/direct-chat', '/public-chat', '/education', '/profile',
  '/dashboard', '/library', '/lost-and-found', '/anonymous-chat',
  '/groups', '/games', '/quiz', '/leaderboard', '/admin', '/arcade',
  '/explore', '/notifications'
];

const AppLayout = ({ children, deferredPrompt, isInstalled }) => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const location = useLocation();
  const showNav = MOBILE_ROUTES.includes(location.pathname);

  return (
    <div className="flex justify-center min-h-screen" style={{backgroundColor:'var(--bg-primary)'}}>
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area — offset by sidebar width on desktop */}
      <div className="relative w-full md:ml-[var(--sidebar-width)] max-w-[935px] h-[100dvh] overflow-hidden flex flex-col mx-auto" style={{backgroundColor:'var(--bg-primary)'}}>
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 z-[60] animate-slide-down text-white text-xs py-2 text-center font-medium" style={{backgroundColor:'#ed4956'}}>
            No Internet Connection
          </div>
        )}
        {/* Mobile top nav only */}
        {showNav && (
          <div className="md:hidden">
            <TopNav />
          </div>
        )}
        <main className="flex-1 overflow-y-auto scrollbar-none">
          <div className="flex flex-col min-h-full">
            {children}
          </div>
        </main>
        {/* Mobile bottom nav only */}
        {showNav && (
          <div className="md:hidden">
            <BottomNav onMoreOpen={() => setMoreOpen(true)} />
          </div>
        )}
      </div>

      {/* More drawer */}
      <MoreDrawer isOpen={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
};

const useLocation = () => {
  const { pathname } = window.location;
  return { pathname };
};

const App = () => {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [location, setLocation] = useState({ pathname: window.location.pathname });

  useEffect(() => {
    if (user?._id) connectSocket(user._id);
  }, [user?._id]);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL;
    if (!API_URL) return;
    const keepAlive = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetch(`${API_URL}/health`, { method: 'GET', credentials: 'include' }).catch(() => {});
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(keepAlive);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#000000');

    const handleLocationChange = () => setLocation({ pathname: window.location.pathname });
    window.addEventListener('popstate', handleLocationChange);
    const timer = setTimeout(() => setShowSplash(false), 1500);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const themeValue = { darkMode: true, toggleDarkMode: () => {} };

  return (
    <ThemeContext.Provider value={themeValue}>
      {showSplash && <SplashScreen />}
      <Router>
        <OnlineUsersProvider>
          <NotificationProvider>
            <GlobalAlert />
            <Routes>
              <Route path="/login" element={user ? <Navigate to="/feed" /> : <Login />} />
              <Route path="/register" element={user ? <Navigate to="/feed" /> : <Register />} />
              <Route path="/dashboard" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><Dashboard /></AppLayout></PrivateRoute>} />
              <Route path="/public-chat" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><PublicChat /></AppLayout></PrivateRoute>} />
              <Route path="/direct-chat" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><DirectChat /></AppLayout></PrivateRoute>} />
              <Route path="/groups" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><Groups /></AppLayout></PrivateRoute>} />
              <Route path="/group/:groupId" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><GroupChat /></AppLayout></PrivateRoute>} />
              <Route path="/lost-and-found" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><LostAndFound /></AppLayout></PrivateRoute>} />
              <Route path="/library" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><Library /></AppLayout></PrivateRoute>} />
              <Route path="/anonymous-chat" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><AnonymousChat /></AppLayout></PrivateRoute>} />
              <Route path="/education" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><EducationHub /></AppLayout></PrivateRoute>} />
              <Route path="/quiz" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><QuizSimulator /></AppLayout></PrivateRoute>} />
              <Route path="/admin" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><AdminDashboard /></AppLayout></PrivateRoute>} />
              <Route path="/chess" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><ChessGame /></AppLayout></PrivateRoute>} />
              <Route path="/tictactoe" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><TicTacToe /></AppLayout></PrivateRoute>} />
              <Route path="/games" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><GameLobby /></AppLayout></PrivateRoute>} />
              <Route path="/arcade" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><GameArcade /></AppLayout></PrivateRoute>} />
              <Route path="/feed" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><Feed /></AppLayout></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><Profile /></AppLayout></PrivateRoute>} />
              <Route path="/profile/:id" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><Profile /></AppLayout></PrivateRoute>} />
              <Route path="/leaderboard" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><LeaderboardPage /></AppLayout></PrivateRoute>} />
              <Route path="/explore" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><Explore /></AppLayout></PrivateRoute>} />
              <Route path="/notifications" element={<PrivateRoute><AppLayout deferredPrompt={deferredPrompt} isInstalled={isInstalled}><Notifications /></AppLayout></PrivateRoute>} />
              <Route path="/" element={<Navigate to={user ? "/feed" : "/login"} />} />
            </Routes>
          </NotificationProvider>
        </OnlineUsersProvider>
      </Router>
    </ThemeContext.Provider>
  );
};

export default App;
