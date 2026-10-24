import { compareFields, extractLabelFields, publicProduct, sourceRecord, FIELD_LABELS } from './domain.mjs';

export class ApiError extends Error {
  constructor(message, status = 500, code = 'internal_error') { super(message); this.status = status; this.code = code; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  } });
}

function fail(error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
  const code = typeof error?.code === 'string' ? error.code : 'internal_error';
  const message = status >= 500 && status < 600 && code === 'internal_error' ? 'The server could not complete this request.' : String(error?.message || 'The request failed.');
  if (status >= 500) console.warn(JSON.stringify({ event: 'api_failure', status, code }));
  return json({ error: { code, message } }, status);
}

async function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '')) throw new ApiError('Content-Type must be application/json.', 415, 'unsupported_media_type');
  const length = Number(req.headers.get('content-length') || 0);
  if (length > 20000) throw new ApiError('Request body is too large.', 413, 'payload_too_large');
  let raw;
  try { raw = await req.text(); } catch { throw new ApiError('Request body must be readable JSON.', 400, 'invalid_json'); }
  if (new TextEncoder().encode(raw).byteLength > 20000) throw new ApiError('Request body is too large.', 413, 'payload_too_large');
  let value;
  try { value = JSON.parse(raw); } catch { throw new ApiError('Request body must be valid JSON.', 400, 'invalid_json'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('Request body must be a JSON object.', 400, 'invalid_json');
  return value;
}

function requiredText(value, name, max) {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(`${name} is required.`, 400, 'validation_error');
  if (value.length > max) throw new ApiError(`${name} must be ${max} characters or fewer.`, 400, 'validation_error');
  return value.trim();
}

const LANGUAGES = { en: 'English', hi: 'Hindi', mr: 'Marathi', bn: 'Bengali', te: 'Telugu', ta: 'Tamil', kn: 'Kannada', gu: 'Gujarati', pa: 'Punjabi' };

export function createHandlers({ searchProvider, explainWithGemini, summarizeWithGemini, store }) {
  async function findProducts(query) {
    const rawResults = await searchProvider(query);
    const retrievedAt = new Date().toISOString();
    const unique = new Map();
    for (const raw of rawResults) {
      const record = sourceRecord(raw, query, retrievedAt);
      if (record && !unique.has(record.url)) unique.set(record.url, record);
    }
    return [...unique.values()].sort((a, b) => (a.sourceClass === b.sourceClass ? b.score - a.score : a.sourceClass === 'government-domain' ? -1 : 1)).slice(0, 8);
  }

  async function searchProducts(req) {
    if (req.method !== 'GET') return json({ error: { code: 'method_not_allowed', message: 'Use GET for product search.' } }, 405);
    try {
      const query = requiredText(new URL(req.url).searchParams.get('q'), 'q', 200);
      if (query.length < 2) throw new ApiError('q must be at least 2 characters.', 400, 'validation_error');
      const products = await findProducts(query);
      if (!products.length) return json({ query, products: [], summary: null, aiStatus: 'not-requested', message: 'No reliable match found. Unable to verify from available sources.' });
      await store?.upsert(products.map(publicProduct), query);
      let summary = null, aiStatus = 'unavailable', aiError = null;
      try { summary = await summarizeWithGemini({ query, products }); aiStatus = summary ? 'available' : 'unavailable'; }
      catch (error) { aiStatus = 'unavailable'; aiError = String(error?.message || 'Gemini summary is unavailable.'); }
      return json({ query, products: products.map(publicProduct), summary, aiStatus, aiError, retrievedAt: new Date().toISOString(), message: null });
    } catch (error) { return fail(error); }
  }

  async function explainLabel(req) {
    if (req.method !== 'POST') return json({ error: { code: 'method_not_allowed', message: 'Use POST for label explanation.' } }, 405);
    try {
      const input = await body(req);
      const labelText = requiredText(input.labelText, 'labelText', 12000);
      const language = LANGUAGES[input.language] || (Object.values(LANGUAGES).includes(input.language) ? input.language : null);
      if (!language) throw new ApiError('language must be one of the supported language codes: en, hi, mr, bn, te, ta, kn, gu, pa.', 400, 'validation_error');
      let segments = null;
      if (input.segments != null) {
        if (!Array.isArray(input.segments) || input.segments.length > 20 || input.segments.some((segment) => !segment || typeof segment.id !== 'string' || typeof segment.text !== 'string' || segment.text.length > 1200)) throw new ApiError('segments must contain up to 20 identified label lines.', 400, 'validation_error');
        if (input.segments.map((segment) => segment.text).join('\n') !== labelText) throw new ApiError('segments must exactly match labelText in order.', 400, 'validation_error');
        segments = input.segments;
      }
      const explanation = await explainWithGemini({ labelText, language, segments });
      return json(explanation);
    } catch (error) { return fail(error); }
  }

  async function analyzeLabel(req) {
    if (req.method !== 'POST') return json({ error: { code: 'method_not_allowed', message: 'Use POST for label analysis.' } }, 405);
    try {
      const input = await body(req);
      const labelText = requiredText(input.labelText, 'labelText', 12000);
      const language = input.language == null ? 'English' : (LANGUAGES[input.language] || (Object.values(LANGUAGES).includes(input.language) ? input.language : null));
      if (!language) throw new ApiError('language must be one of the supported language codes: en, hi, mr, bn, te, ta, kn, gu, pa.', 400, 'validation_error');
      const extractedFields = extractLabelFields(labelText);
      const searchTerm = extractedFields.productName?.value || extractedFields.activeIngredient?.value;
      if (!searchTerm) return json({
        extractedFields, products: [], comparisons: [], unverifiedFields: Object.values(FIELD_LABELS), summary: null,
        aiStatus: 'unavailable', message: 'No product name or active ingredient could be identified in the supplied text. Unable to verify from available sources.',
      });
      const products = await findProducts(searchTerm);
      const comparisons = products.map((product) => ({ productId: product.id, title: product.title, ...compareFields(extractedFields, product) }));
      const matchedProductIds = new Set(comparisons.filter((row) => row.identityStatus === 'sufficient-match').map((row) => row.productId));
      await store?.upsert(products.map(publicProduct), searchTerm);
      const found = new Set(comparisons.flatMap((row) => row.fields.filter((field) => field.status === 'match').map((field) => field.key)));
      const unverifiedFields = Object.keys(FIELD_LABELS).filter((key) => !extractedFields[key]?.value || !found.has(key)).map((key) => FIELD_LABELS[key]);
      let summary = null, aiStatus = 'unavailable', aiError = null;
      if (products.length) {
        try { summary = await summarizeWithGemini({ query: searchTerm, products, language }); aiStatus = summary ? 'available' : 'unavailable'; }
        catch (error) { aiStatus = 'unavailable'; aiError = String(error?.message || 'Gemini summary is unavailable.'); }
      }
      return json({
        query: searchTerm, extractedFields, products: products.map(publicProduct), comparisons, matchedProductIds: [...matchedProductIds],
        unverifiedFields, summary, aiStatus, aiError, retrievedAt: new Date().toISOString(),
        message: products.length ? null : 'No reliable match found. Unable to verify from available sources.',
      });
    } catch (error) { return fail(error); }
  }

  async function getProduct(req) {
    if (req.method !== 'GET') return json({ error: { code: 'method_not_allowed', message: 'Use GET to retrieve a product record.' } }, 405);
    try {
      const id = decodeURIComponent(new URL(req.url).pathname.split('/').filter(Boolean).pop() || '');
      if (!/^[a-f0-9]{24}$/.test(id)) throw new ApiError('Product id is invalid.', 400, 'validation_error');
      const product = await store?.get(id);
      if (!store?.enabled) throw new ApiError('Product record storage is available only in local development when KISANLENS_DEV_STORAGE=1. Configure a persistent database before enabling it in production.', 501, 'storage_not_configured');
      if (!product) throw new ApiError('Product record was not found in the development index.', 404, 'not_found');
      return json({ product, verificationStatus: 'source-linked-unverified' });
    } catch (error) { return fail(error); }
  }

  return { searchProducts, explainLabel, analyzeLabel, getProduct };
}
