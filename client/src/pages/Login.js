import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';
import { Button, Input } from '../components/UI';
import { authAPI } from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const navigate = useNavigate();

  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState('request');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    const savedEmail = localStorage.getItem('resetEmailInProgress');
    if (savedEmail) {
      setShowForgot(true);
      setResetEmail(savedEmail);
      setResetStep('verify');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/feed');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotLink = (e) => {
    e.preventDefault();
    setResetEmail(email);
    setShowForgot(true);
    setResetStep('request');
    setError('');
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(resetEmail);
      setResetMessage(res.data.message);
      localStorage.setItem('resetEmailInProgress', resetEmail);
      setResetStep('verify');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendToken = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(resetEmail);
      setResetMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.resetPassword(resetToken, newPassword);
      setResetMessage(res.data.message);
      localStorage.removeItem('resetEmailInProgress');
      setTimeout(() => {
        setShowForgot(false);
        setResetStep('request');
        setNewPassword('');
        setResetToken('');
        setResetMessage('');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowForgot(false);
    setResetStep('request');
    setNewPassword('');
    setResetToken('');
    setResetMessage('');
    setError('');
    localStorage.removeItem('resetEmailInProgress');
  };

  if (showForgot) {
    return (
      <div className={`min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300 ${
        darkMode ? 'bg-slate-900' : 'bg-gray-50'
      }`}>
        <div className="max-w-md w-full">
          <div className="text-center mb-8 animate-fade-in">
            <div className="flex justify-end mb-4">
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  darkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                }`}
              >
                {darkMode ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
            <h1 className={`text-4xl font-bold mb-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Afit Chat</h1>
            <p className={darkMode ? 'text-slate-400' : 'text-gray-500'}>Reset your password</p>
          </div>

          <div className={`rounded-2xl shadow-sm p-8 animate-scale-in transition-colors duration-300 ${
            darkMode ? 'bg-slate-800/50 backdrop-blur-xl border border-slate-700/50' : 'bg-white border border-gray-200'
          }`}>
            {resetStep === 'request' && (
              <form onSubmit={handleRequestReset} className="space-y-5">
                <div className="mb-6">
                  <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                    Forgot password?
                  </h2>
                  <p className={`mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    Enter your email and we'll send you a reset link.
                  </p>
                </div>

                {error && (
                  <div className={`p-4 rounded-lg border ${darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-100'}`}>
                    <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
                  </div>
                )}

                <Input
                  label="Email address"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  darkMode={darkMode}
                />

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>

                <div className="text-center">
                  <button onClick={handleBackToLogin} className={`text-sm font-medium transition-colors ${
                    darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
                  }`}>
                    Back to login
                  </button>
                </div>
              </form>
            )}

            {resetStep === 'verify' && (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="mb-6">
                  <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                    Check your email
                  </h2>
                  <p className={`mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    We sent a reset link to <strong>{resetEmail}</strong>. Paste the token below or click the link in the email.
                  </p>
                </div>

                {resetMessage && (
                  <div className={`p-4 rounded-lg border ${darkMode ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-100'}`}>
                    <p className={`text-sm ${darkMode ? 'text-green-400' : 'text-green-600'}`}>{resetMessage}</p>
                  </div>
                )}

                {error && (
                  <div className={`p-4 rounded-lg border ${darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-100'}`}>
                    <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
                  </div>
                )}

                <Input
                  label="Reset token (from email link)"
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste the token from the reset link"
                  required
                  darkMode={darkMode}
                />

                <Input
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  darkMode={darkMode}
                />

                <Button type="submit" disabled={loading || !resetToken || !newPassword} className="w-full">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>

                <div className="flex justify-between">
                  <button onClick={handleBackToLogin} className={`text-sm font-medium transition-colors ${
                    darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
                  }`}>
                    Back to login
                  </button>
                  <button onClick={handleResendToken} disabled={loading} className={`text-sm font-medium transition-colors ${
                    darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                    Resend Email
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300 ${
      darkMode ? 'bg-slate-900' : 'bg-gray-50'
    }`}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex justify-end mb-4">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-all duration-300 ${
                darkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
          <h1 className={`text-4xl font-bold mb-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Afit Chat</h1>
          <p className={darkMode ? 'text-slate-400' : 'text-gray-500'}>Campus Communication Hub</p>
        </div>

        <div className={`rounded-2xl shadow-sm p-8 animate-scale-in transition-colors duration-300 ${
          darkMode ? 'bg-slate-800/50 backdrop-blur-xl border border-slate-700/50' : 'bg-white border border-gray-200'
        }`}>
          <div className="mb-6">
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
              Welcome back
            </h2>
            <p className={`mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              Sign in to your account
            </p>
          </div>

          {error && (
            <div className={`mb-6 p-4 rounded-lg border ${
              darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-100'
            }`}>
              <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              darkMode={darkMode}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              darkMode={darkMode}
            />

            <div className="flex justify-end -mt-3">
              <button
                onClick={handleForgotLink}
                className={`text-xs font-medium transition-colors ${
                  darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
                }`}
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className={darkMode ? 'text-sm text-slate-400' : 'text-sm text-gray-500'}>
              Don't have an account?{' '}
              <Link 
                to="/register" 
                className={`font-medium transition-colors ${
                  darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
                }`}
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
