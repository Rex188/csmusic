import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { addToast } from '../components/Toast';

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

/* ── sessionStorage helpers for QR state ─────────────────────────── */

const QR_KEY = 'music-self-qr';

function saveQrState(state) {
  try { sessionStorage.setItem(QR_KEY, JSON.stringify(state)); } catch {}
}

function loadQrState() {
  try {
    const raw = sessionStorage.getItem(QR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearQrState() {
  try { sessionStorage.removeItem(QR_KEY); } catch {}
}

/* ── Component ───────────────────────────────────────────────────── */

export default function Dashboard() {
  const navigate = useNavigate();
  const pollRef = useRef(null);
  const countdownRef = useRef(null);
  const waitedRef = useRef(null);
  const startedRef = useRef(null);
  const [user, setUser] = useState(null);
  const [netease, setNetease] = useState({ connected: false });
  const [playlists, setPlaylists] = useState([]);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);

  // QR login state — restore from sessionStorage if available
  const saved = loadQrState();
  const [qrStatus, setQrStatus] = useState(saved?.status || '');
  const [qrImg, setQrImg] = useState(saved?.img || null);
  const [qrKey, setQrKey] = useState(saved?.key || null);
  const [countdown, setCountdown] = useState(180);

  // Keep sessionStorage in sync with QR state
  const syncRef = useRef({ qrStatus, qrImg, qrKey });

  useEffect(() => {
    syncRef.current = { status: qrStatus, img: qrImg, key: qrKey };
    if (qrStatus && qrStatus !== '' && qrStatus !== 'connecting' && qrImg) {
      saveQrState({ status: qrStatus, img: qrImg, key: qrKey });
    } else if (!qrStatus || qrStatus === '' || qrStatus === 'connecting') {
      clearQrState();
    }
  }, [qrStatus, qrImg, qrKey]);

  /* ── Polling logic ─────────────────────────────────────────────── */

  const startPolling = (key) => {
    stopCountdown();
    startCountdown();

    const waited = setTimeout(() => {
      addToast(
        '⏳ Connecting to Netease server... This can take 1–3 minutes. Please stay on this page.',
        'warning', 6000
      );
    }, 15000);
    waitedRef.current = waited;

    let pollFailCount = 0;
    const poll = async () => {
      try {
        const check = await api.neteaseQrCheck(key);
        pollFailCount = 0;

        if (check.code === 803) {
          clearTimeout(waited);
          stopCountdown();
          setQrStatus('connecting');
          const connectResp = await api.neteaseConnect(check.cookie);
          setNetease(connectResp);
          setQrStatus('');
          setQrImg(null);
          setQrKey(null);
          addToast(`✅ Connected as ${connectResp.nickname}`, 'success');
          clearQrState();
          return;
        }

        if (check.code === 802) {
          setQrStatus('scanning');
          addToast('📱 Scanned! Please confirm on your phone.', 'info', 3000);
        } else if (check.code === 800) {
          setQrStatus('expired');
          stopCountdown();
          clearTimeout(waited);
          addToast('QR code expired. Generate a new one.', 'error');
          clearQrState();
          return;
        }
        pollRef.current = setTimeout(poll, 2000);
      } catch (err) {
        pollFailCount++;
        if (pollFailCount >= 15) {
          clearTimeout(waited);
          setQrStatus('expired');
          stopCountdown();
          addToast('Connection lost — please retry.', 'error');
          clearQrState();
          return;
        }
        pollRef.current = setTimeout(poll, 2000);
      }
    };

    poll();
  };

  /* ── Countdown ─────────────────────────────────────────────────── */

  const startCountdown = () => {
    setCountdown(300);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  /* ── Mount ─────────────────────────────────────────────────────── */

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

      // Resume QR polling if there's an active session
      const saved = loadQrState();
      if (saved && saved.key && saved.status === 'waiting') {
        setQrKey(saved.key);
        setQrImg(saved.img);
        setQrStatus('waiting');
        startPolling(saved.key);
      }
    })();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (waitedRef.current) clearTimeout(waitedRef.current);
    };
  }, []);

  /* ── Handlers ──────────────────────────────────────────────────── */

  const handleShowQr = async () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    if (waitedRef.current) clearTimeout(waitedRef.current);
    stopCountdown();
    clearQrState();
    setQrImg(null);
    setQrKey(null);
    setQrStatus('generating');

    try {
      const keyResp = await api.neteaseQrKey();
      const key = keyResp?.data?.unikey;
      if (!key) throw new Error('Failed to get QR key');
      setQrKey(key);

      const qrResp = await api.neteaseQrCreate(key);
      const imgData = qrResp?.data?.qrimg;
      if (!imgData) throw new Error('Failed to create QR image');
      setQrImg(imgData);
      setQrStatus('waiting');
      startPolling(key);
    } catch (err) {
      console.error('[QR] setup error:', err);
      setQrStatus('expired');
      addToast('Failed to generate QR code. Please try again.', 'error');
    }
  };

  const handleRetryQr = () => {
    handleShowQr();
    addToast('Generating new QR code...', 'info', 2000);
  };

  const handleImport = async () => {
    setImporting(true);
    addToast('⏳ Importing your playlists... This may take a while.', 'info', 999999);
    try {
      const result = await api.importPlaylists();
      setPlaylists(result.playlists);
      addToast(
        `✅ Imported ${result.imported} tracks across ${result.playlists.length} playlists`,
        'success', 5000
      );
    } catch (err) {
      addToast(`❌ ${err.message}`, 'error', 5000);
    }
    setImporting(false);
  };

  const handleLogout = async () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    if (waitedRef.current) clearTimeout(waitedRef.current);
    stopCountdown();
    clearQrState();
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
          {!netease.connected && qrStatus === '' && (
            <button onClick={handleShowQr}>Connect Netease Cloud Music</button>
          )}

          {/* QR flow */}
          {!netease.connected && qrStatus !== '' && (
            <div style={{ textAlign: 'center' }}>
              {qrStatus === 'generating' && (
                <div>
                  <div className="spinner" />
                  <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Generating QR code...</p>
                </div>
              )}

              {qrImg && (qrStatus === 'waiting' || qrStatus === 'scanning') && (
                <div>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={qrImg} alt="QR code"
                      style={{
                        width: 180, height: 180, borderRadius: 8, background: '#fff', padding: 8,
                        opacity: qrStatus === 'scanning' ? 0.5 : 1,
                        transition: 'opacity 0.3s'
                      }} />
                    {qrStatus === 'waiting' && (
                      <div style={{
                        position: 'absolute', inset: -4, borderRadius: 12,
                        border: '2px solid #a78bfa', animation: 'pulse 2s infinite'
                      }} />
                    )}
                    {qrStatus === 'scanning' && (
                      <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        fontSize: 48
                      }}>✅</div>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>
                    {qrStatus === 'scanning'
                      ? '✅ Scanned! Confirm on your phone...'
                      : '📱 Scan with Netease Cloud Music app'}
                  </p>
                  {qrStatus === 'waiting' && countdown > 0 && (
                    <p style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
                      Expires in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                    </p>
                  )}
                </div>
              )}

              {qrStatus === 'connecting' && (
                <div>
                  <div className="spinner" />
                  <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Connecting to Netease...</p>
                </div>
              )}

              {qrStatus === 'expired' && (
                <div>
                  <p style={{ fontSize: 14, color: '#f87171', marginBottom: 12 }}>QR code expired</p>
                  <button onClick={handleRetryQr} style={{ background: '#1a1a1a', color: '#a78bfa' }}>
                    Generate new QR code
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Import button */}
          {netease.connected && !importing && (
            <button onClick={handleImport}>Import Playlists</button>
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
