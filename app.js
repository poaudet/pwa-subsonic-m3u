// =========================
// Session storage helpers
// =========================

function saveSession(serverUrl, token) {
  sessionStorage.setItem('serverUrl', serverUrl);
  sessionStorage.setItem('token', token);
}

function loadSession() {
  return {
    serverUrl: sessionStorage.getItem('serverUrl'),
    token: sessionStorage.getItem('token')
  };
}

// =========================
// Auth header
// =========================

function authHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`
  };
}

// =========================
// API calls
// =========================

async function getPlaylists(serverUrl, token) {
  const url = `${serverUrl}/rest/getPlaylists.view?f=json`;

  const res = await fetch(url, {
    headers: authHeaders(token)
  });

  if (!res.ok) throw new Error('Playlist fetch failed');

  const json = await res.json();
  return json['subsonic-response'].playlists.playlist || [];
}

async function getPlaylist(serverUrl, token, playlistId) {
  const url = `${serverUrl}/rest/getPlaylist.view?id=${playlistId}&f=json`;

  const res = await fetch(url, {
    headers: authHeaders(token)
  });

  if (!res.ok) throw new Error('Playlist detail fetch failed');

  const json = await res.json();
  return json['subsonic-response'].playlist.entry || [];
}

// =========================
// Path rewrite (OPTION B)
// =========================

function rewritePath(path) {
  // Adjust this to match your proxy mapping
  return path
    .replace(/^\/music\//, '/mnt/media/')
    .replace(/\\/g, '/');
}

function buildFileUrl(serverUrl, path) {
  return `${serverUrl}${rewritePath(path)}`;
}

// =========================
// M3U generation
// =========================

function generateM3U(name, tracks, serverUrl) {
  const lines = ['#EXTM3U'];

  tracks.forEach(track => {
    lines.push(
      `#EXTINF:${track.duration || -1},${track.artist} - ${track.title}`
    );
    lines.push(
      buildFileUrl(serverUrl, track.path)
    );
  });

  return lines.join('\n');
}

// =========================
// Download
// =========================

function downloadM3U(name, content) {
  const blob = new Blob([content], { type: 'audio/x-mpegurl' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.m3u`;
  a.click();

  URL.revokeObjectURL(url);
}

// =========================
// UI wiring
// =========================

const serverInput = document.getElementById('serverUrl');
const tokenInput = document.getElementById('token');
const connectBtn = document.getElementById('connect');
const list = document.getElementById('playlists');

// Restore session if available
const session = loadSession();
if (session.serverUrl) serverInput.value = session.serverUrl;
if (session.token) tokenInput.value = session.token;

connectBtn.onclick = async () => {
  const serverUrl = serverInput.value.trim();
  const token = tokenInput.value.trim();

  if (!serverUrl || !token) {
    alert('Missing server URL or token');
    return;
  }

  saveSession(serverUrl, token);
  list.innerHTML = 'Loading…';

  try {
    const playlists = await getPlaylists(serverUrl, token);
    list.innerHTML = '';

    playlists.forEach(pl => {
      const li = document.createElement('li');
      li.textContent = pl.name;

      li.onclick = async () => {
        li.textContent = `Generating ${pl.name}…`;

        const tracks = await getPlaylist(serverUrl, token, pl.id);
        const m3u = generateM3U(pl.name, tracks, serverUrl);
        downloadM3U(pl.name, m3u);

        li.textContent = pl.name;
      };

      list.appendChild(li);
    });

  } catch (err) {
    alert(err.message);
    list.innerHTML = '';
  }
};

// =========================
// Service worker
// =========================

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
