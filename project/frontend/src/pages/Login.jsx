import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { addToast } from '../components/Toast';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await api.login({ email, password });
      if (result.user && !result.user.email_verified) {
        addToast('Email not verified. Check your inbox.', 'warning', 6000);
      } else {
        addToast('Logged in', 'success', 2000);
      }
      setTimeout(() => navigate('/dashboard'), 300);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="container-narrow animate-fade-in-up" style={{ width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 300,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-2)'
          }}>
            music-self
          </h1>
          <p className="text-sm text-tertiary">Your lens, made visible</p>
        </div>

        {/* Form card */}
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn-primary btn-lg"
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
              disabled={submitting}
            >
              {submitting ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner spinner-sm spinner-light" />
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-6)' }} className="text-sm text-tertiary">
          New to music-self?{' '}
          <Link to="/signup" style={{ color: 'var(--accent)', fontWeight: 500 }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
