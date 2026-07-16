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
      setEmail('');
      setPassword('');
      setConfirm('');
      addToast('✅ Account created! Check your email to verify.', 'success', 4000);
    } catch (err) {
      addToast(`❌ ${err.message}`, 'error');
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.resendVerification();
      addToast('📧 Verification email resent!', 'success', 3000);
    } catch (err) {
      addToast(`❌ ${err.message}`, 'error');
    }
    setResending(false);
  };

  if (signedUp) {
    return (
      <div className="container" style={{ maxWidth: 400, marginTop: 80, textAlign: 'center' }}>
        <h1 style={{ marginBottom: 24 }}>music-self</h1>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Check your email</h2>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>
            We sent a verification link to<br />
            <strong style={{ color: '#f5f5f5' }}>{signupEmail}</strong>
          </p>
          <button onClick={handleResend} disabled={resending} style={{ background: '#1a1a1a', color: '#a78bfa', width: '100%' }}>
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>
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
