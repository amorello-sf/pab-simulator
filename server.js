import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');

if (!fs.existsSync(DIST)) {
  console.error(`[pab-simulator] dist/ not found at ${DIST}. Run "npm run build" first.`);
  process.exit(1);
}

app.disable('x-powered-by');
app.use(compression());

// Cache hashed assets aggressively; everything else short-lived so updates roll out fast.
app.use(
  express.static(DIST, {
    setHeaders(res, filePath) {
      if (/\.(js|css|woff2?|png|svg|ico)$/i.test(filePath) && /-[A-Za-z0-9]{8,}\./.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=300');
      }
    },
  })
);

// SPA fallback — send index.html for any non-file GET
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[pab-simulator] listening on http://0.0.0.0:${PORT}`);
});
