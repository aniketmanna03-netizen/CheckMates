import handlers from './lib/runtime.mjs';

export default (request) => {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/search-products') return handlers.searchProducts(request);
  if (pathname === '/api/analyze-label') return handlers.analyzeLabel(request);
  if (pathname === '/api/explain-label') return handlers.explainLabel(request);
  if (/^\/api\/product\/[^/]+\/?$/.test(pathname)) return handlers.getProduct(request);
  return new Response(JSON.stringify({ error: { code: 'not_found', message: 'API route not found.' } }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
};

export const config = {
  path: ['/api/search-products', '/api/analyze-label', '/api/explain-label', '/api/product/:id'],
  method: ['GET', 'POST'],
  rateLimit: { windowLimit: 15, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
