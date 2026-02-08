// =========================
// Local storage helpers
// =========================
function saveLocal(serverUrl, dataUrl, db, dapUrl) {
  // Store each value under a distinct key in localStorage
  localStorage.setItem('serverUrl', serverUrl);
  localStorage.setItem('dataUrl', dataUrl);
  localStorage.setItem('db', db);
  localStorage.setItem('dapUrl', dapUrl);
}

function loadLocal() {
  // Retrieve the stored values; missing keys resolve to null
  return {
    serverUrl: localStorage.getItem('serverUrl'),
    dataUrl:   localStorage.getItem('dataUrl'),
    db:        localStorage.getItem('db'),
    dapUrl:    localStorage.getItem('dapUrl')
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
  tracks.forEach(track => lines.push(track));
  return lines.join('\n');
}

// =========================
// Download or Upload M3U
// =========================
async function exportM3U(name, content, dapUrl) {
  if (dapUrl) {
    try {
      await uploadToDAP(dapUrl, name, content);
      return; // success → stop here
    } catch (err) {
      console.warn('DAP upload failed, falling back to browser download:', err);
      // fall through to browser download
    }
  }

  // fallback: normal browser download
  const blob = new Blob([content], { type: 'audio/x-mpegurl' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.m3u`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

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

  let res;
  try {
    res = await fetch(dapUrl, {
      method: 'POST',
      body: form,
      mode: 'cors'
    });
  } catch (err) {
    throw new Error('DAP upload blocked by browser');
  }

  if (res.status !== 200) {
    throw new Error(`DAP upload failed: ${res.status}`);
  }
}

// =========================
// UI wiring
// =========================
const serverInput = document.getElementById('serverUrl');
const dataInput   = document.getElementById('dataUrl');
const dbInput     = document.getElementById('db');
const queryEl     = document.getElementById('query');
const dapInput    = document.getElementById('dapUrl');
const connectBtn  = document.getElementById('connect');
const list        = document.getElementById('playlists');

// Restore persisted values (now from localStorage)
const persisted = loadLocal();
if (persisted.serverUrl) serverInput.value = persisted.serverUrl;
if (persisted.dataUrl)   dataInput.value   = persisted.dataUrl;
if (persisted.db)        dbInput.value     = persisted.db;
if (persisted.dapUrl)    dapInput.value    = persisted.dapUrl;

connectBtn.onclick = async () => {
  const serverUrl = serverInput.value.trim();
  const dataUrl   = dataInput.value.trim();
  const db        = dbInput.value.trim() || "navidrome";
  const dapUrl    = dapInput.value.trim();

  if (!serverUrl || !dataUrl || !db) {
    alert('Server URL, Database URL and Database are required');
    return;
  }

  // Persist the current session for future page loads
  saveLocal(serverUrl, dataUrl, db, dapUrl);

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