import React, { useRef, useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3-zoom';
import { select } from 'd3-selection';
import { GraphManager } from '../services/graphManager';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 58;
const ROW_GAP = 130;
const NODE_X_GAP = 40;

// Helper to translate numbers into traditional Roman Numerals for a scriptural vibe
function toRoman(num) {
  const map = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let str = '';
  for (let i in map) {
    while (num >= map[i]) {
      str += i;
      num -= map[i];
    }
  }
  return str;
}

// ── Tree Layout Helpers (Unchanged Logic) ──
function buildStrictTree(gm, rootId) {
  const tree = new Map();
  const descendants = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (descendants.has(id)) continue;
    descendants.add(id);
    const rel = gm.getRelations(id);
    if (rel) {
      for (const child of rel.children) stack.push(child);
    }
  }
  for (const n of gm.nodes) {
    if (!descendants.has(n.id)) continue;
    const rel = gm.getRelations(n.id);
    if (!rel || !rel.parents.length) continue;
    const validParent = rel.parents.find(p => descendants.has(p));
    if (validParent) {
      if (!tree.has(validParent)) tree.set(validParent, []);
      tree.get(validParent).push(n.id);
    }
  }
  return tree;
}

function computeWidth(id, tree, memo) {
  if (memo.has(id)) return memo.get(id);
  const children = tree.get(id) || [];
  if (!children.length) {
    memo.set(id, NODE_WIDTH);
    return NODE_WIDTH;
  }
  let w = 0;
  for (const c of children) w += computeWidth(c, tree, memo) + NODE_X_GAP;
  w -= NODE_X_GAP;
  const final = Math.max(w, NODE_WIDTH);
  memo.set(id, final);
  return final;
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
  pos.set(id, { x: x + width / 2 - NODE_WIDTH / 2, y });
}

function traceDescendants(rootId, tree) {
  const out = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    const children = tree.get(id) || [];
    for (const c of children) {
      if (!out.has(c)) { out.add(c); stack.push(c); }
    }
  }
  return out;
}

function buildGenerationRows(positions, nodeMap) {
  const byY = new Map();
  for (const [id, pos] of positions) {
    if (!byY.has(pos.y)) byY.set(pos.y, []);
    byY.get(pos.y).push({ id, x: pos.x });
  }
  const rows = [];
  const sortedYs = [...byY.keys()].sort((a, b) => a - b);
  sortedYs.forEach((y, idx) => {
    const entries = byY.get(y);
    const minX = Math.min(...entries.map(e => e.x));
    const maxX = Math.max(...entries.map(e => e.x)) + NODE_WIDTH;
    const years = entries
      .map(e => nodeMap.get(e.id)?.birth?.slice(0, 4))
      .filter(Boolean).map(Number).filter(n => !isNaN(n));

    let yearRange = null;
    if (years.length) {
      const minY = Math.min(...years);
      const maxY = Math.max(...years);
      const fmt = yr => yr < 0 ? `${Math.abs(yr)} BC` : `${yr} AD`;
      yearRange = minY === maxY ? fmt(minY) : `${fmt(minY)} – ${fmt(maxY)}`;
    }
    rows.push({ generation: idx + 1, y, minX, maxX, yearRange });
  });
  return rows;
}

export default function GenealogyGraph({
  graph,
  rootId = 'Q70899',
  highlightedId,
  focusId,
  onPersonClick
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const zoomRef = useRef(null);

  const [positions, setPositions] = useState(new Map());
  const [tree, setTree] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [hoveredGen, setHoveredGen] = useState(null);

  // Read current layout color scheme straight from the parent wrapper background
  const isDarkMode = document.body.style.background === 'rgb(26, 26, 22)' || document.body.style.background === '#1a1a16';

  const theme = {
    ink: isDarkMode ? '#e6dfd3' : '#3e3525',
    inkFaint: isDarkMode ? '#4a4435' : '#e3dac9',
    gold: '#b8860b',
    goldFaint: isDarkMode ? 'rgba(184,134,11,0.15)' : 'rgba(184,134,11,0.06)',
    cardBg: isDarkMode ? '#23201a' : '#fcf9f2',
    cardBorder: isDarkMode ? '#3d362a' : '#d5cbaf'
  };

  useEffect(() => {
    if (!graph?.nodes?.length) return;
    const gm = new GraphManager(graph.nodes, graph.edges);
    const t = buildStrictTree(gm, rootId);
    const pos = new Map();
    const memo = new Map();

    if (t.has(rootId)) {
      layout(rootId, t, pos, 0, 0, memo);
    } else {
      const allRoots = gm.getRoots();
      if (allRoots.length) {
        const fallbackRoot = allRoots[0].id;
        const t2 = buildStrictTree(gm, fallbackRoot);
        setTree(t2);
        layout(fallbackRoot, t2, pos, 0, 0, memo);
      } else {
        setTree(new Map());
        setPositions(new Map());
        return;
      }
    }
    setTree(t);
    setPositions(pos);
  }, [graph, rootId]);

  useEffect(() => {
    if (!svgRef.current || !positions.size) return;
    const svg = select(svgRef.current);
    const zoom = d3.zoom().scaleExtent([0.1, 2.5]).on('zoom', (e) => setTransform(e.transform));
    zoomRef.current = zoom;
    svg.call(zoom);

    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const rootPos = positions.get(rootId);
      if (rootPos) {
        const scale = 0.75;
        const tx = width / 2 - (rootPos.x + NODE_WIDTH / 2) * scale;
        const ty = height / 4 - rootPos.y * scale;
        svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }
    return () => svg.on('.zoom', null);
  }, [positions, rootId]);

  const pendingFocusRef = useRef(null);
  useEffect(() => {
    if (focusId) pendingFocusRef.current = focusId;
    if (!positions.size || !svgRef.current || !containerRef.current || !zoomRef.current) return;
    const idToFocus = pendingFocusRef.current || focusId;
    if (!idToFocus) return;
    const pos = positions.get(idToFocus);
    if (!pos) { pendingFocusRef.current = null; return; }

    const timer = setTimeout(() => {
      const svg = select(svgRef.current);
      const scale = 1.2;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const tx = width / 2 - (pos.x + NODE_WIDTH / 2) * scale;
      const ty = height / 3 - pos.y * scale;
      svg.transition().duration(600).call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      );
      pendingFocusRef.current = null;
    }, 50);
    return () => clearTimeout(timer);
  }, [focusId, positions]);

  const nodeMap = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph.nodes]);
  const generationRows = useMemo(() => (positions.size ? buildGenerationRows(positions, nodeMap) : []), [positions, nodeMap]);

  if (!positions.size || !tree) {
    return (
      <div style={{ padding: 40, color: theme.ink, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
        Unfolding family branches…
      </div>
    );
  }

  const branchRootId = highlightedId || activeNode;
  const activeSet = branchRootId ? traceDescendants(branchRootId, tree) : null;

  // ── Generation Chronicles (Rows) ──
  const GEN_LABEL_WIDTH = 90;
  const GEN_LABEL_HEIGHT = 22;
  const GEN_LINE_PADDING = 60;

  const generationElements = generationRows.map(row => {
    const lineY = row.y + NODE_HEIGHT / 2;
    const x1 = row.minX - GEN_LINE_PADDING;
    const x2 = row.maxX + GEN_LINE_PADDING;
    const isHovered = hoveredGen === row.generation;
    const labelX = x1 - GEN_LABEL_WIDTH - 12;
    const labelY = lineY - GEN_LABEL_HEIGHT / 2;

    return (
      <g
        key={`gen-${row.generation}`}
        onMouseEnter={() => setHoveredGen(row.generation)}
        onMouseLeave={() => setHoveredGen(null)}
      >
        <rect x={x1} y={row.y - 15} width={x2 - x1} height={NODE_HEIGHT + 30} style={{ fill: 'transparent', cursor: 'default' }} />
        
        {/* Fine-line separators reminiscent of lined ledgers */}
        <line
          x1={x1} y1={lineY} x2={x2} y2={lineY}
          style={{
            stroke: isHovered ? theme.gold : theme.inkFaint,
            strokeWidth: isHovered ? 1.2 : 0.8,
            strokeDasharray: '3 4',
            transition: 'stroke 0.2s',
            pointerEvents: 'none',
          }}
        />

        {/* Minimalist text indicators instead of pill-shaped buttons */}
        <text
          x={labelX + GEN_LABEL_WIDTH / 2}
          y={labelY + GEN_LABEL_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: '0.72rem',
            fontFamily: 'Georgia, serif',
            fontWeight: 'bold',
            fontStyle: 'italic',
            fill: isHovered ? theme.gold : theme.ink,
            opacity: isHovered ? 1 : 0.65,
            transition: 'fill 0.2s',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {`Gen ${toRoman(row.generation)}`}
        </text>

        {row.yearRange && (
          <text
            x={labelX + GEN_LABEL_WIDTH / 2}
            y={labelY + GEN_LABEL_HEIGHT + 8}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: '0.62rem',
              fontFamily: 'Georgia, serif',
              fill: isHovered ? theme.gold : theme.ink,
              opacity: isHovered ? 0.9 : 0.4,
              transition: 'all 0.2s',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            {row.yearRange}
          </text>
        )}
      </g>
    );
  });

  // ── Lineage Links (Edges) ──
  const edgeElements = [];
  for (const e of graph.edges) {
    const a = positions.get(e.from);
    const b = positions.get(e.to);
    if (!a || !b) continue;
    
    const isActive = !activeSet || activeSet.has(e.to) || e.to === branchRootId || e.from === branchRootId;
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
          stroke: isActive ? theme.gold : theme.ink,
          strokeWidth: isActive ? 2 : 0.6,
          opacity: activeSet && !isActive ? 0.08 : isActive ? 1 : 0.25,
          fill: 'none',
          transition: 'stroke-width 0.2s, opacity 0.2s'
        }}
      />
    );
  }

  // ── Historical Inscriptions (Nodes) ──
  const nodeElements = [];
  for (const n of graph.nodes) {
    const p = positions.get(n.id);
    if (!p) continue;

    const isRoot = n.id === rootId;
    const isHighlighted = n.id === branchRootId || (activeSet && activeSet.has(n.id));
    const opacityVal = !activeSet || n.id === branchRootId || activeSet.has(n.id) ? 1 : 0.15;

    nodeElements.push(
      <g
        key={n.id}
        transform={`translate(${p.x},${p.y})`}
        onClick={() => {
          setActiveNode(n.id);
          if (onPersonClick) onPersonClick(n.id);
        }}
        style={{ cursor: 'pointer' }}
      >
        {/* Simple square block akin to a manuscript box or stamp entry */}
        <rect
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          style={{
            fill: isHighlighted ? theme.goldFaint : theme.cardBg,
            opacity: opacityVal,
            stroke: isHighlighted ? theme.gold : isRoot ? theme.gold : theme.cardBorder,
            strokeWidth: isHighlighted ? 2 : isRoot ? 1.5 : 1,
            transition: 'fill 0.2s, stroke 0.2s, opacity 0.2s'
          }}
        />
        
        {/* Core name label */}
        <text
          x={NODE_WIDTH / 2} y={26}
          textAnchor="middle" 
          style={{ 
            fontSize: '0.82rem', 
            fontFamily: 'Georgia, serif', 
            fontWeight: isRoot || isHighlighted ? 'bold' : 'normal',
            fill: theme.ink,
            opacity: opacityVal
          }}
        >
          {n.name}
        </text>

        {/* Life timeline subtitle */}
        <text
          x={NODE_WIDTH / 2} y={44}
          textAnchor="middle" 
          style={{ 
            fontSize: '0.68rem', 
            fontFamily: 'Georgia, serif', 
            fontStyle: 'italic',
            fill: theme.ink,
            opacity: opacityVal * 0.55
          }}
        >
          {n.birth?.slice(0, 4)}{n.birth && n.death ? '–' : ''}{n.death?.slice(0, 4)}
        </text>
      </g>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }}>
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {generationElements}
          {edgeElements}
          {nodeElements}
        </g>
      </svg>
    </div>
  );
}