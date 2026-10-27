// =========================
// Local storage helpers
// =========================
function saveLocal({ serverUrl, dataUrl, db, dapUrl, user, pass, cfId, cfSecret, remember }) {
  localStorage.setItem('serverUrl', serverUrl);
  localStorage.setItem('dataUrl', dataUrl);
  localStorage.setItem('db', db);
  localStorage.setItem('dapUrl', dapUrl);
  localStorage.setItem('user', user);
  localStorage.setItem('cfId', cfId);
  localStorage.setItem('remember', remember ? '1' : '0');

  if (remember) {
    localStorage.setItem('pass', pass);
    localStorage.setItem('cfSecret', cfSecret);
  } else {
    localStorage.removeItem('pass');
    localStorage.removeItem('cfSecret');
  }
}

function loadLocal() {
  return {
    serverUrl: localStorage.getItem('serverUrl'),
    dataUrl:   localStorage.getItem('dataUrl'),
    db:        localStorage.getItem('db'),
    dapUrl:    localStorage.getItem('dapUrl'),
    user:      localStorage.getItem('user'),
    pass:      localStorage.getItem('pass'),
    cfId:      localStorage.getItem('cfId'),
    cfSecret:  localStorage.getItem('cfSecret'),
    remember:  localStorage.getItem('remember') === '1'
  };
}

// =========================
// fetch wrapper: timeout + readable errors
// =========================
async function safeFetch(url, options = {}, label = 'Request', timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`${label}: timed out after ${timeoutMs / 1000}s`);
    }
    // fetch only throws TypeError for network, CORS and mixed-content failures
    throw new Error(`${label}: could not connect (server unreachable, CORS, or http/https mixed content)`);
  } finally {
    clearTimeout(timer);
  }
}

async function parseJson(res, label) {
  try {
    return await res.json();
  } catch {
    throw new Error(`${label}: server did not return valid JSON`);
  }
}

// =========================
// Subsonic API
// Credentials come from the form; nginx only proxies.
// =========================
function authParams(user, pass) {
  return new URLSearchParams({
    u: user,
    p: pass,
    v: '1.16.1',
    c: 'pwa-subsonic-m3u',
    f: 'json'
  });
}

function cfHeaders(id, secret) {
  return id && secret
    ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret }
    : {};
}

async function getPlaylists(serverUrl, user, pass) {
  const base = serverUrl.replace(/\/+$/, '');
  const url = `${base}/rest/getPlaylists.view?${authParams(user, pass)}`;
  const res = await safeFetch(url, { headers: cf }, 'Subsonic server');

  if (!res.ok) throw new Error(`Subsonic server: HTTP ${res.status}`);

  const json = await parseJson(res, 'Subsonic server');
  const sr = json?.['subsonic-response'];
  if (!sr) throw new Error('Subsonic server: unexpected response');

  // Subsonic reports auth/API errors with HTTP 200 + status "failed"
  if (sr.status !== 'ok') {
    throw new Error(sr.error?.message || 'Subsonic request failed');
  }
  return sr.playlists?.playlist || [];
}

// =========================
// Datasette: track paths for a playlist
// =========================
async function getPlaylist(dataUrl, query, pid) {
  const base = dataUrl.replace(/\/+$/, '');
  const url = `${base}/${query}"${encodeURIComponent(pid)}"`;
  const res = await safeFetch(url, { headers: cf }, 'Datasette');

  if (!res.ok) throw new Error(`Datasette: HTTP ${res.status}`);

  const json = await parseJson(res, 'Datasette');
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

  const res = await safeFetch(
    dapUrl,
    { method: 'POST', body: form, mode: 'cors' },
    'DAP upload',
    15000
  );

  if (!res.ok) throw new Error(`DAP upload: HTTP ${res.status}`);
}

// =========================
// UI wiring
// =========================
const serverInput   = document.getElementById('serverUrl');
const dataInput     = document.getElementById('dataUrl');
const dbInput       = document.getElementById('db');
const queryEl       = document.getElementById('query');
const dapInput      = document.getElementById('dapUrl');
const userInput     = document.getElementById('user');
const passInput     = document.getElementById('pass');
const rememberInput = document.getElementById('remember');
const connectBtn    = document.getElementById('connect');
const list          = document.getElementById('playlists');

// Restore persisted values
const persisted = loadLocal();
if (persisted.serverUrl) serverInput.value = persisted.serverUrl;
if (persisted.dataUrl)   dataInput.value   = persisted.dataUrl;
if (persisted.db)        dbInput.value     = persisted.db;
if (persisted.dapUrl)    dapInput.value    = persisted.dapUrl;
if (persisted.user)      userInput.value   = persisted.user;
if (persisted.pass)      passInput.value   = persisted.pass;
rememberInput.checked = persisted.remember;

connectBtn.onclick = async () => {
  const serverUrl = serverInput.value.trim();
  const dataUrl   = dataInput.value.trim();
  const db        = dbInput.value.trim() || 'navidrome';
  const dapUrl    = dapInput.value.trim();
  const user      = userInput.value.trim();
  const pass      = passInput.value; // don't trim passwords
  const remember  = rememberInput.checked;

  if (!serverUrl || !dataUrl || !db || !user || !pass) {
    alert('Server URL, Datasette URL, Database, Username and Password are required');
    return;
  }

  saveLocal({ serverUrl, dataUrl, db, dapUrl, user, pass, remember });

  list.innerHTML = 'Loading…';

  try {
    const playlists = await getPlaylists(serverUrl, user, pass);
    list.innerHTML = '';

    playlists.forEach(pl => {
      const li = document.createElement('li');
      li.textContent = pl.name;

      li.onclick = async () => {
        try {
          li.textContent = `Generating ${pl.name}…`;
          const dapUrl = dapInput.value.trim();
          const query = queryEl && queryEl.value.trim() !== ''
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
