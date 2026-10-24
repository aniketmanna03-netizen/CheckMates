import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import handlers from './netlify/functions/lib/runtime.mjs';

try { process.loadEnvFile?.('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const publicRoot = path.resolve('public');
const port = Number(process.env.PORT || 8888);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jsx': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8' };
const routeMap = [
  [/^\/api\/search-products\/?$/, handlers.searchProducts],
  [/^\/api\/explain-label\/?$/, handlers.explainLabel],
  [/^\/api\/analyze-label\/?$/, handlers.analyzeLabel],
  [/^\/api\/product\/[a-f0-9]{24}\/?$/, handlers.getProduct],
];

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url || '/', `http://${incoming.headers.host || 'localhost'}`);
    const match = routeMap.find(([pattern]) => pattern.test(url.pathname));
    if (match) {
      const chunks = [];
      let size = 0;
      for await (const chunk of incoming) { size += chunk.length; if (size > 20000) { outgoing.writeHead(413, { 'Content-Type': 'application/json' }); outgoing.end(JSON.stringify({ error: { code: 'payload_too_large', message: 'Request body is too large.' } })); return; } chunks.push(chunk); }
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(url, { method: incoming.method, headers: incoming.headers, body, ...(body ? { duplex: 'half' } : {}) });
      const response = await match[1](request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.resolve(publicRoot, `.${requestedPath}`);
    if (filePath !== publicRoot && !filePath.startsWith(publicRoot + path.sep)) {
      outgoing.writeHead(400); outgoing.end('Bad request'); return;
    }
    const bytes = await readFile(filePath);
    outgoing.writeHead(200, { 'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    outgoing.end(bytes);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : 500;
    outgoing.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    outgoing.end(status === 404 ? 'Not found' : 'Internal server error');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Kissan Drishti local server listening on http://127.0.0.1:${port}`));
process.on('SIGINT', () => server.close(() => process.exit(0)));
