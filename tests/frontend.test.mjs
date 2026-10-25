import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/kl/engine.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);

test('scanner accepts allowed image types within size limits and rejects mismatched file types', () => {
  const KL = context.window.KL;
  assert.equal(KL.validateFile({ name: 'label.jpg', type: 'image/jpeg', size: 20000 }), null);
  assert.match(KL.validateFile({ name: 'label.pdf', type: 'application/pdf', size: 20000 }), /Unsupported/);
  assert.match(KL.validateFile({ name: 'label.png', type: 'image/png', size: 11 * 1024 * 1024 }), /10 MB/);
  assert.equal(KL.validateImageSignature(Uint8Array.from([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'image/jpeg'), null);
  assert.equal(KL.validateImageSignature(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), 'image/png')?.startsWith('This file'), true);
  assert.equal(KL.validateImageDimensions(6000, 4000), null);
  assert.match(KL.validateImageDimensions(9000, 4000), /24 megapixels/);
});

test('Netlify routes share a single rate-limit rule within entry-level plan limits', async () => {
  const { default: api, config } = await import('../netlify/functions/api.mjs');
  assert.deepEqual(config.path, ['/api/search-products', '/api/analyze-label', '/api/explain-label', '/api/product/:id']);
  assert.equal(config.rateLimit.windowLimit, 15);
  assert.equal(config.rateLimit.windowSize, 60);
  assert.deepEqual(config.rateLimit.aggregateBy, ['ip', 'domain']);
  assert.deepEqual(config.method, ['GET', 'POST']);
  const response = await api(new Request('https://site.test/api/search-products?q=tea', { method: 'POST' }));
  assert.equal(response.status, 405);
});
