import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="text-xl font-bold text-primary-500">
              Afit Chat
            </Link>
            <div className="hidden md:flex ml-10 space-x-4">
              <Link
                to="/dashboard"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/dashboard') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/public-chat"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/public-chat') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Public Chat
              </Link>
              <Link
                to="/direct-chat"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/direct-chat') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Direct Chat
              </Link>
              <Link
                to="/groups"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/groups') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Groups
              </Link>
              <Link
                to="/anonymous-chat"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/anonymous-chat') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Anonymous
              </Link>
              <Link
                to="/lost-and-found"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/lost-and-found') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Lost & Found
              </Link>
              <Link
                to="/library"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/library') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Library
              </Link>
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/admin') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-gray-300 text-sm mr-4">
              {user?.name} ({user?.matricNo})
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
