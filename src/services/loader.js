import { Utils } from '../utils';

export class GenealogyLoader {
  constructor() {
    this.wikiApi = 'https://www.wikidata.org/w/api.php';
    this.dbName = 'GenealogyDB';
    this.dbVersion = 2;
    this.storeName = 'graph';
    this.MAX_PERSONS = 90000;
    this.MAX_DEPTH = 10; // Retained per instructions
    this.BATCH_SIZE = 50;

    this.seedQids = [
      'Q70899', 'Q109188', 'Q133861', 'Q178783', 'Q204899', 'Q9181',
      'Q35840', 'Q61034', 'Q104203', 'Q60236', 'Q254', 'Q37085',
      'Q302', 'Q9455', 'Q37471', 'Q152819', 'Q160148', 'Q157006',
      'Q189106', 'Q102127', 'Q154239', 'Q34817', 'Q194938',
      'Q42521', 'Q42844', 'Q34527', 'Q44072', 'Q124920'
    ];

    this.onStatus = (msg, isError) => {};
  }

  setStatusCallback(cb) {
    this.onStatus = cb;
  }

  async load(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = await this.loadFromIndexedDB();
      if (cached?.nodes?.length) {
        console.log('📦 Loaded from IndexedDB:', cached.nodes.length, 'nodes');
        this.onStatus(`Loaded ${cached.nodes.length} people from cache`);
        return cached;
      }
    }

    this.onStatus('🌐 Fetching sourced biblical lineages from Wikidata…');
    try {
      const raw = await this.fetchWikidata();
      const graph = this.buildGraph(raw);
      const filtered = this.filterToAdamComponent(graph);
      await this.saveToIndexedDB(filtered);
      this.onStatus(`✅ Loaded ${filtered.nodes.length} strictly connected biblical individuals`);
      return filtered;
    } catch (err) {
      console.error('Loader error:', err);
      this.onStatus('❌ ' + err.message, true);
      return { nodes: [], edges: [], error: err.message };
    }
  }

  loadFromIndexedDB() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, this.dbVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const get = store.get('graph');
          get.onsuccess = () => resolve(get.result || null);
          get.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }

  saveToIndexedDB(graph) {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, this.dbVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.put(graph, 'graph');
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        };
        req.onerror = () => resolve();
      } catch (e) { resolve(); }
    });
  }

  async clearCache() {
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(this.dbName);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  hasReference(claimPropertyArray) {
    if (!claimPropertyArray || !claimPropertyArray.length) return false;
    const primaryClaim = claimPropertyArray[0];
    return !!(primaryClaim.references && primaryClaim.references.length > 0);
  }

  async fetchWikidata() {
    const personMap = new Map();
    const queued = new Set(this.seedQids);
    const queue = this.seedQids.map(id => ({ id, depth: 0 }));

    const fetchBatch = async (ids) => {
      const url = `${this.wikiApi}?action=wbgetentities&ids=${ids.join('|')}&props=labels|descriptions|claims&languages=en&format=json&origin=*`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Wikidata API error: ${resp.status}`);
      const json = await resp.json();
      return json.entities || {};
    };

    while (queue.length > 0 && personMap.size < this.MAX_PERSONS) {
      const batch = queue.splice(0, this.BATCH_SIZE);
      const toFetch = batch
        .filter(item => !personMap.has(item.id) && item.depth <= this.MAX_DEPTH)
        .map(item => item.id);
      if (!toFetch.length) continue;

      const currentDepth = Math.min(...batch.map(b => b.depth));
      this.onStatus(`📡 ${personMap.size} persons · depth ${currentDepth} · ${queue.length} queued`);

      let entities;
      try {
        entities = await fetchBatch(toFetch);
      } catch (err) {
        console.warn('Batch fetch failed, skipping...', err);
        continue;
      }

      for (const [id, entity] of Object.entries(entities)) {
        if (!entity) continue;

        const description = entity.descriptions?.en?.value || '';
        const lowercaseDesc = description.toLowerCase();
        
        if (lowercaseDesc.includes('disambiguation') || lowercaseDesc.includes('character in hazbin hotel')) {
          continue;
        }

        const label = entity.labels?.en?.value || id;
        const image = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value || null;
        const gender = entity.claims?.P21?.[0]?.mainsnak?.datavalue?.value?.id || null;
        const birth = entity.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time || null;
        const death = entity.claims?.P570?.[0]?.mainsnak?.datavalue?.value?.time || null;

        // 🛡️ REPAIR: Read parental identities directly to avoid dropping biblical assignments
        const fatherClaim = entity.claims?.P22;
        const father = fatherClaim ? fatherClaim[0].mainsnak?.datavalue?.value?.id : null;

        const motherClaim = entity.claims?.P25;
        const mother = motherClaim ? motherClaim[0].mainsnak?.datavalue?.value?.id : null;

        const children = (entity.claims?.P40 || [])
          .map(c => c.mainsnak?.datavalue?.value?.id)
          .filter(Boolean);

        const cleanDate = (d) => d ? d.substring(0,10) : null;
        const depthItem = batch.find(item => item.id === id);
        const depth = depthItem ? depthItem.depth : 0;

        if (!personMap.has(id)) {
          personMap.set(id, {
            id,
            name: label,
            aliases: [],
            gender,
            birth: cleanDate(birth),
            death: cleanDate(death),
            father,
            mother,
            spouses: [], 
            children,
            religion: [],
            description,
            image,
            _sources: ['wikidata'],
            _depth: depth,
          });
        }

        const nextGenIds = [...children].filter(Boolean);
        if (this.seedQids.includes(id)) {
          if (father) nextGenIds.push(father);
          if (mother) nextGenIds.push(mother);
        }

        for (const nid of nextGenIds) {
          if (!personMap.has(nid) && !queued.has(nid)) {
            if (depth < this.MAX_DEPTH) {
              queued.add(nid);
              queue.push({ id: nid, depth: depth + 1 });
            }
          }
        }
      }
      await Utils.sleep(150);
    }

const nodes = Array.from(personMap.values());

const edges = [];
const edgeSet = new Set();

for (const n of nodes) {

  // Father is authoritative
  if (n.father && personMap.has(n.father)) {

    const key = `${n.father}->${n.id}`;

    if (!edgeSet.has(key)) {
      edgeSet.add(key);

      edges.push({
        from: n.father,
        to: n.id,
        type: 'father'
      });
    }
  }

  // Mother is authoritative
  if (n.mother && personMap.has(n.mother)) {

    const key = `${n.mother}->${n.id}`;

    if (!edgeSet.has(key)) {
      edgeSet.add(key);

      edges.push({
        from: n.mother,
        to: n.id,
        type: 'mother'
      });
    }
  }

  // IMPORTANT:
  // DO NOT create graph edges from P40 children.
  // P40 is kept only as metadata for the side panel.
}

return {
  nodes,
  edges
};
  }

  filterToAdamComponent(graph) {
    const { nodes, edges } = graph;
    const ADAM_ID = 'Q70899';

    const adj = new Map();
    for (const n of nodes) adj.set(n.id, new Set());
    for (const e of edges) {
      if (adj.has(e.from) && adj.has(e.to)) {
        adj.get(e.from).add(e.to);
        adj.get(e.to).add(e.from);
      }
    }

    const visited = new Set();
    const queue = [ADAM_ID];
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      const neighbors = adj.get(id) || new Set();
      for (const nid of neighbors) {
        if (!visited.has(nid)) queue.push(nid);
      }
    }

    if (!visited.size) return graph;
    return { nodes: nodes.filter(n => visited.has(n.id)), edges: edges.filter(e => visited.has(e.from) && visited.has(e.to)) };
  }

  buildGraph(data) {
    const { nodes, edges } = data;
    return {
      nodes: nodes.map(({ _depth, _sources, ...rest }) => ({ ...rest, sources: _sources || ['wikidata'] })),
      edges
    };
  }
}