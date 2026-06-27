import React from 'react';
import { GraphManager } from '../services/graphManager';

export default function PersonCard({ person, graph, onClose }) {
  if (!person) return null;

  // Initialize a safe, lightweight instance of GraphManager if it wasn't passed directly
  let gm = null;
  if (graph && graph.nodes && graph.edges) {
    gm = new GraphManager(graph.nodes, graph.edges);
  }

  // Fallback to check window if initialized elsewhere, but prioritize props
  if (!gm) {
    gm = window.graphManager;
  }

  // If both strategies fail, provide a clear diagnostic error card
  if (!gm) {
    return (
      <div style={{ position: 'absolute', top: 20, right: 20, width: 360, background: '#1e1e1e', borderRadius: 12, padding: 20, zIndex: 20, color: '#aaa', border: '1px solid #333' }}>
        Unable to access Graph Engine. Please verify the "graph" prop is provided.
      </div>
    );
  }

  const rel = gm.getRelations(person.id);
  const parents = rel?.parents?.map(id => gm.getPerson(id)).filter(Boolean) || [];
  const children = rel?.children?.map(id => gm.getPerson(id)).filter(Boolean) || [];
  
  // Safe extraction fallbacks for structural spouse properties
  const spouses = rel?.spouses?.map(id => gm.getPerson(id)).filter(Boolean) || [];
  const sourceTags = person.sources || ['wikidata'];

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: 20,
      width: 360,
      maxHeight: 'calc(100% - 100px)',
      background: '#111a24',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
      padding: '20px 20px 16px',
      overflowY: 'auto',
      zIndex: 20,
      border: '1px solid #2a3d50',
      color: '#fff',
      transition: 'opacity 0.2s, transform 0.2s'
    }}>
      <button
        onClick={onClose}
        style={{
          float: 'right',
          background: 'none',
          border: 'none',
          color: '#aaa',
          fontSize: '1.2rem',
          cursor: 'pointer',
          lineHeight: 1,
          padding: '0 4px'
        }}
      >
        ✕
      </button>

      <div style={{ marginTop: 4 }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: 6, color: '#fff', fontWeight: 600 }}>{person.name}</h2>

        {person.image && (
          <img
            src={person.image}
            alt={person.name}
            style={{
              width: '100%',
              maxHeight: 180,
              borderRadius: 8,
              margin: '8px 0',
              objectFit: 'contain',
              background: '#0e1520',
              border: '1px solid #2a3d50'
            }}
          />
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.85rem', color: '#bbb', margin: '8px 0' }}>
          {person.birth && <span>📅 Born: {person.birth}</span>}
          {person.death && <span>💀 Died: {person.death}</span>}
          {person.gender && <span>⚥ {person.gender === 'Q6581097' ? 'Male' : person.gender === 'Q6581072' ? 'Female' : 'Historical'}</span>}
        </div>

        <div style={{ margin: '8px 0' }}>
          {sourceTags.map(s => (
            <span
              key={s}
              style={{
                background: '#1c2836',
                padding: '2px 10px',
                borderRadius: 12,
                fontSize: '0.7rem',
                marginRight: 4,
                display: 'inline-block',
                color: '#7799aa',
                border: '1px solid #3b4e63'
              }}
            >
              {s}
            </span>
          ))}
        </div>

        {person.description && (
          <p style={{ margin: '12px 0', fontSize: '0.85rem', lineHeight: 1.4, color: '#b0c4de' }}>
            {person.description.length > 300
              ? person.description.substring(0, 300) + '…'
              : person.description}
          </p>
        )}

        {parents.length > 0 && (
          <>
            <div style={{ margin: '12px 0 4px', fontWeight: 600, color: '#e67e22', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              👪 Parents
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: '0.85rem' }}>
              {parents.map(p => (
                <span key={p.id} style={{ background: '#1c2836', padding: '3px 10px', borderRadius: 6, color: '#ecf0f1', border: '1px solid #2a3d50' }}>
                  {p.name}
                </span>
              ))}
            </div>
          </>
        )}

        {spouses.length > 0 && (
          <>
            <div style={{ margin: '12px 0 4px', fontWeight: 600, color: '#e67e22', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              💑 Spouses
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: '0.85rem' }}>
              {spouses.map(s => (
                <span key={s.id} style={{ background: '#1c2836', padding: '3px 10px', borderRadius: 6, color: '#ecf0f1', border: '1px solid #2a3d50' }}>
                  {s.name}
                </span>
              ))}
            </div>
          </>
        )}

        {children.length > 0 && (
          <>
            <div style={{ margin: '12px 0 4px', fontWeight: 600, color: '#e67e22', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              👶 Children
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: '0.85rem' }}>
              {children.map(c => (
                <span key={c.id} style={{ background: '#1c2836', padding: '3px 10px', borderRadius: 6, color: '#ecf0f1', border: '1px solid #2a3d50' }}>
                  {c.name}
                </span>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 16, pt: 8, borderTop: '1px solid #2a3d50', fontSize: '0.85rem' }}>
          <a
            href={`https://www.wikidata.org/wiki/${person.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#7799aa', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            🔗 View structural entry on Wikidata
          </a>
        </div>
      </div>
    </div>
  );
}