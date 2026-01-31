// =========================
// Session storage helpers
// =========================
function saveSession(serverUrl, dataUrl, db, dapUrl) {
  sessionStorage.setItem('serverUrl', serverUrl);
  sessionStorage.setItem('dataUrl', dataUrl);
  sessionStorage.setItem('db', db);
  sessionStorage.setItem('dapUrl', dapUrl);
}

function loadSession() {
  return {
    serverUrl: sessionStorage.getItem('serverUrl'),
    dataUrl: sessionStorage.getItem('dataUrl'),
    db: sessionStorage.getItem('db'),
    dapUrl: sessionStorage.getItem('dapUrl')  
  };
}

// =========================
// API calls to /rest/
// Nginx will inject Subsonic u/p and f=json
// =========================
async function getPlaylists(serverUrl) {
  const url = `${serverUrl}/rest/getPlaylists.view`;
  const res = await fetch(url);

  if (!res.ok) throw new Error('Failed to fetch playlists');
  const json = await res.json();
  return json?.['subsonic-response']?.playlists.playlist || [];
}

async function getPlaylist(dataUrl, query, pid) {
  const url = `${dataUrl}/${query}"${encodeURIComponent(pid)}"`;
  const res = await fetch(url);

  if (!res.ok) throw new Error('Failed to fetch playlist details');
  const json = await res.json();
  return (json.rows || []).map(r => r[0]);
}

// =========================
// Generate M3U
// =========================
function generateM3U(name, tracks) {
  const lines = ['#EXTM3U'];

  tracks.forEach(track => {
    lines.push(
      track
    );
  });

  return lines.join('\n');
}

// =========================
// Download or Upload M3U
// =========================
async function exportM3U(name, content, dapUrl) {
  if (dapUrl) {
    await uploadToDAP(dapUrl, name, content);
    return;
  }

  // fallback: normal browser download
  const blob = new Blob([content], { type: 'audio/x-mpegurl' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.m3u`;
  a.click();

  URL.revokeObjectURL(url);
}

async function uploadToDAP(dapUrl, name, content) {
  const form = new FormData();

  form.append('path', '/mnt/mmc/_explaylist_data/');
  form.append(
    'files[]',
    new Blob([content], { type: 'audio/x-mpegurl' }),
    `${name}.m3u`
  );

  const res = await fetch(dapUrl, {
    method: 'POST',
    body: form,
    mode: 'cors'
  });

  if (!res.ok) {
    throw new Error('Failed to upload playlist to DAP');
  }
}

// =========================
// UI wiring
// =========================
const serverInput = document.getElementById('serverUrl');
const dataInput = document.getElementById('dataUrl');
const dbInput = document.getElementById('db');
const queryEl = document.getElementById('query');
const dapInput = document.getElementById('dapUrl');
const connectBtn = document.getElementById('connect');
const list = document.getElementById('playlists');

// Restore session if available
const session = loadSession();
if (session.serverUrl) serverInput.value = session.serverUrl;
if (session.dataUrl) dataInput.value = session.dataUrl;
if (session.db) dbInput.value = session.db;
if (session.dapUrl) dapInput.value = session.dapUrl;

connectBtn.onclick = async () => {
  const serverUrl = serverInput.value.trim();
  const dataUrl = dataInput.value.trim();
  const db = dbInput.value.trim() || "navidrome";
  const dapUrl = dapInput.value.trim();

  if (!serverUrl || !dataUrl || !db) {
    alert('Server URL, Database URL and Database are required');
    return;
  }

  saveSession(serverUrl, dataUrl, db, dapUrl);

  list.innerHTML = 'Loading…';

  try {
    const playlists = await getPlaylists(serverUrl);
    list.innerHTML = '';

    playlists.forEach(pl => {
      const li = document.createElement('li');
      li.textContent = pl.name;

      li.onclick = async () => {
        try {
          li.textContent = `Generating ${pl.name}…`;
          const dapUrl = dapInput.value.trim();
          const query = queryEl && queryEl.value.trim() !== ""
            ? queryEl.value.trim()
            : `${db}.json?sql=select+full_path+from+playlist_export+where+id+%3D+`;
          const tracks = await getPlaylist(dataUrl, query, pl.id);
          const m3u = generateM3U(pl.name, tracks);
          await exportM3U(pl.name, m3u, dapUrl);
        } catch (e) {
          alert(`Failed: ${pl.name}\n${e.message}`);
        } finally {
          li.textContent = pl.name;
        }
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
