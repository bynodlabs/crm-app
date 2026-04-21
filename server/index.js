import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './src/config.js';
import { ensureAppSchema } from './src/db.js';
import { handleRequest } from './src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const PORT = config.apiPort;
const HOST = config.apiHost;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

const getContentType = (filePath) => MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

const readDistFile = async (relativePath) => {
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(DIST_DIR, safePath);
  return {
    buffer: await readFile(fullPath),
    filePath: fullPath,
  };
};

const serveStatic = async (req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const cleanPath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const looksLikeAsset = path.extname(cleanPath) !== '';

  try {
    const { buffer, filePath } = await readDistFile(cleanPath);
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(buffer);
    return true;
  } catch {
    if (looksLikeAsset) {
      return false;
    }
  }

  try {
    const { buffer, filePath } = await readDistFile('index.html');
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(buffer);
    return true;
  } catch {
    return false;
  }
};

const startServer = async () => {
  await ensureAppSchema();

  const server = createServer((req, res) => {
    if (!req.url?.startsWith('/api')) {
      serveStatic(req, res)
        .then((served) => {
          if (served) return;
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
        })
        .catch((error) => {
          console.error('[static] Unhandled error:', error);
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Internal server error');
        });
      return;
    }

    handleRequest(req, res).catch((error) => {
      console.error('[api] Unhandled error:', error);
      const status = error?.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: status >= 500 ? 'Internal server error' : error.message }));
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`[api] CRM backend listening on http://${HOST}:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('[api] Failed to start CRM backend:', error);
  process.exit(1);
});
