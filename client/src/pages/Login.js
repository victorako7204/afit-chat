import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/UI';
import { authAPI } from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
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

  const getErrorMessage = (err) => {
    const data = err.response?.data;
    if (!data) return 'Connection failed. Check your internet.';
    const code = data?.error?.code;
    const message = data?.error?.message;
    if (code === 'ACCOUNT_LOCKED') {
      const minutes = data?.error?.details?.remainingMinutes || 15;
      return `Account locked. Try again in ${minutes} minute(s).`;
    }
    if (code === 'RATE_LIMITED') return message || 'Too many attempts. Please wait 15 minutes.';
    if (code === 'INVALID_CREDENTIALS' || !code) return 'Email or password is incorrect.';
    return message || 'An error occurred. Please try again.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/feed');
    } catch (err) {
      setError(getErrorMessage(err));
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
      setResetMessage(res.data?.data?.message || 'Check your email for the reset link.');
      localStorage.setItem('resetEmailInProgress', resetEmail);
      setResetStep('verify');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendToken = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(resetEmail);
      setResetMessage(res.data?.data?.message || 'Email resent.');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to resend email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.resetPassword(resetToken, newPassword);
      setResetMessage(res.data?.data?.message || 'Password has been reset successfully.');
      localStorage.removeItem('resetEmailInProgress');
      setTimeout(() => {
        setShowForgot(false);
        setResetStep('request');
        setNewPassword('');
        setResetToken('');
        setResetMessage('');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to reset password.');
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

  const errorBox = (msg) => (
    msg && (
      <div className="mb-6 p-4 rounded-lg border bg-red-500/10 border-red-500/30">
        <p className="text-sm text-red-400">{msg}</p>
      </div>
    )
  );

  if (showForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[var(--bg-primary)]">
        <div className="max-w-md w-full">
          <div className="text-center mb-8 animate-fade-in">
            <h1 className="text-4xl font-bold mb-2 text-[var(--accent)]">Afit Chat</h1>
            <p className="text-[var(--text-secondary)]">Reset your password</p>
          </div>
          <div className="rounded-2xl shadow-sm p-8 animate-scale-in bg-[var(--bg-secondary)] border border-[var(--border)]">
            {resetStep === 'request' && (
              <form onSubmit={handleRequestReset} className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">Forgot password?</h2>
                  <p className="mt-1 text-[var(--text-secondary)]">Enter your email and we'll send you a reset link.</p>
                </div>
                {errorBox(error)}
                <Input label="Email address" type="email" value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)} placeholder="you@example.com" required />
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
                <div className="text-center">
                  <button onClick={handleBackToLogin} className="text-sm font-medium text-[var(--accent)] hover:opacity-80">
                    Back to login
                  </button>
                </div>
              </form>
            )}
            {resetStep === 'verify' && (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">Check your email</h2>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    We sent a reset link to <strong>{resetEmail}</strong>. Paste the token below or click the link in the email.
                  </p>
                </div>
                {resetMessage && (
                  <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/30">
                    <p className="text-sm text-green-400">{resetMessage}</p>
                  </div>
                )}
                {errorBox(error)}
                <Input label="Reset token (from email link)" type="text" value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)} placeholder="Paste the token from the reset link" required />
                <Input label="New password" type="password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" required />
                <Button type="submit" disabled={loading || !resetToken || !newPassword} className="w-full">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
                <div className="flex justify-between">
                  <button onClick={handleBackToLogin} className="text-sm font-medium text-[var(--accent)] hover:opacity-80">
                    Back to login
                  </button>
                  <button onClick={handleResendToken} disabled={loading}
                    className="text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
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
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[var(--bg-primary)]">
      <div className="max-w-md w-full">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2 text-[var(--accent)]">Afit Chat</h1>
          <p className="text-[var(--text-secondary)]">Campus Communication Hub</p>
        </div>
        <div className="rounded-2xl shadow-sm p-8 animate-scale-in bg-[var(--bg-secondary)] border border-[var(--border)]">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Welcome back</h2>
            <p className="mt-1 text-[var(--text-secondary)]">Sign in to your account</p>
          </div>
          {errorBox(error)}
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input label="Email address" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            <Input label="Password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
            <div className="flex justify-end -mt-3">
              <button onClick={handleForgotLink} className="text-xs font-medium text-[var(--accent)] hover:opacity-80">
                Forgot password?
              </button>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign in'}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-[var(--accent)] hover:opacity-80">
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
