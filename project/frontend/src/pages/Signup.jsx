import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { addToast } from '../components/Toast';

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [signedUp, setSignedUp] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [verificationUrl, setVerificationUrl] = useState(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      addToast('Passwords do not match', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.signup({ email, password });
      setSignupEmail(email);
      setSignedUp(true);
      setVerificationUrl(result.verification_url || null);
      setVerificationSent(result.verification_sent || false);
      addToast('Account created!', 'success', 3000);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const result = await api.resendVerification();
      if (result.verification_url) setVerificationUrl(result.verification_url);
      setVerificationSent(result.verification_sent || false);
      addToast(result.verification_sent ? 'Verification email sent!' : 'Could not send email (SMTP not configured)', result.verification_sent ? 'success' : 'warning', 4000);
    } catch (err) {
      addToast(err.message, 'error');
    }
    setResending(false);
  };

  const handleGoDashboard = () => navigate('/dashboard');

  if (signedUp) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="container-narrow animate-fade-in-up" style={{ width: '100%' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 300,
              letterSpacing: '-0.02em',
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 'var(--space-2)'
            }}>
              music-self
            </h1>
          </div>

          {/* Success card */}
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Welcome!
            </h2>
            <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
              Account created for <strong style={{ color: 'var(--text-primary)' }}>{signupEmail}</strong>
            </p>

            {verificationSent && (
              <p className="text-sm text-success" style={{ margin: 'var(--space-4) 0' }}>
                Verification email sent — check your inbox.
              </p>
            )}

            {!verificationSent && verificationUrl && (
              <div className="card" style={{ background: 'var(--bg-elevated)', backdropFilter: 'none', padding: 'var(--space-4)', margin: 'var(--space-4) 0', textAlign: 'left' }}>
                <p className="text-sm" style={{ color: 'var(--warning)', marginBottom: 'var(--space-2)' }}>Email could not be sent</p>
                <p className="text-xs text-tertiary" style={{ marginBottom: 'var(--space-2)' }}>SMTP may not be configured. Use the link below to verify:</p>
                <a href={verificationUrl} style={{ color: 'var(--accent)', fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>
                  {verificationUrl}
                </a>
              </div>
            )}

            {!verificationSent && !verificationUrl && (
              <p className="text-sm" style={{ color: 'var(--warning)', margin: 'var(--space-4) 0' }}>
                Cannot send verification email. You can still use the app.
              </p>
            )}

            <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <button onClick={handleGoDashboard} className="btn-primary" style={{ width: '100%' }}>
                Go to Dashboard
              </button>
              <button onClick={handleResend} disabled={resending} className="btn-ghost" style={{ width: '100%' }}>
                {resending ? 'Sending...' : 'Resend verification email'}
              </button>
            </div>

            <p style={{ marginTop: 'var(--space-6)' }} className="text-xs text-tertiary">
              <Link to="/login" style={{ color: 'var(--text-tertiary)' }}>Back to login</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

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
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-6)' }} className="text-sm text-tertiary">
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
