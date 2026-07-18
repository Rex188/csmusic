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
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      addToast('❌ Passwords do not match', 'error');
      return;
    }
    try {
      const result = await api.signup({ email, password });
      setSignupEmail(email);
      setSignedUp(true);
      setVerificationUrl(result.verification_url || null);
      setVerificationSent(result.verification_sent || false);
      addToast('✅ Account created!', 'success', 3000);
    } catch (err) {
      addToast(`❌ ${err.message}`, 'error');
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const result = await api.resendVerification();
      if (result.verification_url) setVerificationUrl(result.verification_url);
      setVerificationSent(result.verification_sent || false);
      addToast(result.verification_sent ? '📧 Verification email sent!' : '⚠️ Could not send email (SMTP not configured)', result.verification_sent ? 'success' : 'warning', 4000);
    } catch (err) {
      addToast(`❌ ${err.message}`, 'error');
    }
    setResending(false);
  };

  const handleGoDashboard = () => navigate('/dashboard');

  if (signedUp) {
    return (
      <div className="container" style={{ maxWidth: 400, marginTop: 80, textAlign: 'center' }}>
        <h1 style={{ marginBottom: 24 }}>music-self</h1>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Welcome!</h2>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 4 }}>
            Account created for <strong style={{ color: '#f5f5f5' }}>{signupEmail}</strong>
          </p>

          {verificationSent && (
            <p style={{ color: '#4ade80', fontSize: 13, margin: '12px 0' }}>
              ✉️ Verification email sent — check your inbox.
            </p>
          )}

          {!verificationSent && verificationUrl && (
            <div style={{ margin: '12px 0', padding: 12, borderRadius: 8, background: '#1a1a1a', fontSize: 13 }}>
              <p style={{ color: '#fbbf24', marginBottom: 4 }}>⚠️ Email could not be sent</p>
              <p style={{ color: '#888' }}>SMTP may not be configured. Use the link below to verify:</p>
              <div style={{ marginTop: 8 }}>
                <a href={verificationUrl} style={{ color: '#a78bfa', fontSize: 12, wordBreak: 'break-all' }}>
                  {verificationUrl}
                </a>
              </div>
            </div>
          )}

          {!verificationSent && !verificationUrl && (
            <div style={{ margin: '12px 0', padding: 12, borderRadius: 8, background: '#1a1a1a', fontSize: 13 }}>
              <p style={{ color: '#fbbf24', marginBottom: 4 }}>⚠️ Cannot send verification email</p>
              <p style={{ color: '#888' }}>SMTP not configured on the server. You can still use the app.</p>
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={handleGoDashboard}>Go to Dashboard</button>
            <button onClick={handleResend} disabled={resending} style={{ background: '#1a1a1a', color: '#a78bfa', width: '100%' }}>
              {resending ? 'Sending...' : 'Resend verification email'}
            </button>
          </div>

          <p style={{ marginTop: 20, color: '#555', fontSize: 13 }}>
            <Link to="/login" style={{ color: '#888' }}>Back to login</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 400, marginTop: 80 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 32 }}>music-self</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
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
        <button type="submit">Sign up</button>
      </form>
      <p style={{ textAlign: 'center', marginTop: 16, color: '#888' }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
