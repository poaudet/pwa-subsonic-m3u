// =========================
// Session storage helpers
// =========================
function saveSession(serverUrl, cfId, cfKey) {
  sessionStorage.setItem('serverUrl', serverUrl);
  sessionStorage.setItem('cfId', cfId);
  sessionStorage.setItem('cfKey', cfKey);
}

function loadSession() {
  return {
    serverUrl: sessionStorage.getItem('serverUrl'),
    cfId: sessionStorage.getItem('cfId'),
    cfKey: sessionStorage.getItem('cfKey')
  };
}

// =========================
// Cloudflare headers
// =========================
function cfHeaders(cfId, cfKey) {
  return {
    'CF-Client-Id': cfId,
    'CF-Client-Key': cfKey
  };
}

// =========================
// API calls to /rest/
// Nginx will inject Subsonic u/p and f=json
// =========================
async function getPlaylists(serverUrl, cfId, cfKey) {
  const url = `${serverUrl}/rest/getPlaylists.view`;
  const res = await fetch(url, {
    headers: cfHeaders(cfId, cfKey)
  });

  if (!res.ok) throw new Error('Failed to fetch playlists');
  const json = await res.json();
  return json['subsonic-response'].playlists.playlist || [];
}

async function getPlaylist(serverUrl, cfId, cfKey, playlistId) {
  const url = `${serverUrl}/rest/getPlaylist.view?id=${playlistId}`;
  const res = await fetch(url, {
    headers: cfHeaders(cfId, cfKey)
  });

  if (!res.ok) throw new Error('Failed to fetch playlist details');
  const json = await res.json();
  return json['subsonic-response'].playlist.entry || [];
}

// =========================
// Path rewrite (Option B)
// =========================
function rewritePath(path) {
  // Adjust to match your proxy mapping
  return path
    .replace(/^\/music\//, '/mnt/media/')
    .replace(/\\/g, '/');
}

function buildFileUrl(serverUrl, path) {
  return `${serverUrl}${rewritePath(path)}`;
}

// =========================
// Generate M3U
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
// Download M3U
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
const cfIdInput = document.getElementById('cfId');
const cfKeyInput = document.getElementById('cfKey');
const connectBtn = document.getElementById('connect');
const list = document.getElementById('playlists');

// Restore session if available
const session = loadSession();
if (session.serverUrl) serverInput.value = session.serverUrl;
if (session.cfId) cfIdInput.value = session.cfId;
if (session.cfKey) cfKeyInput.value = session.cfKey;

connectBtn.onclick = async () => {
  const serverUrl = serverInput.value.trim();
  const cfId = cfIdInput.value.trim();
  const cfKey = cfKeyInput.value.trim();

  if (!serverUrl || !cfId || !cfKey) {
    alert('Server URL, CF-Client-Id, and CF-Client-Key are required');
    return;
  }

  saveSession(serverUrl, cfId, cfKey);

  list.innerHTML = 'Loading…';

  try {
    const playlists = await getPlaylists(serverUrl, cfId, cfKey);
    list.innerHTML = '';

    playlists.forEach(pl => {
      const li = document.createElement('li');
      li.textContent = pl.name;

      li.onclick = async () => {
        li.textContent = `Generating ${pl.name}…`;

        const tracks = await getPlaylist(serverUrl, cfId, cfKey, pl.id);
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
// Service worker registration
// =========================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
