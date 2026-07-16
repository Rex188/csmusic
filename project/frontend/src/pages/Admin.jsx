import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { addToast } from '../components/Toast';

const KEY_STORAGE = 'music-self-admin-key';

export default function Admin() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [netease, setNetease] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [confirming, setConfirming] = useState(null); // {type, id, label}

  // Try to restore key from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem(KEY_STORAGE);
    if (saved) {
      setAdminKey(saved);
      loadDashboard(saved);
    } else {
      setLoading(false);
    }
  }, []);

  const loadDashboard = async (key) => {
    setLoading(true);
    try {
      const data = await api.adminDashboard(key);
      setStats(data.stats);
      setUsers(data.users || []);
      setNetease(data.netease || []);
      setPlaylists(data.playlists || []);
      setAuthenticated(true);
      sessionStorage.setItem(KEY_STORAGE, key);
    } catch (err) {
      setAuthenticated(false);
      sessionStorage.removeItem(KEY_STORAGE);
      addToast(`❌ ${err.message}`, 'error');
    }
    setLoading(false);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!adminKey.trim()) return;
    loadDashboard(adminKey.trim());
  };

  const handleLogout = () => {
    setAuthenticated(false);
    setAdminKey('');
    setStats(null);
    setUsers([]);
    setNetease([]);
    setPlaylists([]);
    sessionStorage.removeItem(KEY_STORAGE);
  };

  const doDelete = async (type, id, label) => {
    setConfirming(null);
    try {
      if (type === 'user') {
        const result = await api.adminDeleteUser(adminKey, id);
        addToast(`🗑️ Deleted user: ${result.deleted_user}`, 'success');
        setUsers(users.filter(u => u.id !== id));
      } else if (type === 'playlist') {
        const result = await api.adminDeletePlaylist(adminKey, id);
        addToast(`🗑️ Deleted playlist: ${result.deleted_playlist}`, 'success');
        setPlaylists(playlists.filter(p => p.id !== id));
      } else if (type === 'netease') {
        const result = await api.adminDisconnectNetease(adminKey, id);
        addToast(`🔌 Disconnected: ${result.disconnected}`, 'success');
        setNetease(netease.filter(n => n.user_id !== id));
      }
      // Refresh stats
      const data = await api.adminDashboard(adminKey);
      setStats(data.stats);
    } catch (err) {
      addToast(`❌ ${err.message}`, 'error');
    }
  };

  // ── Login screen ──────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="container" style={{ maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>🛠️ Admin</h1>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <form onSubmit={handleLogin}>
            <label style={{ fontSize: 14, color: '#888', marginBottom: 8, display: 'block' }}>
              Admin Key
            </label>
            <input
              type="password"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              placeholder="Enter ADMIN_KEY..."
              autoFocus
              style={{ marginBottom: 16 }}
            />
            <button type="submit" disabled={!adminKey.trim()} style={{ width: '100%' }}>
              {loading ? 'Verifying...' : 'Login'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 16 }}>
              <a onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer', fontSize: 13 }}>
                ← Back to Dashboard
              </a>
            </p>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="container" style={{ textAlign: 'center', paddingTop: 80 }}>Loading...</div>;
  }

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>🛠️ Admin Panel</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <a onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer', fontSize: 13, lineHeight: '40px' }}>
            ← Dashboard
          </a>
          <button onClick={handleLogout} style={{ background: '#1a1a1a', color: '#888', padding: '8px 16px', fontSize: 14 }}>
            Logout
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Users', value: stats.users },
            { label: 'Netease Connected', value: stats.netease_connected },
            { label: 'Playlists', value: stats.playlists },
            { label: 'Tracks', value: stats.tracks },
            { label: 'Analyses', value: stats.analyses },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#a78bfa' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Users table */}
      <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a', fontWeight: 600, fontSize: 14 }}>
          Users ({users.length})
        </div>
        {users.length === 0 && (
          <p style={{ padding: 16, color: '#555', fontSize: 13 }}>No users.</p>
        )}
        {users.map((u, i) => (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
            borderBottom: i < users.length - 1 ? '1px solid #1a1a1a' : 'none',
            fontSize: 13
          }}>
            <span style={{ color: '#555', width: 28 }}>{u.id}</span>
            <span style={{ flex: 1 }}>{u.email}</span>
            <span style={{ color: '#666', width: 140 }}>{u.created_at}</span>
            {confirming === `user-${u.id}` ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => doDelete('user', u.id, u.email)}
                  style={{ background: '#7f1d1d', color: '#fca5a5', padding: '4px 10px', fontSize: 12 }}>
                  Confirm
                </button>
                <button onClick={() => setConfirming(null)}
                  style={{ background: '#1a1a1a', color: '#888', padding: '4px 10px', fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirming(`user-${u.id}`)}
                style={{ background: 'transparent', color: '#f87171', padding: '4px 10px', fontSize: 12 }}>
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Netease connections */}
      <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a', fontWeight: 600, fontSize: 14 }}>
          Netease Connections ({netease.length})
        </div>
        {netease.length === 0 && (
          <p style={{ padding: 16, color: '#555', fontSize: 13 }}>No connections.</p>
        )}
        {netease.map((n, i) => (
          <div key={n.netease_user_id || i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
            borderBottom: i < netease.length - 1 ? '1px solid #1a1a1a' : 'none',
            fontSize: 13
          }}>
            <span style={{ color: '#a78bfa', fontWeight: 500 }}>{n.netease_nickname}</span>
            <span style={{ color: '#666' }}>({n.email})</span>
            <span style={{ color: '#555', flex: 1, fontSize: 12 }}>UID: {n.netease_user_id}</span>
            {confirming === `netease-${n.user_id || i}` ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => doDelete('netease', n.user_id, n.netease_nickname)}
                  style={{ background: '#7f1d1d', color: '#fca5a5', padding: '4px 10px', fontSize: 12 }}>
                  Confirm
                </button>
                <button onClick={() => setConfirming(null)}
                  style={{ background: '#1a1a1a', color: '#888', padding: '4px 10px', fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirming(`netease-${n.user_id || i}`)}
                style={{ background: 'transparent', color: '#fbbf24', padding: '4px 10px', fontSize: 12 }}>
                Disconnect
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Playlists table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a', fontWeight: 600, fontSize: 14 }}>
          Playlists ({playlists.length})
        </div>
        {playlists.length === 0 && (
          <p style={{ padding: 16, color: '#555', fontSize: 13 }}>No playlists.</p>
        )}
        {playlists.map((pl, i) => (
          <div key={pl.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
            borderBottom: i < playlists.length - 1 ? '1px solid #1a1a1a' : 'none',
            fontSize: 13
          }}>
            <span style={{ color: '#555', width: 28 }}>{pl.id}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pl.name}
            </span>
            <span style={{ color: '#666', width: 120 }}>{pl.email}</span>
            <span style={{ color: '#888', width: 60 }}>{pl.track_count} tracks</span>
            {confirming === `playlist-${pl.id}` ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => doDelete('playlist', pl.id, pl.name)}
                  style={{ background: '#7f1d1d', color: '#fca5a5', padding: '4px 10px', fontSize: 12 }}>
                  Confirm
                </button>
                <button onClick={() => setConfirming(null)}
                  style={{ background: '#1a1a1a', color: '#888', padding: '4px 10px', fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirming(`playlist-${pl.id}`)}
                style={{ background: 'transparent', color: '#f87171', padding: '4px 10px', fontSize: 12 }}>
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
