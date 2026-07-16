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
        addToast('✅ Email verified!', 'success', 3000);
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Verification failed.');
      }
    })();
  }, [token]);

  const handleGoDashboard = () => navigate('/dashboard');

  return (
    <div className="container" style={{ maxWidth: 400, marginTop: 80, textAlign: 'center' }}>
      <h1 style={{ marginBottom: 24 }}>music-self</h1>
      <div className="card" style={{ padding: 32 }}>

        {status === 'verifying' && (
          <div>
            <div className="spinner" />
            <p style={{ color: '#888', marginTop: 16, fontSize: 14 }}>Verifying your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Email verified!</h2>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>{message}</p>
            <button onClick={handleGoDashboard}>Go to Dashboard</button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Verification failed</h2>
            <p style={{ color: '#f87171', fontSize: 14, marginBottom: 16 }}>{message}</p>
            <p style={{ color: '#555', fontSize: 13 }}>
              <Link to="/login">Back to login</Link>
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
