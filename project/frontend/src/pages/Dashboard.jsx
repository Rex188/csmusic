import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

function PlaylistCard({ pl }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      {pl.image_url ? (
        <img src={pl.image_url} alt={pl.name} style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, objectFit: 'cover' }} />
      ) : (
        <div style={{
          width: '100%', aspectRatio: '1/1', borderRadius: 8,
          background: 'radial-gradient(circle at 30% 30%, #2a2a3a, #1a1a2a)'
        }} />
      )}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</div>
        <div style={{ fontSize: 12, color: '#666' }}>{pl.track_count || 0} tracks</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const pollRef = useRef(null);
  const [user, setUser] = useState(null);
  const [netease, setNetease] = useState({ connected: false });
  const [playlists, setPlaylists] = useState([]);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);

  // QR login state
  const [qrKey, setQrKey] = useState(null);
  const [qrImg, setQrImg] = useState(null);
  const [qrStatus, setQrStatus] = useState(''); // '', 'waiting', 'scanning', 'done', 'expired'
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        setUser(me.user);
      } catch {
        navigate('/login');
        return;
      }
      try {
        const st = await api.neteaseStatus();
        setNetease(st);
      } catch {}
      try {
        const pl = await api.getPlaylists();
        setPlaylists(pl.playlists);
      } catch {}
      setLoading(false);
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleShowQr = async () => {
    setQrStatus('waiting');
    setConnecting(true);
    try {
      const keyResp = await api.neteaseQrKey();
      const key = keyResp?.data?.unikey;
      if (!key) throw new Error('Failed to get QR key');
      setQrKey(key);

      const qrResp = await api.neteaseQrCreate(key);
      setQrImg(qrResp?.data?.qrimg);

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const check = await api.neteaseQrCheck(key);
          if (check.code === 803) {
            // Scanned and confirmed
            clearInterval(pollRef.current);
            pollRef.current = null;
            setQrStatus('done');

            // Save cookie
            const connectResp = await api.neteaseConnect(check.cookie);
            setNetease(connectResp);
            setConnecting(false);
            setQrImg(null);
            setQrKey(null);
          } else if (check.code === 802) {
            setQrStatus('scanning');
          } else if (check.code === 800) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setQrStatus('expired');
            setConnecting(false);
          }
          // 801 = still waiting, keep polling
        } catch {
          // poll silently
        }
      }, 2000);
    } catch (err) {
      alert(err.message);
      setConnecting(false);
    }
  };

  const handleRetryQr = () => {
    setQrImg(null);
    setQrKey(null);
    setQrStatus('');
    handleShowQr();
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await api.importPlaylists();
      setPlaylists(result.playlists);
    } catch (err) {
      alert(err.message);
    }
    setImporting(false);
  };

  const handleLogout = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    await api.logout();
    navigate('/login');
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', paddingTop: 80 }}>Loading...</div>;

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>music-self</h1>
        <button onClick={handleLogout} style={{ background: '#1a1a1a', color: '#888', padding: '8px 16px', fontSize: 14 }}>
          Logout
        </button>
      </div>

      {/* Welcome card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          Welcome{netease.nickname ? `, ${netease.nickname}` : ''}
        </h2>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>
          {netease.connected
            ? 'Your Netease Cloud Music is connected. Import your playlists to see your music-self.'
            : 'Connect Netease Cloud Music to start building your music-self.'}
        </p>

        <div style={{ display: 'flex', gap: 10, flexDirection: 'column', alignItems: 'start' }}>
          {!netease.connected && !connecting && (
            <button onClick={handleShowQr}>Connect Netease Cloud Music</button>
          )}

          {connecting && qrImg && (
            <div style={{ textAlign: 'center' }}>
              <img src={qrImg} alt="QR code" style={{ width: 180, height: 180, borderRadius: 8, background: '#fff', padding: 8 }} />
              <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>
                {qrStatus === 'scanning' ? '✅ Scanned! Confirm on your phone...' : '📱 Scan with Netease Cloud Music app'}
              </p>
              {qrStatus === 'expired' && (
                <p style={{ fontSize: 13, color: '#f87171', marginTop: 4 }}>
                  QR code expired. <button onClick={handleRetryQr} style={{ background: 'none', color: '#a78bfa', padding: 0, fontSize: 13, textDecoration: 'underline' }}>Retry</button>
                </p>
              )}
            </div>
          )}

          {netease.connected && (
            <button onClick={handleImport} disabled={importing}>
              {importing ? 'Importing...' : 'Import Playlists'}
            </button>
          )}
        </div>
      </div>

      {/* Playlist grid */}
      {playlists.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#888' }}>Your playlists</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 14
          }}>
            {playlists.map(pl => (
              <PlaylistCard key={pl.id} pl={pl} />
            ))}
          </div>
        </>
      )}

      {playlists.length === 0 && netease.connected && !importing && (
        <p style={{ textAlign: 'center', color: '#555', marginTop: 40 }}>
          No playlists yet. Click "Import Playlists" to get started.
        </p>
      )}
    </div>
  );
}
