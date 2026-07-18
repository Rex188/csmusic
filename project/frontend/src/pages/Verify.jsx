import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { addToast } from '../components/Toast';

export default function Verify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    (async () => {
      try {
        const result = await api.verifyEmail(token);
        setStatus('success');
        setMessage(result.message || 'Email verified!');
        addToast('Email verified!', 'success', 3000);
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Verification failed.');
      }
    })();
  }, [token]);

  const handleGoDashboard = () => navigate('/dashboard');

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
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            music-self
          </h1>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          {status === 'verifying' && (
            <div style={{ padding: 'var(--space-4) 0' }}>
              <div className="spinner" />
              <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-4)' }}>
                Verifying your email...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div style={{
                width: 56, height: 56, borderRadius: 'var(--radius-full)',
                background: 'rgba(52, 211, 153, 0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-4)'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                Email verified
              </h2>
              <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-6)' }}>
                {message}
              </p>
              <button onClick={handleGoDashboard} className="btn-primary btn-lg" style={{ width: '100%' }}>
                Go to Dashboard
              </button>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div style={{
                width: 56, height: 56, borderRadius: 'var(--radius-full)',
                background: 'rgba(248, 113, 113, 0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-4)'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                Verification failed
              </h2>
              <p className="text-sm" style={{ color: 'var(--error)', marginBottom: 'var(--space-6)' }}>
                {message}
              </p>
              <p className="text-xs text-tertiary">
                <Link to="/login" style={{ color: 'var(--text-tertiary)' }}>Back to login</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
