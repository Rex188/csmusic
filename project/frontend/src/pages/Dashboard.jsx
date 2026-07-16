import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { addToast } from '../components/Toast';

function PlaylistCard({ pl, selected, onSelect }) {
  return (
    <div
      className="card"
      onClick={() => onSelect(pl)}
      style={{
        padding: 14, cursor: 'pointer',
        border: selected ? '1px solid #a78bfa' : undefined,
        transition: 'border-color 0.2s, box-shadow 0.2s'
      }}
    >
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

function saveQrState(state, userId) {
  try { sessionStorage.setItem(QR_KEY, JSON.stringify({ ...state, userId })); } catch {}
}

function loadQrState(userId) {
  try {
    const raw = sessionStorage.getItem(QR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Only restore if it belongs to the same user (different users on same machine)
    if (parsed.userId && parsed.userId === userId) return parsed;
    return null;
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
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [selectedTracks, setSelectedTracks] = useState(null);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // QR login state
  const [qrStatus, setQrStatus] = useState('');
  const [qrImg, setQrImg] = useState(null);
  const [qrKey, setQrKey] = useState(null);
  const [countdown, setCountdown] = useState(180);

  // Keep sessionStorage in sync with QR state (binds to current user)
  useEffect(() => {
    if (!user) return;
    if (qrStatus && qrStatus !== '' && qrStatus !== 'connecting' && qrImg && qrKey) {
      saveQrState({ status: qrStatus, img: qrImg, key: qrKey }, user.id);
    } else if (!qrStatus || qrStatus === '' || qrStatus === 'connecting') {
      clearQrState();
    }
  }, [qrStatus, qrImg, qrKey, user]);

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

      // Resume QR polling if there's an active session (same user only)
      const saved = loadQrState(me.user?.id);
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

  const handleSelectPlaylist = async (pl) => {
    if (selectedPlaylist?.id === pl.id) {
      setSelectedPlaylist(null);
      setSelectedTracks(null);
      setAnalysisResult(null);
      return;
    }
    setSelectedPlaylist(pl);
    setSelectedTracks(null);
    setAnalysisResult(null);
    setTracksLoading(true);
    try {
      const data = await api.getPlaylistTracks(pl.id);
      setSelectedTracks(data.tracks);
    } catch (err) {
      addToast(`Failed to load tracks: ${err.message}`, 'error');
    }
    setTracksLoading(false);
  };

  const handleAnalyze = async () => {
    if (!selectedPlaylist) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await api.analyzePlaylist(selectedPlaylist.id);
      setAnalysisResult(result);
      const a = result.analysis;
      const summary = a.vibe || `${a.total_tracks} tracks analyzed`;
      addToast(`✅ ${summary}`, 'success', 5000);
    } catch (err) {
      addToast(`❌ Analysis failed: ${err.message}`, 'error');
    }
    setAnalyzing(false);
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
              <PlaylistCard
                key={pl.id}
                pl={pl}
                selected={selectedPlaylist?.id === pl.id}
                onSelect={handleSelectPlaylist}
              />
            ))}
          </div>

          {/* ── Selected playlist detail panel ─────────────────── */}
          {selectedPlaylist && (
            <div className="card" style={{ marginTop: 20, padding: 20, animation: 'fadeIn 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                {selectedPlaylist.image_url && (
                  <img src={selectedPlaylist.image_url} alt={selectedPlaylist.name}
                    style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
                )}
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>{selectedPlaylist.name}</h3>
                  <p style={{ fontSize: 13, color: '#888' }}>
                    {selectedPlaylist.track_count || 0} tracks
                  </p>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  style={{ background: analyzing ? '#333' : '#a78bfa', color: '#fff', padding: '8px 20px', fontSize: 14 }}
                >
                  {analyzing ? 'Analyzing...' : '🎵 Analyze'}
                </button>
              </div>

              {/* Analysis results */}
              {analysisResult && (() => {
                const a = analysisResult.analysis || {};
                return (
                <div style={{
                  marginBottom: 16, padding: 16, borderRadius: 8,
                  background: '#1a1a1a', fontSize: 13, lineHeight: 1.7
                }}>
                  {/* Vibe / insight */}
                  {a.vibe && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#a78bfa' }}>{a.vibe}</div>
                      {a.insight && (
                        <div style={{ color: '#888', fontSize: 13, marginTop: 4, fontStyle: 'italic' }}>
                          "{a.insight}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mood tags */}
                  {a.mood_tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {a.mood_tags.map((tag, i) => (
                        <span key={i} style={{
                          padding: '2px 10px', borderRadius: 12, fontSize: 12,
                          background: '#2a1a4a', color: '#c4a8ff'
                        }}>{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* Metrics row */}
                  {(a.energy || a.valence || a.tempo_pace) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                      {a.energy && (
                        <div style={{ textAlign: 'center', padding: '6px 0', borderRadius: 6, background: '#111' }}>
                          <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Energy</div>
                          <div style={{ fontWeight: 600, marginTop: 2 }}>{a.energy}</div>
                        </div>
                      )}
                      {a.valence && (
                        <div style={{ textAlign: 'center', padding: '6px 0', borderRadius: 6, background: '#111' }}>
                          <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Mood</div>
                          <div style={{ fontWeight: 600, marginTop: 2 }}>{a.valence}</div>
                        </div>
                      )}
                      {a.tempo_pace && (
                        <div style={{ textAlign: 'center', padding: '6px 0', borderRadius: 6, background: '#111' }}>
                          <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Tempo</div>
                          <div style={{ fontWeight: 600, marginTop: 2 }}>{a.tempo_pace}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Genres */}
                  {a.primary_genres?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#666', fontSize: 12 }}>Genres: </span>
                      <span style={{ color: '#ccc' }}>{a.primary_genres.join(', ')}</span>
                    </div>
                  )}

                  {/* Standout artists */}
                  {a.standout_artists?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#666', fontSize: 12 }}>Key artists: </span>
                      <span style={{ color: '#ccc' }}>{a.standout_artists.join(', ')}</span>
                    </div>
                  )}

                  {/* Diversity & sample info */}
                  <div style={{ display: 'flex', gap: 12, color: '#555', fontSize: 11, marginTop: 8 }}>
                    {a.diversity && <span>Diversity: {a.diversity}</span>}
                    {a.total_tracks && <span>Total: {a.total_tracks} tracks</span>}
                    {a.sample_size && <span>Analyzed: {a.sample_size} tracks</span>}
                  </div>
                </div>
                );
              })()}

              {/* Track list */}
              {tracksLoading && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div className="spinner" />
                  <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Loading tracks...</p>
                </div>
              )}
              {selectedTracks && selectedTracks.length === 0 && !tracksLoading && (
                <p style={{ fontSize: 13, color: '#555', textAlign: 'center', padding: 16 }}>
                  No tracks found for this playlist. Try importing playlists first.
                </p>
              )}
              {selectedTracks && selectedTracks.length > 0 && (
                <>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 8 }}>
                    Tracks ({selectedTracks.length})
                  </h4>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {selectedTracks.map((t, i) => (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '6px 0', borderBottom: '1px solid #1a1a1a', fontSize: 13
                      }}>
                        <span style={{ color: '#555', width: 24, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                        {t.image_url ? (
                          <img src={t.image_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: 4, background: '#1a1a1a' }} />
                        )}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{t.name}</div>
                          <div style={{ color: '#666', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
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
