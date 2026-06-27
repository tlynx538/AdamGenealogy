import React, { useState, useEffect, useCallback } from 'react';
import GenealogyGraph from './components/GenealogyGraph';
import PersonCard from './components/PersonCard';
import { GenealogyLoader } from './services/loader';
import { GraphManager } from './services/graphManager'; // 🧠 ADDED: Required for relationship searches

function App() {
  const [graph, setGraph]           = useState({ nodes: [], edges: [] });
  const [loading, setLoading]       = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Loading genealogy…');
  const [error, setError]           = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [collapsed, setCollapsed]   = useState(new Set());
  const [darkMode, setDarkMode]     = useState(true);
  const [focusId, setFocusId]       = useState(null);

  // ── Load data ──
  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    const loader = new GenealogyLoader();
    loader.setStatusCallback((msg, isError) => {
      setLoadingMsg(msg);
      if (isError) setError(msg);
    });

    if (forceRefresh) {
      await loader.clearCache();
    }

    try {
      // ✅ Pass the refresh flag to the loader
      const data = await loader.load(forceRefresh);
      if (data.error) {
        setError(data.error);
      } else if (data.nodes?.length) {
        setGraph(data);
        setCollapsed(new Set());  // reset collapse state on reload
        console.log(`✅ Loaded ${data.nodes.length} people`);
      } else {
        setError('No data loaded. Check your internet connection.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { loadData(false); }, [loadData]);

  // ── Search ──
  const handleSearch = useCallback(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term || !graph.nodes.length) return;

    const match = graph.nodes.find(n =>
      n.name.toLowerCase().includes(term)
    );

    if (!match) {
      setHighlightedId(null);
      setFocusId(null);
      return;
    }

    setHighlightedId(match.id);
    setSelectedId(match.id);
    setFocusId(match.id); // 🔥 NEW
  }, [searchTerm, graph]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setHighlightedId(null);
  }, []);

  const toggleDark = () => {
    setDarkMode(d => {
      document.body.style.background = d ? '#f0f0f0' : '#0e1520';
      document.body.style.color      = d ? '#222' : '#eee';
      return !d;
    });
  };

  const selectedPerson = selectedId ? graph.nodes.find(n => n.id === selectedId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#121e2c', padding: '8px 16px',
        borderBottom: '1px solid #2a3a4a',
        flexShrink: 0, gap: 12, flexWrap: 'wrap', zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.3rem' }}>📜</span>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.03em' }}>
            Biblical Genealogy
          </h1>
          <span style={{ fontSize: '0.8rem', color: '#7799aa' }}>
            {graph.nodes.length ? `${graph.nodes.length} people` : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 460 }}>
          <input
            type="text"
            placeholder="Search a person… (Enter)"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{
              flex: 1, padding: '6px 14px',
              borderRadius: 20, border: '1px solid #334',
              background: '#1a2535', color: '#ddeeff',
              outline: 'none', fontSize: '0.88rem',
            }}
          />
          <Btn onClick={handleSearch}>🔍</Btn>
          <Btn onClick={clearSearch}>✕</Btn>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <Btn onClick={() => loadData(true)} title="Refresh from Wikidata">⟳ Refresh</Btn>
          <Btn onClick={toggleDark} title="Toggle theme">{darkMode ? '☀️' : '🌙'}</Btn>
        </div>
      </div>

      {/* Graph area */}
      <div style={{ flex: 1, position: 'relative', background: '#0e1520' }}>
        {loading ? (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(14,21,32,0.93)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', zIndex: 10,
          }}>
            <div className="loader-spinner" />
            <p style={{ marginTop: 16, color: '#7799aa', fontSize: '0.95rem' }}>{loadingMsg}</p>
            {error && <p style={{ color: '#ff6b6b', marginTop: 8, fontSize: '0.88rem' }}>⚠️ {error}</p>}
          </div>
        ) : error && !graph.nodes.length ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <p style={{ color: '#ff6b6b' }}>⚠️ {error}</p>
            <Btn onClick={() => loadData(true)}>Retry</Btn>
          </div>
        ) : (
          <GenealogyGraph
            graph={graph}
            highlightedId={highlightedId}
            focusId={focusId}   // 🔥 NEW
            onPersonClick={setSelectedId}
          />
        )}

        {/* 🛡️ STATE REPAIR: Change target mutation parameter from constant descriptor to state hook */}
        <PersonCard 
          person={selectedPerson} 
          graph={graph} 
          onClose={() => setSelectedId(null)} 
        />

        {/* Legend */}
        {!loading && (
          <div style={{
            position: 'absolute', bottom: 14,
            left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(18,30,44,0.88)',
            backdropFilter: 'blur(6px)',
            padding: '5px 22px', borderRadius: 30,
            fontSize: '0.73rem', color: '#7799aa',
            border: '1px solid #2a3a4a',
            display: 'flex', gap: 18, whiteSpace: 'nowrap',
            pointerEvents: 'none', zIndex: 5,
          }}>
            <span>🟡 Adam &nbsp;|&nbsp; <span style={{ color: '#cc8800' }}>▬</span> ancestor &nbsp;|&nbsp; <span style={{ color: '#00cc88' }}>▬</span> descendant</span>
            <span>Click a person · Scroll = zoom · Drag = pan</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Tiny reusable button
function Btn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: '#1a2535', border: '1px solid #334', color: '#aaccdd',
      borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
      fontSize: '0.87rem', transition: 'background 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = '#243040'}
      onMouseLeave={e => e.currentTarget.style.background = '#1a2535'}
    >
      {children}
    </button>
  );
}

export default App;