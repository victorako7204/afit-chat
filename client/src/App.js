/* eslint-disable */
import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { OnlineUsersProvider } from './context/OnlineUsersContext';
import { NotificationProvider } from './context/NotificationContext';
import { connectSocket } from './services/socket';
import SplashScreen from './components/SplashScreen';
import TopNav from './components/TopNav';
import BottomNav from './components/BottomNav';
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

export const ThemeContext = createContext({
  darkMode: false,
  toggleDarkMode: () => {}
});

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
};

const AppLayout = ({ children, deferredPrompt, isInstalled }) => {
  const { darkMode } = useContext(ThemeContext);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

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

  return (
    <div className="flex justify-center bg-gray-100">
      <div className="relative w-full max-w-[500px] h-[100dvh] bg-white overflow-hidden scrollbar-none flex flex-col">
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 z-[60] animate-slide-down bg-neutral-900 text-white text-xs py-2 text-center font-medium font-sans">
            No Internet Connection. Displaying cached application context data.
          </div>
        )}

        <TopNav />

        <main className="flex-1 overflow-y-auto scrollbar-none bg-white">
          <div className="flex flex-col min-h-full pb-24 px-0">
            {children}
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
};

const App = () => {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (user?._id) {
      connectSocket(user._id);
    }
  }, [user?._id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#020617');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#2563eb');
    }
  }, [darkMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkStandaloneMode = () => {
      if (typeof window !== 'undefined' && window.matchMedia) {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        setIsInstalled(isStandalone);
      }
    };

    checkStandaloneMode();

    const handleBeforeInstallPrompt = (e) => {
      if (typeof window === 'undefined') return;
      
      e.preventDefault();
      console.log('beforeinstallprompt event captured');
      
      if (e) {
        setDeferredPrompt(e);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      const mediaQuery = window.matchMedia('(display-mode: standalone)');
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', checkStandaloneMode);
      }
    }

    const timer = setTimeout(() => setShowSplash(false), 1500);

    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', checkStandaloneMode);
        }
      }
    };
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  const themeValue = { darkMode, toggleDarkMode };

  return (
    <ThemeContext.Provider value={themeValue}>
      {showSplash && <SplashScreen />}
      <Router>
        <OnlineUsersProvider>
          <NotificationProvider>
            <GlobalAlert />
            <Routes>
              <Route 
                path="/login" 
                element={user ? <Navigate to="/feed" /> : <Login />} 
              />
              <Route 
                path="/register" 
                element={user ? <Navigate to="/feed" /> : <Register />} 
              />
              
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
              
              <Route path="/" element={<Navigate to={user ? "/feed" : "/login"} />} />
            </Routes>
          </NotificationProvider>
        </OnlineUsersProvider>
      </Router>
    </ThemeContext.Provider>
  );
};

export default App;
