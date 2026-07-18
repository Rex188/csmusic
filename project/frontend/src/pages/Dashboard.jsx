import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { addToast } from '../components/Toast';

function PlaylistCard({ pl, selected, onSelect }) {
  return (
    <div
      className={`card card-interactive${selected ? ' card-selected' : ''}`}
      onClick={() => onSelect(pl)}
      style={{ padding: 'var(--space-3)' }}
    >
      {pl.image_url ? (
        <img src={pl.image_url} alt={pl.name} style={{ width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
      ) : (
        <div style={{
          width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-sm)',
          background: 'radial-gradient(circle at 30% 30%, #2a2a3a, #1a1a2a)'
        }} />
      )}
      <div style={{ marginTop: 'var(--space-2)' }}>
        <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</div>
        <div className="text-xs text-tertiary">{pl.track_count || 0} tracks</div>
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
  const [resendingVerification, setResendingVerification] = useState(false);

  // QR login state
  const [qrStatus, setQrStatus] = useState('');
  const [qrImg, setQrImg] = useState(null);
  const [qrKey, setQrKey] = useState(null);
  const [countdown, setCountdown] = useState(180);

  // Keep sessionStorage in sync with QR state
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
        'Connecting to Netease server... This can take 1–3 minutes.',
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
          addToast(`Connected as ${connectResp.nickname}`, 'success');
          clearQrState();
          return;
        }

        if (check.code === 802) {
          setQrStatus('scanning');
          addToast('Scanned! Please confirm on your phone.', 'info', 3000);
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
    addToast('Importing your playlists... This may take a while.', 'info', 999999);
    try {
      const result = await api.importPlaylists();
      setPlaylists(result.playlists);
      addToast(
        `Imported ${result.imported} tracks across ${result.playlists.length} playlists`,
        'success', 5000
      );
    } catch (err) {
      addToast(err.message, 'error', 5000);
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
      addToast(summary, 'success', 5000);
    } catch (err) {
      addToast(`Analysis failed: ${err.message}`, 'error');
    }
    setAnalyzing(false);
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      await api.resendVerification();
      addToast('Verification email resent!', 'success', 3000);
    } catch (err) {
      addToast(err.message, 'error');
    }
    setResendingVerification(false);
  };

  const handleLogout = async () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    if (waitedRef.current) clearTimeout(waitedRef.current);
    stopCountdown();
    clearQrState();
    await api.logout();
    navigate('/login');
  };

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
        background: 'var(--bg-glass)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: 'var(--space-4) var(--space-6)'
      }}>
        <div style={{ maxWidth: 'var(--max-width-page)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 400,
            background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            music-self
          </h1>
          <button onClick={handleLogout} className="btn-ghost btn-sm">
            Logout
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)' }}>
        {/* ── Verification banner ───────────────────────────────── */}
        {user && !user.email_verified && (
          <div className="card" style={{
            marginBottom: 'var(--space-6)', padding: 'var(--space-3) var(--space-4)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-sm)',
            borderLeft: '3px solid var(--warning)',
            background: 'rgba(251, 191, 36, 0.06)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}>
            <span className="text-sm text-tertiary" style={{ flex: 1 }}>
              Please verify your email address.
            </span>
            <button onClick={handleResendVerification} disabled={resendingVerification}
              className="btn-ghost btn-sm">
              {resendingVerification ? 'Sending...' : 'Resend'}
            </button>
          </div>
        )}

        {/* ── Welcome section ───────────────────────────────────── */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)', fontWeight: 300,
            letterSpacing: '-0.02em',
            marginBottom: 'var(--space-1)'
          }}>
            Welcome{netease.nickname ? `, ${netease.nickname}` : ''}
          </h2>
          <p className="text-base text-secondary">Your music landscape</p>
        </div>

        {/* ── Connection / QR card ──────────────────────────────── */}
        <div className="card" style={{ marginBottom: 'var(--space-8)', padding: 'var(--space-6)' }}>
          <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
            {netease.connected
              ? 'Your Netease Cloud Music is connected. Import your playlists to see your music-self.'
              : 'Connect Netease Cloud Music to start building your music-self.'}
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexDirection: 'column', alignItems: 'flex-start' }}>
            {!netease.connected && qrStatus === '' && (
              <button onClick={handleShowQr} className="btn-primary">
                Connect Netease Cloud Music
              </button>
            )}

            {/* QR flow */}
            {!netease.connected && qrStatus !== '' && (
              <div style={{ textAlign: 'center', width: '100%' }}>
                {qrStatus === 'generating' && (
                  <div style={{ padding: 'var(--space-8) 0' }}>
                    <div className="spinner" />
                    <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-3)' }}>
                      Preparing QR code...
                    </p>
                  </div>
                )}

                {qrImg && (qrStatus === 'waiting' || qrStatus === 'scanning') && (
                  <div style={{ display: 'inline-block' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={qrImg} alt="QR code"
                        style={{
                          width: 180, height: 180, borderRadius: 'var(--radius-sm)',
                          background: '#fff', padding: 8,
                          opacity: qrStatus === 'scanning' ? 0.4 : 1,
                          transition: 'opacity 0.3s'
                        }} />
                      {qrStatus === 'waiting' && (
                        <div style={{
                          position: 'absolute', inset: -4, borderRadius: 'var(--radius-md)',
                          animation: 'pulse-ring 2s infinite'
                        }} />
                      )}
                      {qrStatus === 'scanning' && (
                        <div style={{
                          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                          width: 48, height: 48, borderRadius: 'var(--radius-full)',
                          background: 'rgba(52, 211, 153, 0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-3)' }}>
                      {qrStatus === 'scanning'
                        ? 'Scanned! Confirm on your phone...'
                        : 'Scan with Netease Cloud Music app'}
                    </p>
                    {qrStatus === 'waiting' && countdown > 0 && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                        Expires in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                      </p>
                    )}
                  </div>
                )}

                {qrStatus === 'connecting' && (
                  <div style={{ padding: 'var(--space-8) 0' }}>
                    <div className="spinner" />
                    <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-3)' }}>
                      Connecting to Netease...
                    </p>
                  </div>
                )}

                {qrStatus === 'expired' && (
                  <div style={{ padding: 'var(--space-4) 0' }}>
                    <p className="text-sm" style={{ color: 'var(--error)', marginBottom: 'var(--space-3)' }}>
                      QR code expired
                    </p>
                    <button onClick={handleRetryQr} className="btn-secondary">
                      Generate new QR code
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Import button */}
            {netease.connected && !importing && (
              <button onClick={handleImport} className="btn-primary">
                Import Playlists
              </button>
            )}
          </div>
        </div>

        {/* ── Playlist grid ─────────────────────────────────────── */}
        {playlists.length > 0 && (
          <>
            <h2 className="text-sm text-tertiary font-semibold" style={{ marginBottom: 'var(--space-3)' }}>
              Your playlists
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 'var(--space-3)'
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

            {/* ── Detail panel ──────────────────────────────────── */}
            {selectedPlaylist && (
              <div className="card animate-fade-in" style={{ marginTop: 'var(--space-5)', padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  {selectedPlaylist.image_url && (
                    <img src={selectedPlaylist.image_url} alt={selectedPlaylist.name}
                      style={{ width: 64, height: 64, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{selectedPlaylist.name}</h3>
                    <p className="text-sm text-tertiary">
                      {selectedPlaylist.track_count || 0} tracks
                    </p>
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="btn-primary"
                    style={{ padding: 'var(--space-2) var(--space-5)' }}
                  >
                    {analyzing ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span className="spinner spinner-sm spinner-light" />
                        Analyzing...
                      </span>
                    ) : 'Analyze'}
                  </button>
                </div>

                {/* Analysis results */}
                {analysisResult && (() => {
                  const a = analysisResult.analysis || {};
                  return (
                  <div className="card" style={{
                    background: 'var(--bg-elevated)', backdropFilter: 'none',
                    marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
                    fontSize: 'var(--text-sm)', lineHeight: 1.7
                  }}>
                    {/* Vibe + insight */}
                    {a.vibe && (
                      <div style={{ marginBottom: 'var(--space-4)' }}>
                        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 300, color: 'var(--accent)' }}>{a.vibe}</div>
                        {a.insight && (
                          <div className="text-sm text-secondary" style={{ marginTop: 'var(--space-1)', fontStyle: 'italic', borderLeft: '2px solid var(--border-visible)', paddingLeft: 'var(--space-3)' }}>
                            &ldquo;{a.insight}&rdquo;
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mood tags */}
                    {a.mood_tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: 'var(--space-4)' }}>
                        {a.mood_tags.map((tag, i) => (
                          <span key={i} className="badge badge-accent">{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Metrics */}
                    {(a.energy || a.valence || a.tempo_pace) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                        {a.energy && (
                          <div className="card" style={{ background: 'var(--bg-glass)', backdropFilter: 'none', padding: 'var(--space-2)', textAlign: 'center' }}>
                            <div className="text-xs text-tertiary font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Energy</div>
                            <div className="text-base font-semibold" style={{ marginTop: 2 }}>{a.energy}</div>
                          </div>
                        )}
                        {a.valence && (
                          <div className="card" style={{ background: 'var(--bg-glass)', backdropFilter: 'none', padding: 'var(--space-2)', textAlign: 'center' }}>
                            <div className="text-xs text-tertiary font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mood</div>
                            <div className="text-base font-semibold" style={{ marginTop: 2 }}>{a.valence}</div>
                          </div>
                        )}
                        {a.tempo_pace && (
                          <div className="card" style={{ background: 'var(--bg-glass)', backdropFilter: 'none', padding: 'var(--space-2)', textAlign: 'center' }}>
                            <div className="text-xs text-tertiary font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tempo</div>
                            <div className="text-base font-semibold" style={{ marginTop: 2 }}>{a.tempo_pace}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Genres */}
                    {a.primary_genres?.length > 0 && (
                      <div className="text-sm" style={{ marginBottom: 'var(--space-2)' }}>
                        <span className="text-tertiary">Genres: </span>
                        <span className="text-secondary">{a.primary_genres.join(', ')}</span>
                      </div>
                    )}

                    {/* Artists */}
                    {a.standout_artists?.length > 0 && (
                      <div className="text-sm" style={{ marginBottom: 'var(--space-2)' }}>
                        <span className="text-tertiary">Key artists: </span>
                        <span className="text-secondary">{a.standout_artists.join(', ')}</span>
                      </div>
                    )}

                    {/* Footer metadata */}
                    <div style={{ display: 'flex', gap: 'var(--space-3)', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' }}>
                      {a.diversity && <span>Diversity: {a.diversity}</span>}
                      {a.total_tracks && <span>Total: {a.total_tracks} tracks</span>}
                      {a.sample_size && <span>Analyzed: {a.sample_size} tracks</span>}
                    </div>
                  </div>
                  );
                })()}

                {/* Track list */}
                {tracksLoading && (
                  <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    <div className="spinner" />
                    <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-3)' }}>Loading tracks...</p>
                  </div>
                )}
                {selectedTracks && selectedTracks.length === 0 && !tracksLoading && (
                  <p className="text-sm text-tertiary" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                    No tracks found for this playlist. Try importing playlists first.
                  </p>
                )}
                {selectedTracks && selectedTracks.length > 0 && (
                  <>
                    <h4 className="text-sm text-tertiary font-semibold" style={{ marginBottom: 'var(--space-2)' }}>
                      Tracks ({selectedTracks.length})
                    </h4>
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {selectedTracks.map((t, i) => (
                        <div key={t.id} style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                          padding: 'var(--space-1) 0', borderBottom: '1px solid var(--border-subtle)',
                          fontSize: 'var(--text-sm)', transition: 'background var(--transition-fast)'
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span className="text-xs text-tertiary" style={{ width: 24, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                          {t.image_url ? (
                            <img src={t.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--bg-elevated)' }} />
                          )}
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{t.name}</div>
                            <div className="text-xs text-tertiary" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</div>
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
          <div className="empty-state">
            <div className="empty-state-icon">♪</div>
            <p className="text-sm text-tertiary">
              No playlists yet. Click &ldquo;Import Playlists&rdquo; to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
