import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandlers } from '../netlify/functions/lib/handlers.mjs';

const productPage = {
  title: 'HarvestClear 20 EC product label',
  url: 'https://ppqs.gov.in/products/harvestclear', score: 0.93,
  content: 'Product name: HarvestClear 20 EC. Active ingredient: Chlorpyrifos. Concentration: 20% EC. Manufacturer: Green Field Crop Sciences Ltd. Registration No: CIB-1234.',
  raw_content: 'Product name: HarvestClear 20 EC\nActive ingredient: Chlorpyrifos\nConcentration: 20% EC\nManufacturer: Green Field Crop Sciences Ltd.\nRegistration No: CIB-1234',
};

function mockStore() {
  const records = new Map();
  return { enabled: true, records, async upsert(rows, query) { for (const row of rows) records.set(row.id, { ...row, searchQuery: query }); }, async get(id) { return records.get(id) || null; } };
}

function setup({ results = [productPage], summary = 'The source lists a product label.', summaryError = null, explanation = null } = {}) {
  const store = mockStore();
  const handlers = createHandlers({
    searchProvider: async () => results,
    explainWithGemini: async ({ labelText, language }) => explanation || ({ simpleExplanation: 'Use only the stated label details.', originalLabelText: labelText, warnings: [], missingOrUnclear: ['Waiting period not shown.'], language }),
    summarizeWithGemini: async () => { if (summaryError) throw summaryError; return summary; },
    store,
  });
  return { handlers, store };
}

test('GET search returns provider URLs and rejects non-web protocols', async () => {
  const { handlers } = setup({ results: [productPage, { title: 'Injected', url: 'javascript:alert(1)', content: 'not a source', score: 1 }] });
  const response = await handlers.searchProducts(new Request('https://site.test/api/search-products?q=HarvestClear'));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.products.length, 1);
  assert.equal(data.products[0].url, productPage.url);
  assert.equal(data.products[0].sourceClass, 'government-domain');
  assert.equal(data.products[0].verificationStatus, 'source-linked-unverified');
  assert.equal(data.summary, 'The source lists a product label.');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('POST endpoints require JSON content type and reject oversized payloads', async () => {
  const { handlers } = setup();
  const unsupported = await handlers.explainLabel(new Request('https://site.test/api/explain-label', { method: 'POST', body: '{}' }));
  assert.equal(unsupported.status, 415);
  const oversized = await handlers.explainLabel(new Request('https://site.test/api/explain-label', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ labelText: 'x'.repeat(12001), language: 'en' }),
  }));
  assert.equal(oversized.status, 400);
});

test('search validates query and returns an explicit empty result', async () => {
  const { handlers } = setup({ results: [] });
  const invalid = await handlers.searchProducts(new Request('https://site.test/api/search-products?q=x'));
  assert.equal(invalid.status, 400);
  const empty = await handlers.searchProducts(new Request('https://site.test/api/search-products?q=unknown%20product'));
  const data = await empty.json();
  assert.equal(empty.status, 200);
  assert.deepEqual(data.products, []);
  assert.match(data.message, /Unable to verify/);
});

test('search preserves source results and returns a safe Gemini error when analysis is unavailable', async () => {
  const { handlers } = setup({ summaryError: Object.assign(new Error('Gemini is rate limited. Please retry shortly.'), { status: 503, code: 'gemini_rate_limited' }) });
  const response = await handlers.searchProducts(new Request('https://site.test/api/search-products?q=HarvestClear'));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.products.length, 1);
  assert.equal(data.aiStatus, 'unavailable');
  assert.equal(data.aiError, 'Gemini is rate limited. Please retry shortly.');
  assert.equal(data.products[0].url, productPage.url);
});

test('unexpected provider failures return generic server errors without leaking provider details', async () => {
  const handlers = createHandlers({
    searchProvider: async () => { throw Object.assign(new Error('internal provider diagnostic'), { code: 23 }); },
    explainWithGemini: async () => null, summarizeWithGemini: async () => null, store: null,
  });
  const response = await handlers.searchProducts(new Request('https://site.test/api/search-products?q=HarvestClear'));
  const data = await response.json();
  assert.equal(response.status, 500);
  assert.equal(data.error.code, 'internal_error');
  assert.equal(data.error.message, 'The server could not complete this request.');
});

test('analysis extracts fields and distinguishes matches, conflicts, and unknowns', async () => {
  const { handlers } = setup();
  const response = await handlers.analyzeLabel(new Request('https://site.test/api/analyze-label', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ labelText: 'Product name: HarvestClear 20 EC\nActive ingredient: Chlorpyrifos\nConcentration: 20% EC\nManufacturer: Other Manufacturer\nRegistration No: CIB-1234', language: 'en' }),
  }));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.extractedFields.productName.value, 'HarvestClear 20 EC');
  assert.equal(data.comparisons[0].identityStatus, 'sufficient-match');
  assert.ok(data.comparisons[0].fields.some((field) => field.key === 'activeIngredient' && field.status === 'match'));
  assert.ok(data.comparisons[0].fields.some((field) => field.key === 'manufacturer' && field.status === 'conflict'));
  assert.ok(data.unverifiedFields.includes('Manufacturer'));
  assert.equal(data.matchedProductIds.length, 1);
});

test('analysis does not claim identity from a name-only source result', async () => {
  const { handlers } = setup({ results: [{ title: 'HarvestClear', url: 'https://example.org/harvestclear', content: 'HarvestClear product information', score: 0.8 }] });
  const response = await handlers.analyzeLabel(new Request('https://site.test/api/analyze-label', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ labelText: 'Product name: HarvestClear', language: 'hi' }),
  }));
  const data = await response.json();
  assert.equal(data.comparisons[0].identityStatus, 'candidate-unconfirmed');
  assert.deepEqual(data.matchedProductIds, []);
});

test('explain endpoint validates input and returns original, warnings, and language separately', async () => {
  const { handlers } = setup();
  const invalid = await handlers.explainLabel(new Request('https://site.test/api/explain-label', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }));
  assert.equal(invalid.status, 400);
  const response = await handlers.explainLabel(new Request('https://site.test/api/explain-label', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ labelText: 'Caution: Harmful if swallowed.', language: 'hi' }),
  }));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.originalLabelText, 'Caution: Harmful if swallowed.');
  assert.equal(data.language, 'Hindi');
});

test('product endpoint reads only indexed product records', async () => {
  const { handlers, store } = setup();
  const search = await handlers.searchProducts(new Request('https://site.test/api/search-products?q=HarvestClear'));
  const searchData = await search.json();
  const response = await handlers.getProduct(new Request(`https://site.test/api/product/${searchData.products[0].id}`));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.product.url, productPage.url);
  assert.equal(data.verificationStatus, 'source-linked-unverified');
  assert.ok(store.records.has(searchData.products[0].id));
});
