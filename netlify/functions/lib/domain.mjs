import { createHash } from 'node:crypto';

export const FIELD_LABELS = Object.freeze({
  productName: 'Product name', activeIngredient: 'Active ingredient', concentration: 'Concentration and formulation',
  manufacturer: 'Manufacturer', registrationNumber: 'Registration number',
});

const LABEL_PATTERNS = {
  productName: /(?:product|brand|trade)\s+name\s*[:\-]\s*([^\n\r|]{2,120})/i,
  activeIngredient: /(?:active\s+ingredient|composition|chemical\s+composition)\s*[:\-]\s*([^\n\r|]{2,180})/i,
  concentration: /(?:concentration|formulation|formulated\s+as)\s*[:\-]\s*([^\n\r|]{2,180})/i,
  manufacturer: /(?:manufactured\s+by|manufacturer|marketed\s+by|manufactured\s+and\s+marketed\s+by)\s*[:\-]\s*([^\n\r|]{2,180})/i,
  registrationNumber: /(?:registration\s*(?:no\.?|number|#)|cibrc\s*(?:no\.?|number|#))\s*[:\-]\s*([^\n\r|]{2,120})/i,
};

function captureField(text, pattern, label) {
  const match = pattern.exec(text);
  if (!match) return null;
  const value = match[1].trim().replace(/[.;,]+$/, '');
  return value ? { label, value } : null;
}

export function extractLabelFields(text) {
  return Object.fromEntries(Object.entries(LABEL_PATTERNS).map(([key, pattern]) => [key, captureField(text, pattern, FIELD_LABELS[key])]));
}

export function warningLines(text) {
  const cues = /\b(warning|caution|danger|poison|toxic|harmful|first aid|protective|gloves|mask|avoid contact|keep away|do not|restricted entry|waiting period|pre-harvest)\b/i;
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && cues.test(line)).slice(0, 20);
}

export function sourceProductFields(text) {
  const sourcePatterns = {
    productName: /(?:product|brand|trade)\s+name\s*[:\-]\s*([^\n\r|.;]{2,120})/i,
    activeIngredient: /(?:active\s+ingredient|composition|chemical\s+composition)\s*[:\-]\s*([^\n\r|.;]{2,180})/i,
    concentration: /(?:concentration|formulation|formulated\s+as)\s*[:\-]\s*([^\n\r|.;]{2,180})/i,
    manufacturer: /(?:manufactured\s+by|manufacturer|marketed\s+by|manufactured\s+and\s+marketed\s+by)\s*[:\-]\s*([^\n\r|.;]{2,180})/i,
    registrationNumber: /(?:registration\s*(?:no\.?|number|#)|cibrc\s*(?:no\.?|number|#))\s*[:\-]\s*([^\n\r|.;]{2,120})/i,
  };
  return Object.fromEntries(Object.entries(sourcePatterns).map(([key, pattern]) => [key, captureField(text, pattern, FIELD_LABELS[key])]));
}

export function normalized(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

export function compareFields(labelFields, product) {
  const comparisons = [];
  for (const key of Object.keys(FIELD_LABELS)) {
    const label = labelFields[key]?.value;
    const source = product.fields?.[key]?.value;
    if (!label || !source) continue;
    const a = normalized(label), b = normalized(source);
    comparisons.push({ key, label: FIELD_LABELS[key], labelValue: label, sourceValue: source, status: a === b || a.includes(b) || b.includes(a) ? 'match' : 'conflict' });
  }
  const nameMatch = comparisons.some((field) => field.key === 'productName' && field.status === 'match');
  const corroborating = comparisons.some((field) => field.key !== 'productName' && field.status === 'match');
  return { fields: comparisons, identityStatus: nameMatch && corroborating ? 'sufficient-match' : 'candidate-unconfirmed' };
}

export function sourceRecord(result, query, retrievedAt) {
  let url;
  try { url = new URL(result.url); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
  const domain = url.hostname.toLowerCase();
  const content = String(result.raw_content || result.content || '').slice(0, 12000);
  const title = String(result.title || domain).slice(0, 300);
  const id = createHash('sha256').update(url.toString()).digest('hex').slice(0, 24);
  const score = Number(result.score);
  return {
    id, title, url: url.toString(), domain, query, score: Number.isFinite(score) ? Math.max(0, Math.min(score, 1)) : 0,
    snippet: String(result.content || '').slice(0, 1600), fields: sourceProductFields(content),
    sourceClass: /\.(gov\.in|nic\.in)$/i.test(domain) ? 'government-domain' : 'web-result',
    verificationStatus: 'source-linked-unverified', retrievedAt,
    publishedAt: result.published_date || null,
    sourceContent: content,
  };
}

export function publicProduct(record) {
  const { sourceContent, ...safe } = record;
  return safe;
}
