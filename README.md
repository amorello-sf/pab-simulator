# Salesforce PAB Practice Simulator — React edition

240-question practice bank for the **Salesforce Certified Platform App Builder** exam (SU'26), built with **React + Vite** and served by a tiny **Express** app. Ready to host on **Heroku** (or any Node platform) and installable as a **PWA** on iOS / Android.

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

Production build + Express test:

```bash
npm run build        # emits ./dist
npm start            # Express serves ./dist on $PORT (default 3000)
```

## Deploy to Heroku

You need the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed and to be logged in (`heroku login`).

```bash
cd OUTPUTS/pab-simulator-react

# 1. Initialize a git repo (Heroku deploys via git push)
git init
git add .
git commit -m "PAB practice simulator — initial deploy"

# 2. Create the Heroku app (or use an existing one)
heroku create pab-simulator-yourname   # pick any unique name

# 3. Keep devDependencies during build so Vite can compile
heroku config:set NPM_CONFIG_PRODUCTION=false

# 4. Push and let Heroku build
git push heroku HEAD:main              # or "main:main" if your branch is already main

# 5. Open it
heroku open
```

The `heroku-postbuild` npm script triggers `vite build` during release, then the `Procfile` (`web: node server.js`) starts Express, which serves `dist/` and falls back to `index.html` for SPA routes. Port comes from `$PORT`.

### One-click deploy button (optional)

Add this to a public GitHub repo README to give collaborators a Deploy-to-Heroku button (relies on the included `app.json`):

```markdown
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/YOUR-USER/YOUR-REPO)
```

### Alternative hosts

Any Node platform works out of the box: Fly.io, Render, Railway, Azure App Service, etc. Static-only hosts (Netlify, Vercel, Cloudflare Pages) also work — point them at `npm run build`, publish `dist/`, and enable SPA fallback to `index.html`. No server code needed in that case.

## Access from mobile

- **Live on Heroku** — just open the URL in Safari / Chrome and tap **Share → Add to Home Screen** (iOS) or **⋮ → Install app** (Android). The manifest + apple-touch meta launch it full-screen.
- **On your local Wi-Fi during dev** — run `npm run dev` and browse to `http://<your-mac-ip>:5173` from the phone (Vite is started with `--host`).

## Project structure

```
pab-simulator-react/
├── package.json         # scripts + engines pin (Node 20.x)
├── vite.config.js       # Vite + React plugin
├── server.js            # Express: static dist/ + SPA fallback + compression
├── Procfile             # web: node server.js
├── app.json             # Heroku config (buildpack + env)
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

## Disclaimer

Study material only. Not an official Salesforce product. Questions were written by Claude based on the SU'26 exam outline and public Salesforce documentation. Always verify against Salesforce Help before relying on any answer for production work.

Good luck on Monday! 🚀
