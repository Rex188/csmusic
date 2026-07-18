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
  const [confirming, setConfirming] = useState(null);

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
      addToast(err.message, 'error');
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
        addToast(`Deleted user: ${result.deleted_user}`, 'success');
        setUsers(users.filter(u => u.id !== id));
      } else if (type === 'playlist') {
        const result = await api.adminDeletePlaylist(adminKey, id);
        addToast(`Deleted playlist: ${result.deleted_playlist}`, 'success');
        setPlaylists(playlists.filter(p => p.id !== id));
      } else if (type === 'netease') {
        const result = await api.adminDisconnectNetease(adminKey, id);
        addToast(`Disconnected: ${result.disconnected}`, 'success');
        setNetease(netease.filter(n => n.user_id !== id));
      }
      const data = await api.adminDashboard(adminKey);
      setStats(data.stats);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // ── Login screen ──────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="container-narrow animate-fade-in-up" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
            <h1 style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)'
            }}>
              Admin
            </h1>
            <p className="text-sm text-tertiary">Authenticate to manage the platform</p>
          </div>

          <div className="card" style={{ padding: 'var(--space-8)' }}>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                placeholder="Enter admin key..."
                autoFocus
                style={{ fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-4)' }}
              />
              <button
                type="submit"
                disabled={!adminKey.trim() || loading}
                className="btn-primary btn-lg"
                style={{ width: '100%' }}
              >
                {loading ? 'Verifying...' : 'Authenticate'}
              </button>
              <p style={{ textAlign: 'center', marginTop: 'var(--space-5)' }} className="text-xs text-tertiary">
                <a onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  ← Back to Dashboard
                </a>
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      {/* ── Glass sticky header ─────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg-glass)', backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: 'var(--space-4) var(--space-6)'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Admin
            </span>
            <span style={{ color: 'var(--border-visible)', fontSize: 'var(--text-lg)' }}>/</span>
            <a onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              Dashboard
            </a>
          </div>
          <button onClick={handleLogout} className="btn-ghost btn-sm">
            Logout
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--space-8) var(--space-6) var(--space-16)' }}>
        {/* ── Stats row ─────────────────────────────────────────── */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
            {[
              { label: 'Users', value: stats.users },
              { label: 'Netease Connected', value: stats.netease_connected },
              { label: 'Playlists', value: stats.playlists },
              { label: 'Tracks', value: stats.tracks },
              { label: 'Analyses', value: stats.analyses },
            ].map(s => (
              <div key={s.label} className="card" style={{ textAlign: 'center', padding: 'var(--space-4) var(--space-2)' }}>
                <div style={{
                  fontSize: 'var(--text-2xl)', fontWeight: 300,
                  color: 'var(--text-primary)',
                }}>
                  {s.value}
                </div>
                <div className="text-xs text-tertiary font-medium" style={{ marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Users table ───────────────────────────────────────── */}
        <TableSection title={`Users (${users.length})`}>
          {users.length === 0 && <TableEmpty />}
          {users.map((u, i) => (
            <TableRow key={u.id} last={i === users.length - 1}>
              <span className="text-xs text-tertiary" style={{ width: 28 }}>{u.id}</span>
              <span style={{ flex: 1 }}>{u.email}</span>
              <span style={{ color: u.email_verified ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-xs)', width: 90 }}>
                {u.email_verified ? '✓ Verified' : '○ Unverified'}
              </span>
              <span className="text-xs text-tertiary" style={{ width: 140 }}>{u.created_at}</span>
              {confirming === `user-${u.id}` ? (
                <span style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button onClick={() => doDelete('user', u.id, u.email)} className="btn-danger btn-sm"
                    style={{ background: 'rgba(248, 113, 113, 0.1)', borderColor: 'rgba(248, 113, 113, 0.25)' }}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirming(null)} className="btn-ghost btn-sm">Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirming(`user-${u.id}`)} className="btn-danger btn-sm">
                  Delete
                </button>
              )}
            </TableRow>
          ))}
        </TableSection>

        {/* ── Netease connections ───────────────────────────────── */}
        <TableSection title={`Netease Connections (${netease.length})`} style={{ marginBottom: 'var(--space-5)' }}>
          {netease.length === 0 && <TableEmpty />}
          {netease.map((n, i) => (
            <TableRow key={n.netease_user_id || i} last={i === netease.length - 1}>
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{n.netease_nickname}</span>
              <span className="text-xs text-tertiary" style={{ marginLeft: 'var(--space-2)' }}>({n.email})</span>
              <span className="text-xs text-tertiary" style={{ flex: 1 }}>UID: {n.netease_user_id}</span>
              {confirming === `netease-${n.user_id || i}` ? (
                <span style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button onClick={() => doDelete('netease', n.user_id, n.netease_nickname)} className="btn-danger btn-sm"
                    style={{ background: 'rgba(248, 113, 113, 0.1)', borderColor: 'rgba(248, 113, 113, 0.25)' }}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirming(null)} className="btn-ghost btn-sm">Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirming(`netease-${n.user_id || i}`)} className="btn-ghost btn-sm"
                  style={{ color: 'var(--warning)' }}>
                  Disconnect
                </button>
              )}
            </TableRow>
          ))}
        </TableSection>

        {/* ── Playlists table ───────────────────────────────────── */}
        <TableSection title={`Playlists (${playlists.length})`}>
          {playlists.length === 0 && <TableEmpty />}
          {playlists.map((pl, i) => (
            <TableRow key={pl.id} last={i === playlists.length - 1}>
              <span className="text-xs text-tertiary" style={{ width: 28 }}>{pl.id}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pl.name}
              </span>
              <span className="text-xs text-tertiary" style={{ width: 120 }}>{pl.email}</span>
              <span className="text-xs text-tertiary" style={{ width: 60 }}>{pl.track_count} tracks</span>
              {confirming === `playlist-${pl.id}` ? (
                <span style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button onClick={() => doDelete('playlist', pl.id, pl.name)} className="btn-danger btn-sm"
                    style={{ background: 'rgba(248, 113, 113, 0.1)', borderColor: 'rgba(248, 113, 113, 0.25)' }}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirming(null)} className="btn-ghost btn-sm">Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirming(`playlist-${pl.id}`)} className="btn-danger btn-sm">
                  Delete
                </button>
              )}
            </TableRow>
          ))}
        </TableSection>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function TableSection({ title, children, style }) {
  return (
    <div className="card" style={{ marginBottom: 'var(--space-5)', padding: 0, overflow: 'hidden', ...style }}>
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-tertiary)'
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function TableRow({ children, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
      padding: 'var(--space-3) var(--space-4)',
      borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
      fontSize: 'var(--text-sm)',
      transition: 'background var(--transition-fast)'
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </div>
  );
}

function TableEmpty() {
  return <p className="text-sm text-tertiary" style={{ padding: 'var(--space-4)', }}>No data.</p>;
}
