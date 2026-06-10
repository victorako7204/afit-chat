import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/UI';

const DEPARTMENTS = [
  'Aerospace Engineering', 'Civil Engineering', 'Electrical Engineering',
  'Mechanical Engineering', 'Computer Science', 'Cyber Security',
  'Information Technology', 'Physics', 'Mathematics', 'GST', 'Other'
];

const PASSWORD_RULES = [
  { label: '8+ characters', test: (pw) => pw.length >= 8 },
  { label: '1 uppercase', test: (pw) => /[A-Z]/.test(pw) },
  { label: '1 lowercase', test: (pw) => /[a-z]/.test(pw) },
  { label: '1 number', test: (pw) => /[0-9]/.test(pw) },
  { label: '1 symbol', test: (pw) => /[^A-Za-z0-9]/.test(pw) }
];

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const isPasswordValid = PASSWORD_RULES.every(r => r.test(formData.password));
  const passwordsMatch = formData.password === formData.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isPasswordValid) {
      setError('Password does not meet all requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    if (!formData.department) {
      setError('Please select a department.');
      return;
    }
    setLoading(true);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        department: formData.department
      });
      navigate('/feed');
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.error?.message || data?.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectClasses = `w-full px-4 py-3 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] 
    text-[var(--text-primary)] placeholder-[var(--text-tertiary)] 
    focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent
    transition-all duration-200`;

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[var(--bg-primary)]">
      <div className="max-w-md w-full">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2 text-[var(--accent)]">Afit Chat</h1>
          <p className="text-[var(--text-secondary)]">Campus Communication Hub</p>
        </div>
        <div className="rounded-2xl shadow-sm p-8 animate-scale-in bg-[var(--bg-secondary)] border border-[var(--border)]">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Create account</h2>
            <p className="mt-1 text-[var(--text-secondary)]">Join the campus community</p>
          </div>
          {error && (
            <div className="mb-6 p-4 rounded-lg border bg-red-500/10 border-red-500/30">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full Name" name="name" value={formData.name}
              onChange={handleChange} placeholder="John Doe" required />

            <Input label="Email address" name="email" type="email" value={formData.email}
              onChange={handleChange} placeholder="you@example.com" required />

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--text-secondary)]">Department</label>
              <select name="department" value={formData.department} onChange={handleChange}
                className={selectClasses} required>
                <option value="">Select department</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <Input label="Password" name="password" type="password" value={formData.password}
                onChange={handleChange} onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField('')} placeholder="Create a strong password" required />
              {focusedField === 'password' && (
                <div className="mt-2 space-y-1">
                  {PASSWORD_RULES.map((rule, i) => {
                    const passed = rule.test(formData.password);
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={passed ? 'text-green-400' : 'text-[var(--text-tertiary)]'}>
                          {passed ? '✓' : '○'}
                        </span>
                        <span className={passed ? 'text-green-400' : 'text-[var(--text-tertiary)]'}>
                          {rule.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Input label="Confirm Password" name="confirmPassword" type="password"
              value={formData.confirmPassword} onChange={handleChange}
              placeholder="Confirm your password" required />
            {formData.confirmPassword && !passwordsMatch && (
              <p className="text-xs text-red-400 -mt-2">Passwords do not match</p>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-6">
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-[var(--accent)] hover:opacity-80">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
