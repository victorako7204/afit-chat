import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { socket } from '../services/socket';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const res = await authAPI.me();
      setUser(res.data.data.user);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const success = await fetchUser();
      if (!success) {
        try {
          await authAPI.refresh();
          await fetchUser();
        } catch (e) {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      setIsLoading(false);
    };
    init();
  }, [fetchUser]);

  useEffect(() => {
    if (!user) return;
    const handleStatusUpdate = (data) => {
      if (data.status === 'suspended') {
        alert(`Your account has been suspended. Reason: ${data.reason || 'No reason provided'}`);
        logout();
        window.location.href = '/login?suspended=true';
      } else if (data.status === 'restricted') {
        alert('Your account has been restricted. You can only send Private Messages.');
        setUser(prev => ({ ...prev, status: 'restricted' }));
      } else if (data.status === 'active') {
        setUser(prev => ({ ...prev, status: 'active' }));
      }
    };
    const handleRoleUpdate = (data) => {
      setUser(prev => ({ ...prev, role: data.role }));
      if (data.role === 'admin') {
        alert('Congratulations! You have been granted Admin privileges.');
      }
    };
    socket.on('accountStatusUpdate', handleStatusUpdate);
    socket.on('accountRoleUpdate', handleRoleUpdate);
    return () => {
      socket.off('accountStatusUpdate', handleStatusUpdate);
      socket.off('accountRoleUpdate', handleRoleUpdate);
    };
  }, [user]);

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    setUser(res.data.data.user);
    setIsAuthenticated(true);
    return res.data.data.user;
  };

  const register = async (data) => {
    const res = await authAPI.register(data);
    setUser(res.data.data.user);
    setIsAuthenticated(true);
    return res.data.data.user;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {
    }
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
