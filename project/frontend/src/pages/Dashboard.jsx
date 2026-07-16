import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

function EnergyBar({ value, label, color }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ height: 4, background: '#222', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function PlaylistCard({ pl }) {
  const energies = pl.tracks?.length ? pl.tracks.map(t => t.energy || 0) : [];
  const valences = pl.tracks?.length ? pl.tracks.map(t => t.valence || 0) : [];
  const avgEnergy = energies.length ? energies.reduce((a, b) => a + b, 0) / energies.length : 0;
  const avgValence = valences.length ? valences.reduce((a, b) => a + b, 0) / valences.length : 0.5;

  const hue = avgValence * 120 + 200; // 200 (blue/cool) → 320 (warm/orange)
  const sat = avgEnergy * 80 + 20;

  return (
    <div className="card" style={{ padding: 14 }}>
      {pl.image_url ? (
        <img src={pl.image_url} alt={pl.name} style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, objectFit: 'cover' }} />
      ) : (
        <div style={{
          width: '100%', aspectRatio: '1/1', borderRadius: 8,
          background: `radial-gradient(circle at 30% 30%, hsl(${hue}, ${sat}%, 40%), hsl(${hue}, ${sat}%, 20%))`
        }} />
      )}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</div>
        <div style={{ fontSize: 12, color: '#666' }}>{pl.track_count || 0} tracks</div>
        <EnergyBar value={avgEnergy} label="Energy" color="#a78bfa" />
        <EnergyBar value={avgValence} label="Valence" color="#f59e0b" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [spotify, setSpotify] = useState({ connected: false });
  const [playlists, setPlaylists] = useState([]);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);

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
        const st = await api.spotifyStatus();
        setSpotify(st);
      } catch {}
      try {
        const pl = await api.getPlaylists();
        setPlaylists(pl.playlists);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleConnect = async () => {
    try {
      const { url } = await api.spotifyConnect();
      window.location.href = url;
    } catch (err) {
      alert(err.message);
    }
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
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Welcome back{spotify.display_name ? `, ${spotify.display_name}` : ''}</h2>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>
          {spotify.connected
            ? 'Your Spotify is connected. Import your playlists to see your music-self.'
            : 'Connect Spotify to start building your music-self.'}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          {!spotify.connected ? (
            <button onClick={handleConnect}>Connect Spotify</button>
          ) : (
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

      {playlists.length === 0 && spotify.connected && !importing && (
        <p style={{ textAlign: 'center', color: '#555', marginTop: 40 }}>
          No playlists yet. Click "Import Playlists" to get started.
        </p>
      )}
    </div>
  );
}
