export class GraphManager {
  constructor(nodes, edges) {
    this.nodes = nodes;
    this.edges = edges;
    this.nodeMap = new Map();
    this.adj = new Map();

    for (const n of nodes) {
      this.nodeMap.set(n.id, n);
      this.adj.set(n.id, { parents: [], children: [] });
    }

    for (const e of edges) {
      const from = e.from;
      const to = e.to;

      if (!this.adj.has(from)) this.adj.set(from, { parents: [], children: [] });
      if (!this.adj.has(to)) this.adj.set(to, { parents: [], children: [] });

      this.adj.get(from).children.push(to);
      this.adj.get(to).parents.push(from);
    }

    for (const rel of this.adj.values()) {
      rel.parents = [...new Set(rel.parents)];
      rel.children = [...new Set(rel.children)];
    }

    // NEW: lineage cache
    this.lineageMap = new Map();
  }

  getPerson(id) {
    return this.nodeMap.get(id);
  }

  getRelations(id) {
    return this.adj.get(id);
  }

  getRoots() {
    return this.nodes.filter(n => (this.adj.get(n.id)?.parents?.length ?? 0) === 0);
  }

    buildLineageMap(seedIds) {
    const map = new Map();
    const dist = new Map();

    // Initialize seeds
    for (const seed of seedIds) {
        map.set(seed, seed);
        dist.set(seed, 0);
    }

    // BFS from each seed independently
    for (const seed of seedIds) {
        const queue = [{ id: seed, d: 0 }];
        const visited = new Set();

        while (queue.length) {
        const { id, d } = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);

        // If this seed gives a shorter distance, update assignment
        if (!dist.has(id) || d < dist.get(id)) {
            dist.set(id, d);
            map.set(id, seed);
        } // else keep existing (closer or equal)

        const rel = this.adj.get(id);
        if (rel) {
            for (const child of rel.children) {
            if (!visited.has(child)) {
                queue.push({ id: child, d: d + 1 });
            }
            }
        }
        }
    }

    return map;
    }
}