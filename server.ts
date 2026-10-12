import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { apiRouter } from './server/routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const distPath = path.resolve(__dirname, 'dist');
  const distIndexExists = fs.existsSync(path.join(distPath, 'index.html'));
  const isProd = process.env.NODE_ENV === 'production' || (!process.env.npm_lifecycle_event?.includes('dev') && distIndexExists);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS and Preflight Handling for browser iframe and proxies
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', app: 'PAYKAJASTIP', city: 'Singkawang' });
  });

  // API router mounted first
  app.use('/api', apiRouter);

  // Catch-all 404 for ANY unhandled API requests (ensures JSON response instead of HTML)
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan' });
  });
  app.all('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan' });
  });

  // Error-handling middleware for API routes
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    console.error('[API Error]', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  });

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const isHmrDisabled = process.env.DISABLE_HMR === 'true';
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: isHmrDisabled ? false : { server },
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      if (distIndexExists) {
        console.warn('[PAYKAJASTIP Server] Vite dev server initialization failed, falling back to dist static files:', viteErr);
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        throw viteErr;
      }
    }
  } else {
    if (distIndexExists) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('[PAYKAJASTIP Server] dist directory not found. Please run npm run build.');
      app.get('*', (_req, res) => {
        res.status(503).send('PAYKAJASTIP Frontend build is required. Please run npm run build.');
      });
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[PAYKAJASTIP Server] Running on http://0.0.0.0:${PORT} (Mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[PAYKAJASTIP Server] Failed to start:', err);
  process.exit(1);
});
