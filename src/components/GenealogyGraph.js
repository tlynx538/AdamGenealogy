import React, { useRef, useState, useEffect } from 'react';
import * as d3 from 'd3-zoom';
import { select } from 'd3-selection';
import { GraphManager } from '../services/graphManager';
import PersonCard from './PersonCard'; // ✅ IMPORTANT ADDITION

const NODE_WIDTH = 135;
const NODE_HEIGHT = 56;
const ROW_GAP = 120;
const NODE_X_GAP = 50;


// ─────────────────────────────────────────────
// TREE HELPERS
// ─────────────────────────────────────────────
function pickPrimaryParent(gm, id) {
  const rel = gm.getRelations(id);
  if (!rel || !rel.parents.length) return null;
  return [...rel.parents].sort()[0];
}

function buildStrictTree(gm) {
  const tree = new Map();

  for (const n of gm.nodes) {
    const parent = pickPrimaryParent(gm, n.id);
    if (!parent) continue;

    if (!tree.has(parent)) tree.set(parent, []);
    tree.get(parent).push(n.id);
  }

  return tree;
}

function computeWidth(id, tree, memo) {
  if (memo.has(id)) return memo.get(id);

  const children = tree.get(id) || [];

  if (children.length === 0) {
    memo.set(id, NODE_WIDTH);
    return NODE_WIDTH;
  }

  let w = 0;
  for (const c of children) {
    w += computeWidth(c, tree, memo) + NODE_X_GAP;
  }

  w -= NODE_X_GAP;

  const finalWidth = Math.max(w, NODE_WIDTH);
  memo.set(id, finalWidth);
  return finalWidth;
}

function layout(id, tree, pos, x, y, memo) {
  const children = tree.get(id) || [];
  const width = computeWidth(id, tree, memo);

  let cx = x;

  for (const c of children) {
    const cw = computeWidth(c, tree, memo);
    layout(c, tree, pos, cx, y + ROW_GAP, memo);
    cx += cw + NODE_X_GAP;
  }

  pos.set(id, {
    x: x + width / 2 - NODE_WIDTH / 2,
    y
  });
}

function traceDescendants(rootId, tree) {
  const out = new Set();
  const stack = [rootId];

  while (stack.length) {
    const id = stack.pop();
    const children = tree.get(id) || [];

    for (const c of children) {
      if (!out.has(c)) {
        out.add(c);
        stack.push(c);
      }
    }
  }

  return out;
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export default function GenealogyGraph({
  graph,
  highlightedId,
  focusId, 
  onPersonClick,
  onForceReload
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  const [positions, setPositions] = useState(new Map());
  const [tree, setTree] = useState(null);
  const [gmState, setGmState] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });

  // build graph
  useEffect(() => {
    if (!graph?.nodes?.length) return;

    const gm = new GraphManager(graph.nodes, graph.edges);
    setGmState(gm);

    const t = buildStrictTree(gm);
    setTree(t);

    const ADAM = 'Q70899';

    const pos = new Map();
    const memo = new Map();

    layout(ADAM, t, pos, 0, 0, memo);

    setPositions(pos);
  }, [graph]);

  // toggle to person on search 
    useEffect(() => {
    if (!focusId || !positions.size || !svgRef.current || !containerRef.current) return;

    const pos = positions.get(focusId);
    if (!pos || !zoomRef.current) return;

    const svg = select(svgRef.current);

    const scale = 1.4;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const tx = width / 2 - (pos.x + NODE_WIDTH / 2) * scale;
    const ty = height / 3 - pos.y * scale;

    svg
        .transition()
        .duration(700)
        .call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
        );

    }, [focusId, positions]);

  const zoomRef = useRef(null);
  // zoom
    useEffect(() => {
    if (!svgRef.current || !positions.size) return;

    const svg = select(svgRef.current);

    const zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on('zoom', (e) => setTransform(e.transform));

    zoomRef.current = zoom; // 🔥 STORE IT

    svg.call(zoom);

    return () => svg.on('.zoom', null);
    }, [positions]);

  if (!positions.size || !tree) {
    return (
      <div style={{ padding: 40, color: '#7799aa', background: '#0e1520' }}>
        Building strict lineage tree…
      </div>
    );
  }

  const activeSet = activeNode ? traceDescendants(activeNode, tree) : null;

  const nodeMap = new Map(graph.nodes.map(n => [n.id, n])); // ✅ IMPORTANT

  // edges
  const edgeElements = [];

  for (const e of graph.edges) {
    const a = positions.get(e.from);
    const b = positions.get(e.to);
    if (!a || !b) continue;

    const isActive =
      !activeSet ||
      activeSet.has(e.to) ||
      e.to === activeNode ||
      e.from === activeNode;

    const x1 = a.x + NODE_WIDTH / 2;
    const y1 = a.y + NODE_HEIGHT;
    const x2 = b.x + NODE_WIDTH / 2;
    const y2 = b.y;

    const midY = y1 + (y2 - y1) * 0.5;

    edgeElements.push(
      <path
        key={`${e.from}-${e.to}`}
        d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
        style={{
          stroke: isActive ? '#f1c40f' : '#3b4e63',
          strokeWidth: isActive ? 2.4 : 1.1,
          opacity: activeSet && !isActive ? 0.12 : 1,
          fill: 'none'
        }}
      />
    );
  }

  // nodes
  const nodeElements = [];

  for (const n of graph.nodes) {
    const p = positions.get(n.id);
    if (!p) continue;

    const isRoot = n.id === 'Q70899';

    nodeElements.push(
      <g
        key={n.id}
        transform={`translate(${p.x},${p.y})`}
        onClick={() => setActiveNode(n.id)}
        style={{ cursor: 'pointer' }}
      >
        <rect
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          rx="6"
          style={{
            fill: '#111a24',
            stroke: n.id === activeNode ? '#f1c40f' : (isRoot ? '#e67e22' : '#2a3d50'),
            strokeWidth: n.id === activeNode ? 2.5 : 1
          }}
        />
        <text x={NODE_WIDTH / 2} y={28} textAnchor="middle" fill="#ecf0f1">
          {n.name}
        </text>
        <text x={NODE_WIDTH / 2} y={44} textAnchor="middle" fill="#7f8c8d">
          {n.birth?.slice(0, 4)}
          {n.birth && n.death ? '–' : ''}
          {n.death?.slice(0, 4)}
        </text>
      </g>
    );
  }

  const activePerson = activeNode ? nodeMap.get(activeNode) : null;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#0e1520',
        position: 'relative'
      }}
    >
      {/* ✅ YOUR EXISTING PERSON CARD */}
      <PersonCard
        person={activePerson}
        graph={graph}
        onClose={() => setActiveNode(null)}
      />

      <svg ref={svgRef} style={{ width: '100%', height: '100%' }}>
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {edgeElements}
          {nodeElements}
        </g>
      </svg>
    </div>
  );
}