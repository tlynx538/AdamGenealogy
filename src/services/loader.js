import { Utils } from '../utils';

export class GenealogyLoader {
  constructor() {
    this.onStatus = () => {};
    this.staticPath = '/data/genealogy-graph.json';
  }

  setStatusCallback(cb) {
    if (typeof cb === 'function') {
      this.onStatus = cb;
    }
  }

  // ─────────────────────────────────────────────
  // MAIN LOAD (STATIC ONLY)
  // ─────────────────────────────────────────────
  async load() {
    try {
      this.onStatus?.('⚡ Loading genealogy dataset...');

      const res = await fetch(this.staticPath, {
        cache: 'no-store' // 🔥 force no browser caching
      });

      if (!res.ok) {
        throw new Error(`Failed to load static file: ${res.status}`);
      }

      const graph = await res.json();

      this.onStatus?.(`✅ Loaded ${graph.nodes?.length || 0} nodes`);

      return graph;

    } catch (err) {
      console.error(err);
      this.onStatus?.('❌ Failed to load static dataset', true);

      return {
        nodes: [],
        edges: [],
        error: err.message
      };
    }
  }

  // optional but harmless (kept so your App doesn't break)
  async clearCache() {
    return true;
  }

  async saveToIndexedDB() {
    return;
  }

  async loadFromIndexedDB() {
    return null;
  }
}