import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { socket } from '../services/socket';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/auth/profile`);
      setUser(res.data.user);
    } catch (error) {
      console.error('Error fetching profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token, fetchProfile]);

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
        alert('Congratulations! You have been granted Admin privileges. Please refresh the page.');
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
    const res = await axios.post(`${process.env.REACT_APP_API_URL}/auth/login`, {
      email,
      password
    });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return user;
  };

  const register = async (name, email, password, matricNo, department) => {
    const res = await axios.post(`${process.env.REACT_APP_API_URL}/auth/register`, {
      name,
      email,
      password,
      matricNo,
      department
    });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
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
