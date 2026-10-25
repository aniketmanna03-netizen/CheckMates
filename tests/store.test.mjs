import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalProductStore } from '../netlify/functions/lib/store.mjs';

test('local product index writes source-linked records to its configured file', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'kisanlens-store-'));
  try {
    const store = new LocalProductStore({ enabled: true, filePath: path.join(folder, 'products.json') });
    const product = { id: 'a'.repeat(24), title: 'Example product', url: 'https://example.org/product', verificationStatus: 'source-linked-unverified' };
    await store.upsert([product], 'Example product');
    const retrieved = await store.get(product.id);
    assert.equal(retrieved.searchQuery, 'Example product');
    assert.equal(retrieved.verificationStatus, 'source-linked-unverified');
    assert.equal(JSON.parse(await readFile(path.join(folder, 'products.json'), 'utf8'))[product.id].url, product.url);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
