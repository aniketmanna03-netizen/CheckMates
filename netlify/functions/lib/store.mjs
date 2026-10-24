import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class LocalProductStore {
  constructor({ enabled, filePath = path.resolve('.local-data/products.json') } = {}) {
    const localContext = process.env.CONTEXT === 'dev' || (!process.env.NETLIFY && process.env.NODE_ENV !== 'production');
    this.enabled = enabled ?? (process.env.KISANLENS_DEV_STORAGE === '1' && localContext);
    this.filePath = filePath;
  }

  async read() {
    try { return JSON.parse(await readFile(this.filePath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  }

  async upsert(products, searchQuery) {
    if (!this.enabled) return;
    const entries = await this.read();
    for (const product of products) entries[product.id] = { ...product, searchQuery, storedAt: new Date().toISOString() };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(entries, null, 2), { mode: 0o600 });
    await rename(temp, this.filePath);
  }

  async get(id) {
    if (!this.enabled) return null;
    const records = await this.read();
    return records[id] || null;
  }
}
