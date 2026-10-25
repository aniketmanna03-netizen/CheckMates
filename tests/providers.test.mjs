import test from 'node:test';
import assert from 'node:assert/strict';
import { explainLabelWithGemini, summarizeSearchWithGemini, tavilySearch } from '../netlify/functions/lib/providers.mjs';

test('Tavily is an actual configured API and fails closed without a key', async () => {
  await assert.rejects(() => tavilySearch('chlorpyrifos', { TAVILY_API_KEY: '' }), (error) => error.status === 503 && error.code === 'search_not_configured');
});

test('Gemini uses only its server key and fails closed when it is absent', async () => {
  await assert.rejects(() => explainLabelWithGemini({ labelText: 'Caution: Harmful.', language: 'English' }, { GEMINI_API_KEY: '' }), (error) => error.status === 503 && error.code === 'gemini_not_configured');
});

test('Gemini SDK gets model and key server-side; safety lines remain verbatim', async () => {
  let request;
  const fetch = async (url, options) => {
    request = { url: String(url), options, body: JSON.parse(options.body) };
    const generated = {
      lineExplanations: [
        { id: 'line-0', explanation: 'Use 20 ml of the pesticide every day.' },
        { id: 'line-1', explanation: 'Harmful if swallowed.' },
      ], missingOrUnclear: ['Waiting period not found.'],
    };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] }, finishReason: 'STOP' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await explainLabelWithGemini({ labelText: 'Dose: 10 ml per acre.\nWarning: Harmful if swallowed.', language: 'English' }, {
    GEMINI_API_KEY: 'test-server-key', GEMINI_MODEL: 'gemini-3.5-flash-lite', GEMINI_TEST_FETCH: fetch,
  });
  assert.match(request.url, /gemini-3\.5-flash-lite:generateContent/);
  const keyInHeader = new Headers(request.options.headers).get('x-goog-api-key') === 'test-server-key';
  const keyInUrl = new URL(request.url).searchParams.get('key') === 'test-server-key';
  assert.ok(keyInHeader || keyInUrl);
  assert.equal(result.lineExplanations[0].explanation, 'Dose: 10 ml per acre.');
  assert.equal(result.lineExplanations[1].explanation, 'Warning: Harmful if swallowed.');
  assert.deepEqual(result.missingOrUnclear, ['Waiting period not found.']);
  assert.ok(result.warnings.includes('Warning: Harmful if swallowed.'));
});

test('Gemini research prompt is limited to Tavily evidence and supplies citation markers', async () => {
  let request;
  const fetch = async (url, options) => {
    request = { url: String(url), body: JSON.parse(options.body) };
    const generated = { summary: 'A source lists the product [S1].' };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] }, finishReason: 'STOP' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const products = [{ title: 'Label source', url: 'https://example.gov.in/label', sourceClass: 'government-domain', snippet: 'Label text', fields: {}, sourceContent: 'Retrieved raw label content.' }];
  const summary = await summarizeSearchWithGemini({ query: 'Crop product', products, labelText: 'Private label text must not reach research Gemini', comparisons: [{ private: true }] }, { GEMINI_API_KEY: 'server-key', GEMINI_TEST_FETCH: fetch });
  assert.match(summary, /\[S1\]/);
  assert.match(JSON.stringify(request.body.contents), /Retrieved raw label content/);
  assert.doesNotMatch(JSON.stringify(request.body.contents), /search the web|use your knowledge/i);
  assert.doesNotMatch(JSON.stringify(request.body.contents), /Private label text|private/i);
});

test('Gemini research withholds generated safety or unsupported numeric claims but keeps source links', async () => {
  const fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'Apply 5 ml per acre [S1].' }) }] }, finishReason: 'STOP' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  const products = [{ title: 'Label source', url: 'https://example.gov.in/label', sourceClass: 'government-domain', snippet: 'Label text', fields: {}, sourceContent: 'Retrieved raw label content.' }];
  const summary = await summarizeSearchWithGemini({ query: 'Crop product', products }, { GEMINI_API_KEY: 'server-key', GEMINI_TEST_FETCH: fetch });
  assert.match(summary, /Unable to safely summarize/);
  assert.match(summary, /Retrieved sources: \[S1\]/);
  assert.doesNotMatch(summary, /5 ml per acre/);
});

test('Gemini research withholds generated protective and warning instructions', async () => {
  const products = [{ title: 'Label source', url: 'https://example.gov.in/label', sourceClass: 'government-domain', snippet: 'Label text', fields: {}, sourceContent: 'Retrieved raw label content.' }];
  for (const unsafeSummary of ['Wear protective gloves [S1].', 'The product is registered [S1].', 'Keep containers away from children [S1].']) {
    const fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: unsafeSummary }) }] }, finishReason: 'STOP' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    const summary = await summarizeSearchWithGemini({ query: 'Crop product', products }, { GEMINI_API_KEY: 'server-key', GEMINI_TEST_FETCH: fetch });
    assert.match(summary, /Unable to safely summarize/);
    assert.match(summary, /Retrieved sources: \[S1\]/);
    assert.doesNotMatch(summary, /protective gloves|registered|away from children/i);
  }
});

test('Gemini retries once when it returns invalid structured JSON', async () => {
  let attempts = 0;
  const fetch = async () => {
    attempts += 1;
    const text = attempts === 1 ? 'not JSON' : JSON.stringify({ lineExplanations: [{ id: 'line-0', explanation: 'A stated label fact.' }], missingOrUnclear: [] });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await explainLabelWithGemini({ labelText: 'Active ingredient: Chlorpyrifos.', language: 'English' }, { GEMINI_API_KEY: 'server-key', GEMINI_TEST_FETCH: fetch });
  assert.equal(attempts, 2);
  assert.equal(result.lineExplanations[0].explanation, 'A stated label fact.');
});
