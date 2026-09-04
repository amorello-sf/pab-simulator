# Salesforce PAB Practice Simulator — React edition

240-question practice bank for the **Salesforce Certified Platform App Builder** exam (SU'26), built with **React + Vite** and served by a tiny **Express** app. Ready to host on **Render** (or any Node platform) and installable as a **PWA** on iOS / Android.

The vanilla single-file version is still in `../pab-simulator/` if you need it offline.

## Features

- 📚 **Study mode** — filter by area / difficulty / previously-missed, choose exactly how many questions (10, 20, 40, 60, 100, all, or custom). The bank samples them proportionally across the exam blueprint (18 / 20 / 32 / 17 / 13 %).
- 🎯 **Exam mode** — 60 randomized questions, blueprint-weighted, 105-minute countdown timer (amber at 10 min, red at 1 min, auto-submit on expiry), 73 % passing score.
- 🎯 **Weak areas review** — only questions you've missed in prior sessions.
- 📊 **Stats** — lifetime accuracy per area, last 30 exam attempts.
- Instant feedback with detailed explanations and Salesforce Help / Trailhead references.
- Mobile-first responsive UI, big tap targets, safe-area insets.
- Installable as a home-screen app (web manifest + apple-touch meta).
- Progress persisted in `localStorage` — nothing leaves the device.

## Local development

```bash
cd OUTPUTS/pab-simulator-react
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

Production build + Express smoke test:

```bash
npm run build        # emits ./dist
npm start            # Express serves ./dist on $PORT (default 3000)
```

## Deploy to Render (primary path)

The repo ships with a **Render Blueprint** (`render.yaml`). You need a free [Render](https://render.com) account and a git remote (GitHub / GitLab / Bitbucket).

### Option A — Blueprint (recommended, one-click)

1. **Push this folder to a git repo.** From `OUTPUTS/pab-simulator-react/`:

   ```bash
   git init
   git add .
   git commit -m "PAB simulator — initial"
   git branch -M main
   git remote add origin https://github.com/YOUR-USER/pab-simulator.git
   git push -u origin main
   ```

2. **Create the service in Render.** In the Render Dashboard click **New +** → **Blueprint**, select the repo, and confirm. Render reads `render.yaml` and provisions everything automatically:
   - Runtime: Node 20
   - Region: Frankfurt (change in `render.yaml` if you prefer a US / Asia region)
   - Build: `npm ci --include=dev && npm run build`
   - Start: `node server.js`
   - Health check: `GET /`
   - Auto-deploy on every push to `main`

3. **Wait for the first deploy** (~2–3 minutes). Render prints the public URL — something like `https://pab-simulator.onrender.com`. Open it and you're done.

### Option B — Manual (no Blueprint)

If you'd rather not commit `render.yaml`, do it by hand:

1. Push the repo.
2. Render Dashboard → **New +** → **Web Service** → select the repo.
3. Fill the form:
   - **Runtime**: `Node`
   - **Build command**: `npm ci --include=dev && npm run build`
   - **Start command**: `node server.js`
   - **Environment variable**: `NODE_VERSION=20`
   - **Health check path**: `/`
4. Pick region + plan (Free works — spins down after 15 min idle, cold-starts in ~30 s; Starter at $7/mo stays warm).
5. **Create Web Service**.

### Notes on the Free plan

- The service **sleeps after 15 minutes of inactivity** and cold-starts on the next request (~30 s wait). Fine for personal study, obviously not for hammering right before your exam. Upgrade to the **Starter** plan ($7/mo) to keep it warm.
- HTTPS certificate + a `*.onrender.com` domain are included.
- Auto-deploy on `git push origin main` is on by default.

### Custom domain (optional)

Render Dashboard → your service → **Settings** → **Custom Domains** → add domain, then update the DNS record it shows you.

## Access from mobile

- **Live on Render** — open the URL in Safari / Chrome and tap **Share → Add to Home Screen** (iOS) or **⋮ → Install app** (Android). The web manifest + apple-touch meta launch it full-screen with an app icon.
- **On your local Wi-Fi during dev** — run `npm run dev` and browse to `http://<your-mac-ip>:5173` from the phone (Vite starts with `--host`).

## Alternative hosts

Any Node platform works with the same `server.js` + `Procfile`:
- **Fly.io** — `flyctl launch` reads `Procfile` automatically.
- **Railway** — connect the repo; Railway auto-detects Node + Procfile.
- **Azure App Service (Node)** — Deploy from GitHub, configure `npm run build` as post-build.

Static-only hosts (Netlify, Vercel, Cloudflare Pages) also work — point them at `npm run build`, publish `dist/`, enable SPA fallback to `index.html`. No server code needed in that case.

## Project structure

```
pab-simulator-react/
├── package.json         # scripts + engines pin (Node 20.x)
├── vite.config.js       # Vite + React plugin
├── server.js            # Express: static dist/ + SPA fallback + compression
├── Procfile             # web: node server.js  (used by Render/Fly/Railway/Heroku)
├── render.yaml          # Render Blueprint (one-click provision)
├── app.json             # Heroku metadata (kept for portability; ignored by Render)
├── .nvmrc               # Node 20 for hosts that honor it
├── index.html           # Vite entry
├── public/
│   ├── manifest.webmanifest
│   ├── favicon.svg
│   ├── icon-192.svg
│   └── icon-512.svg
└── src/
    ├── main.jsx         # React mount
    ├── App.jsx          # State machine + all screens
    ├── components/
    │   └── Quiz.jsx     # Question + Navigator
    ├── lib/
    │   ├── sampling.js  # Blueprint-weighted sampler (largest-remainder)
    │   └── storage.js   # localStorage helpers
    ├── data/
    │   └── questions.json  # 240-question bundle
    └── styles.css
```

## Regenerating the question bundle

The bundle here is a copy of `../pab-simulator/questions.json`. If you edit any of the per-area JSON files under `../pab-simulator/questions/`, rerun the build script in that folder and copy the merged bundle back:

```bash
cd ../pab-simulator && python3 build.py
cp questions.json ../pab-simulator-react/src/data/questions.json
cd ../pab-simulator-react && npm run build
```

## Troubleshooting

- **Render build fails with `vite: not found`** → your build command dropped `--include=dev`. Set it back to `npm ci --include=dev && npm run build`. (Vite lives in `devDependencies` and Render/npm skip devDeps when `NODE_ENV=production`.)
- **First response after a while is slow** → free-plan cold start. Upgrade or ping the URL periodically.
- **Old service worker caching old content** → the app doesn't register a service worker, so a hard refresh (Cmd/Ctrl-Shift-R) is enough.
- **Locally `npm start` says `dist/ not found`** → run `npm run build` first.

## Disclaimer

Study material only. Not an official Salesforce product. Questions were written by Claude based on the SU'26 exam outline and public Salesforce documentation. Always verify against Salesforce Help before relying on any answer for production work.

Good luck on Monday! 🚀
