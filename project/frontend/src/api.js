const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  // Check content-type before trying .json() to avoid "body stream already read"
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json') && !ct.includes('text/json')) {
    const text = await res.text();
    throw new Error(`Server returned ${res.status} (not JSON — is the backend running?)\n${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/me'),

  // Netease Cloud Music
  neteaseQrKey: () => request('/netease/qr/key'),
  neteaseQrCreate: (key) => request(`/netease/qr/create?key=${key}`),
  neteaseQrCheck: (key) => request(`/netease/qr/check?key=${key}`),
  neteaseConnect: (cookie) => request('/netease/connect', { method: 'POST', body: JSON.stringify({ cookie }) }),
  neteaseStatus: () => request('/netease/status'),
  neteaseDisconnect: () => request('/netease/disconnect', { method: 'POST' }),

  // Playlists
  getPlaylists: () => request('/playlists'),
  importPlaylists: () => request('/playlists/import', { method: 'POST' }),

  // Analysis
  getPlaylistTracks: (playlistId) => request(`/analysis/tracks/${playlistId}`),
  analyzePlaylist: (playlistId) => request(`/analysis/analyze/${playlistId}`, { method: 'POST' }),
  getAnalysisStatus: (jobId) => request(`/analysis/status/${jobId}`),
};
