/**
 * Downloado backend — minimal Express server
 * ------------------------------------------------
 * It receives { url, type } from your frontend and returns:
 *   { media: [ { url: "<direct media link>", name: "file.jpg" } ] }
 *
 * Two modes are included. Pick ONE by setting MODE below.
 *   - "api"  : uses a third-party downloader API (easiest, most reliable, paid)
 *   - "ytdlp": uses yt-dlp installed on the server (free, public posts only, fragile)
 *
 * DEPLOY (Render.com, free):
 *   1. Put server.js + package.json in a GitHub repo (or upload as a folder).
 *   2. New > Web Service > connect the repo.
 *   3. Build command:  npm install
 *      Start command:  node server.js
 *   4. For "api" mode, add an Environment Variable: RAPIDAPI_KEY = your key
 *   5. For "ytdlp" mode, add a build step that installs yt-dlp (see note at bottom).
 *   6. Copy the live URL Render gives you and paste it into the frontend's API_ENDPOINT.
 */

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());            // lets your Netlify page talk to this server
app.use(express.json());

const MODE = 'ytdlp';       // 'ytdlp' = 100% free (no key) · 'api' = paid third-party API
const PORT = process.env.PORT || 3000;

/* ---------- helper: pull a clean filename ---------- */
function fileNameFrom(link, fallback) {
  try {
    const clean = link.split('?')[0];
    const last = clean.substring(clean.lastIndexOf('/') + 1);
    return last && last.includes('.') ? last : fallback;
  } catch { return fallback; }
}

/* ============================================================
   MODE 1 — Third-party API (recommended, most reliable)
   Sign up on rapidapi.com, search "Instagram downloader",
   subscribe to one, and copy its host + endpoint below.
   ============================================================ */
async function viaApi(url) {
  const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY;          // set on Render
  const RAPIDAPI_HOST = 'instagram-downloader-example.p.rapidapi.com'; // <-- replace with your chosen API's host
  const ENDPOINT      = `https://${RAPIDAPI_HOST}/?url=${encodeURIComponent(url)}`;

  if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY is not set on the server.');

  const res = await fetch(ENDPOINT, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': RAPIDAPI_HOST
    }
  });
  if (!res.ok) throw new Error('Downloader API returned ' + res.status);
  const data = await res.json();

  // Each API shapes its response differently. Adjust these lines to match
  // the JSON your chosen API returns (check its docs / "Example Response").
  const links = data.media || data.links || (data.url ? [data.url] : []);
  return links.map((m, i) => {
    const link = typeof m === 'string' ? m : (m.url || m.download_url);
    return { url: link, name: fileNameFrom(link, `downloado-${i + 1}`) };
  });
}

/* ============================================================
   MODE 2 — yt-dlp (free, public content only)
   Requires yt-dlp installed on the server (see bottom note).
   ============================================================ */
async function viaYtDlp(url) {
  const { execFile } = require('node:child_process');
  const { promisify } = require('node:util');
  const run = promisify(execFile);
  // -g prints the direct media URL(s) without downloading the file itself
  const { stdout } = await run('yt-dlp', ['-g', url], { timeout: 30000 });
  const links = stdout.trim().split('\n').filter(Boolean);
  if (!links.length) throw new Error('No media found.');
  return links.map((link, i) => ({ url: link, name: `downloado-${i + 1}` }));
}

/* ---------- the route your frontend calls ---------- */
app.post('/api/download', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !/instagram\.com|instagr\.am/.test(url)) {
    return res.status(400).json({ error: 'Please send a valid Instagram URL.' });
  }
  try {
    const media = MODE === 'ytdlp' ? await viaYtDlp(url) : await viaApi(url);
    res.json({ media });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (_req, res) => res.send('Downloado backend is running ✔'));
app.listen(PORT, () => console.log('Downloado backend on port ' + PORT));

/*
 * NOTE for yt-dlp mode on Render:
 *   Add this as the Build Command instead of just "npm install":
 *     pip install yt-dlp && npm install
 *   (Render's images include Python, so pip is available.)
 */
