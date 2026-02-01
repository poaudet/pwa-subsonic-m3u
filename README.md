[![Live Demo](https://img.shields.io/badge/live-demo-brightgreen?logo=githubpages)](https://poaudet.github.io/pwa-subsonic-m3u/)
[![pages-build-deployment](https://github.com/poaudet/pwa-subsonic-m3u/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/poaudet/pwa-subsonic-m3u/actions/workflows/pages/pages-build-deployment)
![PWA](https://img.shields.io/badge/PWA-ready-success?logo=googlechrome)
![License](https://img.shields.io/github/license/poaudet/pwa-subsonic-m3u)

# 📀 pwa-subsonic-m3u

A **Progressive Web App (PWA)** for easily exporting and downloading M3U playlists from Subsonic-compatible servers (e.g., Navidrome) with optional upload to a **Digital Audio Player (DAP)** device. Designed for use with playlist automation tools like **neptunehub/audiomuse-ai** and simple playlist importing workflows (e.g., Shanglin M1Plus). The application can run in a browser (via GitHub Pages) or locally using a static file server.

---

## 🧠 Personal Use Case

This project was created to streamline the generation and management of `.m3u` playlists for a personal audio stack involving:

* **Navidrome** or other Subsonic-compatible servers that serve music libraries. ([Mopidy][1])
* **neptunehub/audiomuse-ai** for automatic playlist generation, recommendation, or tagging workflows.
* A **DAP device** (e.g., **Shanglin M1Plus**) that can import playlists via HTTP upload — making it trivial to transfer curated playlists to the device.

Instead of manually exporting playlists and dragging them onto the DAP, this PWA enables:

* Fetching playlists from your server
* Uploading them directly to your DAP when reachable
* Falling back to a local download if upload isn’t available

This is especially useful when managing large playlists for offline listening on portable devices.

---

## 🧩 What’s in This Repository

| File            | Purpose                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| `index.html`    | Main UI for the PWA – displays UI and loads the app logic.                     |
| `app.js`        | Core playlist export + upload logic using `fetch()`. Includes upload fallback. |
| `styles.css`    | Visualization & layout styles for the web interface.                           |
| `manifest.json` | PWA metadata (icons, name, start URL).                                         |
| `sw.js`         | Service worker for offline caching and PWA behavior.                           |
| `icons/`        | App icons referenced by the manifest.                                          |

---

## 🔧 Prerequisites

Before using this app, you should have:

### 🔹 Core Services

1. **Subsonic-compatible music server**

   * Examples include **Navidrome**, Airsonic, Subsonic, etc.
   * Must serve playlists in `.m3u` or accessible playlist formats.

2. **Playlist source availability**

   * A view or table (e.g., using **Datasette** or similar) where playlist data is available in a machine-readable format that the PWA can consume.
   * Paths in the playlist must be rewritten to match the expected structure of your DAP, if necessary.

3. **HTTPS + CORS**

   * If the app is hosted on HTTPS (e.g., GitHub Pages), then your server and DAP uploads must also support HTTPS or proper CORS headers.
   * For local networks, correct CORS headers like:

     ```
     Access-Control-Allow-Origin: *
     Access-Control-Allow-Methods: GET, POST
     ```

     are needed to allow cross-origin fetch uploads.

     Quick nginx copy-paste
     ```
      # ===============================
      # CORS handling for Subsonic REST
      # ===============================
      
      set $cors_origin "";
      
      if ($http_origin ~* ^https://poaudet\.github\.io$) {
          set $cors_origin $http_origin;
      }
      
      # Allow origins (lock this down later if you want)
      add_header Access-Control-Allow-Origin $cors_origin always;
      add_header Access-Control-Allow-Methods GET,POST,OPTIONS always;
      add_header Access-Control-Allow-Headers Content-Type always;
      
      # Handle preflight requests
      if ($request_method = OPTIONS) {
          add_header Content-Length 0;
          add_header Content-Type text/plain;
          return 204;
      }
     ```

4. **DAP upload endpoint**

   * Your DAP must accept a `POST` upload endpoint (e.g., `/upload`) where `.m3u` files can be sent via multipart form.

---

## 🚀 Quickstart (Browser)

You can run this directly from GitHub Pages:

1. Open the hosted page (e.g., `https://poaudet.github.io/pwa-subsonic-m3u/`)
2. Enter your music server playlist source URL.
3. Optionally provide your DAP upload URL to send the playlist directly to the device.
4. Export playlists to either the DAP or download for local listening.

No build step required — plain static client.

---

## 🏠 Local Quickstart (Dev/Test)

To serve locally (e.g., for development or local network use):

1. Clone the repository:

   ```sh
   git clone https://github.com/poaudet/pwa-subsonic-m3u.git
   cd pwa-subsonic-m3u
   ```

2. Start a simple Python server:

   ```sh
   python3 -m http.server 8000
   ```

3. Open your browser at:

   ```
   http://localhost:8000
   ```

   The PWA will load locally.

From there, you can use it against your local Navidrome or other services.

---

## ⚙️ CORS & HTTPS Notes

Because this is a static client running in the browser:

* **If your playlist server isn’t on the same origin**, it must provide CORS headers for fetch to work.
* **If the DAP upload is remote**, it must also allow cross-origin uploads via CORS headers.
* If either doesn’t provide correct CORS configuration, the upload will **fail silently or be blocked** by the browser (and fallback to download).
* For local networks, you may need to use HTTPS proxies or locally trusted certificates to avoid mixed-content blocking.

---

## 🧠 Developer Notes

* The app is a **PWA** — it can be installed on mobile devices for offline use thanks to `manifest.json` and `sw.js`.
* `app.js` handles upload and fallback logic robustly, including CORS cases and HTTP status checks.
* It’s a lightweight, **static site** — deployable anywhere that can serve HTML/CSS/JS.

---

## 📜 License

This project is licensed under the **MIT License**, allowing reuse and modification.
