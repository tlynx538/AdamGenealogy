import React, { useState, useEffect, useCallback } from 'react';
import GenealogyGraph from './components/GenealogyGraph';
import PersonCard from './components/PersonCard';
import { GenealogyLoader } from './services/loader';
import { GraphManager } from './services/graphManager';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

// Thematic Lineage tabs
const TABS = {
  ADAM: { id: 'adam', label: 'Adam to Noah', rootId: 'Q70899' },
  ABRAHAM: { id: 'abraham', label: 'Covenant of Abraham', rootId: 'Q9181' },
  ADNAN: { id: 'adnan', label: 'Line of Adnan', rootId: 'Q22338875' },
};

function App() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Unrolling the scrolls…');
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [darkMode, setDarkMode] = useState(false); // Default to warm parchment light mode
  const [focusId, setFocusId] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS.ADAM.id);
  const [showInfo, setShowInfo] = useState(false); // Controls the explanation overlay

  // ── Load data ──
  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    const loader = new GenealogyLoader();
    loader.setStatusCallback((msg, isError) => {
      setLoadingMsg(isError ? msg : 'Translating records…');
      if (isError) setError(msg);
    });
    try {
      const data = await loader.load(forceRefresh);
      if (data.error) {
        setError(data.error);
      } else if (data.nodes?.length) {
        setGraph(data);
        console.log(`📜 Loaded ${data.nodes.length} historical records.`);
      } else {
        setError('The archive is empty.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(false); }, [loadData]);

  // ── Build lineage map when graph loads ──
  const [lineageMap, setLineageMap] = useState(new Map());
  useEffect(() => {
    if (!graph.nodes.length) return;
    const gm = new GraphManager(graph.nodes, graph.edges);
    const roots = [TABS.ADAM.rootId, TABS.ABRAHAM.rootId, TABS.ADNAN.rootId];
    const map = gm.buildLineageMap(roots);
    setLineageMap(map);
  }, [graph]);

  const getRootForNode = useCallback((nodeId) => {
    if (!lineageMap.has(nodeId)) return TABS.ADAM.rootId;
    return lineageMap.get(nodeId);
  }, [lineageMap]);

  const handlePersonClick = useCallback((id) => {
    const rootId = getRootForNode(id);
    let tabId = TABS.ADAM.id;
    if (rootId === TABS.ABRAHAM.rootId) tabId = TABS.ABRAHAM.id;
    else if (rootId === TABS.ADNAN.rootId) tabId = TABS.ADNAN.id;

    setActiveTab(tabId);
    setSelectedId(id);
    setFocusId(id);
    setHighlightedId(id);
  }, [getRootForNode]);

  const handleSearch = useCallback(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term || !graph.nodes.length) return;
    const match = graph.nodes.find(n => n.name.toLowerCase().includes(term));
    if (!match) {
      setHighlightedId(null);
      setFocusId(null);
      return;
    }
    const rootId = getRootForNode(match.id);
    let tabId = TABS.ADAM.id;
    if (rootId === TABS.ABRAHAM.rootId) tabId = TABS.ABRAHAM.id;
    else if (rootId === TABS.ADNAN.rootId) tabId = TABS.ADNAN.id;
    setActiveTab(tabId);

    setHighlightedId(match.id);
    setSelectedId(match.id);
    setFocusId(match.id);
  }, [searchTerm, graph, getRootForNode]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setHighlightedId(null);
    setFocusId(null);
  }, []);

  const toggleDark = () => {
    setDarkMode(d => {
      document.body.style.background = d ? '#f4efe2' : '#1a1a16';
      document.body.style.color = d ? '#2c2519' : '#e6dfd3';
      return !d;
    });
  };

  const selectedPerson = selectedId ? graph.nodes.find(n => n.id === selectedId) : null;
  const currentRootId = activeTab === TABS.ADAM.id ? TABS.ADAM.rootId
    : activeTab === TABS.ABRAHAM.id ? TABS.ABRAHAM.rootId
    : TABS.ADNAN.rootId;

  const theme = {
    bgBar: darkMode ? '#26241e' : '#ede6d0',
    border: darkMode ? '#3d382e' : '#d2c5a7',
    text: darkMode ? '#e6dfd3' : '#3e3525',
    textMuted: darkMode ? '#a39882' : '#7c6f59',
    bgBtnActive: darkMode ? '#4a4231' : '#dfd4b6',
    bgBtn: darkMode ? '#2e2b24' : '#fcf9f2',
    accent: '#b8860b'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Georgia, serif' }}>
      
      {/* Top Header & Navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: theme.bgBar, padding: '10px 20px',
        borderBottom: `1px solid ${theme.border}`,
        flexShrink: 0, gap: 12, flexWrap: 'wrap', zIndex: 5,
      }}>
        
        {/* Title and Portfolio Anchor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.4rem', color: theme.accent }}>📜</span>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: theme.text, letterSpacing: '0.5px', margin: 0, lineHeight: 1.2 }}>
              Chronicles of Lineage
            </h1>
              <div style={{ fontSize: '0.72rem', color: theme.textMuted, marginTop: 1 }}>
                Built by{' '}
                <a
                  href="https://vjaiwantx.co"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: theme.accent,
                    textDecoration: 'none',
                    fontWeight: 'bold',
                  }}
                >
                  tlynx538
                </a>
              </div>
          </div>
        </div>

        {/* Biblical Eras */}
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.values(TABS).map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setFocusId(null);
                setHighlightedId(null);
              }}
              style={{
                background: activeTab === tab.id ? theme.bgBtnActive : theme.bgBtn,
                border: `1px solid ${theme.border}`,
                color: activeTab === tab.id ? theme.text : theme.textMuted,
                padding: '6px 14px',
                borderRadius: 2,
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Scripture */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 260 }}>
          <input
            type="text"
            placeholder="Search generations…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{
              flex: 1, padding: '5px 12px',
              borderRadius: 2, border: `1px solid ${theme.border}`,
              background: theme.bgBtn, color: theme.text,
              outline: 'none', fontSize: '0.85rem', fontFamily: 'inherit'
            }}
          />
          <Btn onClick={handleSearch} title="Execute Search" theme={theme}>🔍</Btn>
          <Btn onClick={clearSearch} title="Clear Search" theme={theme}>✕</Btn>
        </div>

        {/* System Settings, Help, and Codebase Triggers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Btn onClick={() => setShowInfo(!showInfo)} title="Explanatory Scroll" theme={theme}>❓</Btn>
          <Btn onClick={() => loadData(true)} title="Restore Records" theme={theme}>⟳</Btn>
          <Btn onClick={toggleDark} title="Toggle Canvas Shade" theme={theme}>{darkMode ? '📜' : '🕯️'}</Btn>
          
          <div style={{ width: 1, height: 20, background: theme.border, margin: '0 4px' }} />
          
          {/* GitHub Icon Action Button */}
          <a 
            href="https://github.com/tlynx538/AdamGenealogy" 
            target="_blank" 
            rel="noreferrer" 
            title="Open Repository Codebase"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: 30, 
              height: 30, 
              borderRadius: 2, 
              border: `1px solid ${theme.border}`, 
              background: theme.bgBtn, 
              color: theme.text,
              textDecoration: 'none'
            }}
            onMouseEnter={e => e.currentTarget.style.background = theme.bgBtnActive}
            onMouseLeave={e => e.currentTarget.style.background = theme.bgBtn}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.58-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div style={{ flex: 1, position: 'relative', background: darkMode ? '#1a1a16' : '#f4efe2' }}>
        
        {/* Descriptive Scriptural Explanation Panel Overlay */}
        {showInfo && (
          <div style={{
            position: 'absolute', inset: 0,
            background: darkMode ? 'rgba(26,26,22,0.98)' : 'rgba(252,249,242,0.98)',
            zIndex: 30, padding: '40px', overflowY: 'auto', color: theme.text,
            borderBottom: `1px solid ${theme.border}`
          }}>
            <div style={{ maxWidth: '720px', margin: '0 auto', lineHeight: 1.6 }}>
              <button 
                onClick={() => setShowInfo(false)}
                style={{
                  float: 'right', background: theme.bgBtn, border: `1px solid ${theme.border}`,
                  color: theme.text, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem'
                }}
              >
                Dismiss Scroll ✕
              </button>
              
              <h2 style={{ color: theme.accent, borderBottom: `1px solid ${theme.border}`, paddingBottom: '8px', fontSize: '1.5rem', marginTop: 0 }}>
                The Purpose of the Chronicle
              </h2>
              <p style={{ fontStyle: 'italic', fontSize: '1rem', color: theme.text, marginBottom: '24px' }}>
                This data-driven genealogy serves as an objective, historical roadmap across millennia. It provides an explicit, unfiltered guide detailing how Adam and Eve relate sequentially to Jesus, how Abraham's bloodlines diverge into ancestral channels toward Muhammad, and how successive generations span across complex historical timelines.
              </p>

              <h2 style={{ color: theme.accent, borderBottom: `1px solid ${theme.border}`, paddingBottom: '8px', fontSize: '1.25rem' }}>
                Technical Architecture & Graph Algorithmic Sequences
              </h2>
              <p style={{ fontSize: '0.9rem', color: theme.textMuted }}>
                To systematically resolve and position sprawling multi-generational structures without layout collisions, the engine builds upon robust graph traversal techniques combined with hierarchical post-order tree-packing sequences:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div style={{ padding: '12px', background: theme.bgBar, border: `1px solid ${theme.border}` }}>
                  <strong style={{ color: theme.accent }}>1. Lineage Mapping via Multi‑Source Breadth‑First Search (BFS)</strong>
                  <p style={{ fontSize: '0.85rem', margin: '4px 0 0 0', color: theme.text }}>
                    The <code>buildLineageMap(seedIds)</code> method runs independent, synchronous BFS traversals extending outward from designated primary roots (Adam, Abraham, Adnan) along child edges. By maintaining global distance vectors, the system isolates shortest paths and attributes every overlapping record to its nearest canonical patriarch. This ensures instant, contextual tab-switching whenever a lineage relative is tracked.
                  </p>
                </div>

                <div style={{ padding: '12px', background: theme.bgBar, border: `1px solid ${theme.border}` }}>
                  <strong style={{ color: theme.accent }}>2. Tree Extraction via Depth‑First Search (DFS) {`(buildStrictTree)`}</strong>
                  <p style={{ fontSize: '0.85rem', margin: '4px 0 0 0', color: theme.text }}>
                    Because intersecting multi-parent historical records disrupt uniform layout coordinates, the engine enforces structural isolation via two distinct operations:
                  </p>
                  <ul style={{ fontSize: '0.82rem', margin: '6px 0 0 0', paddingLeft: '20px', color: theme.text }}>
                    <li><strong>Descendant Collection:</strong> Traces down from the root ID using an iterative stack-based traversal (DFS) over edges to index all associated family relations within a unified target Set.</li>
                    <li><strong>Parent Selection:</strong> Inspects each registered member and filters out auxiliary linkages, resolving connections solely to the primary parent located inside that identical lineage Set. This transforms raw mesh records into a strict single-parent hierarchy.</li>
                  </ul>
                </div>

                <div style={{ padding: '12px', background: theme.bgBar, border: `1px solid ${theme.border}` }}>
                  <strong style={{ color: theme.accent }}>3. Bottom-Up Dimension Aggregation {`(computeWidth)`}</strong>
                  <p style={{ fontSize: '0.85rem', margin: '4px 0 0 0', color: theme.text }}>
                    Acts as the initial spatial compilation pass. The software recursively seeks out terminal childless leaf entities at the deepest generational tiers, computing total horizontal bounds ($X$-width) per branch. A standalone record registers a base node value, while a parent element scales dynamically based on the cumulative width and node gaps of its direct descendants.
                  </p>
                </div>

                <div style={{ padding: '12px', background: theme.bgBar, border: `1px solid ${theme.border}` }}>
                  <strong style={{ color: theme.accent }}>4. Top-Down Coordinate Placement via Reingold-Tilford Variant {`(layout)`}</strong>
                  <p style={{ fontSize: '0.85rem', margin: '4px 0 0 0', color: theme.text }}>
                    The final operation writes spatial layout vectors down the canvas viewport. It aligns individual lineage clusters cleanly from left to right, then centers each ancestor element precisely over its corresponding group utilizing the centering equation:
                  </p>
                    <div style={{ margin: '12px 0', textAlign: 'center' }}>
                      <BlockMath
                        math={
                          String.raw`
                          \text{Parent X}
                          =
                          x
                          +
                          \frac{\text{Total Branch Width}}{2}
                          -
                          \frac{\text{Node Width}}{2}
                          `
                        }
                      />
                    </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{
            position: 'absolute', inset: 0,
            background: darkMode ? 'rgba(26,26,22,0.95)' : 'rgba(244,239,226,0.95)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', zIndex: 10,
          }}>
            <p style={{ fontSize: '1.5rem', color: theme.accent }}>🕯️</p>
            <p style={{ marginTop: 12, color: theme.textMuted, fontStyle: 'italic' }}>{loadingMsg}</p>
            {error && <p style={{ color: '#a63a3a', marginTop: 8 }}>⚠️ {error}</p>}
          </div>
        ) : error && !graph.nodes.length ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <p style={{ color: '#a63a3a', fontStyle: 'italic' }}>⚠️ The record could not be unrolled: {error}</p>
            <Btn onClick={() => loadData(true)} theme={theme}>Retry</Btn>
          </div>
        ) : (
          <>
            <GenealogyGraph
              graph={graph}
              rootId={currentRootId}
              highlightedId={highlightedId}
              focusId={focusId}
              onPersonClick={handlePersonClick}
            />

            <PersonCard
              person={selectedPerson}
              graph={graph}
              onClose={() => {
                setSelectedId(null);
                setHighlightedId(null);
              }}
              onPersonClick={handlePersonClick}
            />

            {/* Simplistic Map Controls Legend */}
            <div style={{
              position: 'absolute', bottom: 16,
              left: '50%', transform: 'translateX(-50%)',
              background: theme.bgBar,
              padding: '6px 20px', borderRadius: 2,
              fontSize: '0.75rem', color: theme.textMuted,
              border: `1px solid ${theme.border}`,
              display: 'flex', gap: 18, whiteSpace: 'nowrap',
              pointerEvents: 'none', zIndex: 5, boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
            }}>
              <span><span style={{ color: theme.accent }}>●</span> Patriarch/Root</span>
              <span>Select name to follow generations</span>
            </div>

            {/* Transparent Wikidata Credit Badge Overlay */}
            <div style={{
              position: 'absolute', bottom: 16, right: 16,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', background: theme.bgBar,
              border: `1px solid ${theme.border}`, borderRadius: 2,
              fontSize: '0.72rem', color: theme.textMuted,
              zIndex: 5, opacity: 0.85
            }}>
              <svg viewBox="0 0 190 120" width="18" height="12" fill="currentColor" style={{ color: theme.textMuted }}>
                <path d="M0 0h20v120H0zm30 20h20v80H30zm30 10h20v60H60zm30 10h20v40H90zm30-10h20v60h-20zm30-10h20v80h-20zm30-10h20v120h-20z"/>
              </svg>
              <span>Data curated via <a href="https://www.wikidata.org" target="_blank" rel="noreferrer" style={{ color: theme.text, textDecoration: 'none', fontWeight: 'bold' }}>Wikidata</a></span>
            </div>

            {activeTab === 'adnan' && (
              <div style={{
                position: 'absolute', bottom: 16, left: 16, maxWidth: 300,
                background: theme.bgBar, padding: '12px', borderRadius: 2,
                fontSize: '0.72rem', color: theme.textMuted,
                border: `1px solid ${theme.border}`, lineHeight: 1.4,
                pointerEvents: 'none', zIndex: 5,
              }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ color: theme.accent }}>ℹ️</span>
                  <span>
                    <strong>Historical Note:</strong> Compiled via Wikidata records. Lineage extends back to Adnan. Intervening generations between Adnan and Ishmael/Kedar vary across traditional sources and lack a singular continuous link in the metadata framework.
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Reusable scriptural action button
function Btn({ children, onClick, title, theme }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: theme.bgBtn, border: `1px solid ${theme.border}`, color: theme.text,
      borderRadius: 2, padding: '4px 10px', cursor: 'pointer',
      fontSize: '0.85rem', transition: 'background 0.2s', fontFamily: 'inherit'
    }}
      onMouseEnter={e => e.currentTarget.style.background = theme.bgBtnActive}
      onMouseLeave={e => e.currentTarget.style.background = theme.bgBtn}
    >
      {children}
    </button>
  );
}

export default App;