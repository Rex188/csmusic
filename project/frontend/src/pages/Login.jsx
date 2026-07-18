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
        addToast('⚠️ Email not verified. Check your inbox.', 'warning', 6000);
      } else {
        addToast('✅ Logged in', 'success', 2000);
      }
      setTimeout(() => navigate('/dashboard'), 300);
    } catch (err) {
      addToast(`❌ ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

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
        <button type="submit" disabled={submitting} style={submitting ? { opacity: 0.6, cursor: 'not-allowed' } : {}}>
          {submitting ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span>
              Logging in...
            </span>
          ) : 'Log in'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: 16, color: '#888' }}>
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
