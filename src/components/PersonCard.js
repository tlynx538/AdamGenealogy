import React from 'react';
import { GraphManager } from '../services/graphManager';

function getImageUrl(image) {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  return `https://commons.wikimedia.org/w/index.php?title=Special:FilePath/${encodeURIComponent(image)}`;
}

export default function PersonCard({ person, graph, onClose, onPersonClick }) {
  if (!person) return null;

  let gm = null;
  if (graph?.nodes?.length) {
    gm = new GraphManager(graph.nodes, graph.edges);
  }

  // Detect dark mode from body background (or fallback to a light theme)
  const bgColor = document.body.style.background || '#f4efe2';
  const isDarkMode = bgColor.includes('1a1a16') || bgColor.includes('#1a1a16') || bgColor === 'rgb(26, 26, 22)';

  const theme = {
    bg: isDarkMode ? '#23201a' : '#fcf9f2',
    border: isDarkMode ? '#3d362a' : '#d5cbaf',
    ink: isDarkMode ? '#e6dfd3' : '#3e3525',
    inkMuted: isDarkMode ? '#a39882' : '#6b5f4c',
    gold: '#b8860b',
    badgeBg: isDarkMode ? '#2e2a22' : '#f4efe2'
  };

  if (!gm) {
    return (
      <div style={{
        position: 'absolute', top: 20, right: 20, width: 350,
        background: theme.bg, padding: 20, zIndex: 20,
        color: theme.ink, border: `1px solid ${theme.border}`,
        fontFamily: 'Georgia, serif', fontStyle: 'italic'
      }}>
        The records engine is currently dormant.
      </div>
    );
  }

  const rel = gm.getRelations(person.id);
  const parents = rel?.parents?.map(id => gm.getPerson(id)).filter(Boolean) || [];
  const children = rel?.children?.map(id => gm.getPerson(id)).filter(Boolean) || [];
  const sourceTags = person.sources || ['archive'];
  const imageUrl = getImageUrl(person.image);

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: 20,
      width: 350,
      maxHeight: 'calc(100% - 80px)',
      background: theme.bg,
      border: `2px solid ${theme.border}`,
      padding: '20px',
      overflowY: 'auto',
      zIndex: 20,
      color: theme.ink,
      fontFamily: 'Georgia, serif',
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          float: 'right',
          background: 'none',
          border: 'none',
          color: theme.inkMuted,
          fontSize: '1rem',
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: 0
        }}
      >
        Dismiss
      </button>

      <div style={{ marginTop: 4 }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: 4, color: theme.ink, fontWeight: 'bold' }}>
          {person.name}
        </h2>

        {/* Image */}
        <div style={{
          width: '100%',
          background: theme.badgeBg,
          border: `1px solid ${theme.border}`,
          margin: '12px 0',
          overflow: 'hidden'
        }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={person.name}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                filter: isDarkMode ? 'sepia(0.2) contrast(0.9)' : 'sepia(0.15)'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                const parent = e.target.parentNode;
                const placeholder = document.createElement('div');
                placeholder.style.cssText = `
                  width: 100%;
                  min-height: 80px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: ${theme.inkMuted};
                  font-size: 0.8rem;
                  font-style: italic;
                  padding: 20px 0;
                `;
                placeholder.textContent = 'No illustration preserved';
                parent.appendChild(placeholder);
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              minHeight: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.inkMuted,
              fontSize: '0.8rem',
              fontStyle: 'italic',
              padding: '20px 0'
            }}>
              No illustration preserved
            </div>
          )}
        </div>

        {/* Vital stats */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: '0.82rem', color: theme.inkMuted, margin: '8px 0' }}>
          {person.birth && <span>Born: {person.birth.slice(0,4).replace('-', '')} {Number(person.birth.slice(0,4)) < 0 ? 'BC' : 'AD'}</span>}
          {person.death && <span>Died: {person.death.slice(0,4).replace('-', '')} {Number(person.death.slice(0,4)) < 0 ? 'BC' : 'AD'}</span>}
          {person.gender && (
            <span>Line: {person.gender === 'Q6581097' ? 'Patriarch' : person.gender === 'Q6581072' ? 'Matriarch' : 'Historical'}</span>
          )}
        </div>

        {/* Source badges */}
        <div style={{ margin: '8px 0' }}>
          {sourceTags.map(s => (
            <span
              key={s}
              style={{
                background: theme.badgeBg,
                padding: '2px 8px',
                border: `1px solid ${theme.border}`,
                fontSize: '0.68rem',
                marginRight: 6,
                display: 'inline-block',
                color: theme.inkMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {s}
            </span>
          ))}
        </div>

        {/* Description */}
        {person.description && (
          <p style={{ margin: '14px 0', fontSize: '0.85rem', lineHeight: 1.5, color: theme.ink, fontStyle: 'italic' }}>
            "{person.description.length > 260
              ? person.description.substring(0, 260) + '…'
              : person.description}"
          </p>
        )}

        {/* Parents – FIXED click handler */}
        {parents.length > 0 && (
          <>
            <div style={{ margin: '16px 0 6px', fontWeight: 'bold', color: theme.gold, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              📜 Begotten By
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 6px', fontSize: '0.85rem' }}>
              {parents.map(p => (
                <span
                  key={p.id}
                  onClick={() => onPersonClick?.(p.id)}  // <-- FIXED
                  style={{
                    background: theme.bg,
                    padding: '3px 8px',
                    border: `1px solid ${theme.border}`,
                    color: theme.ink,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.gold;
                    e.currentTarget.style.color = theme.gold;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.border;
                    e.currentTarget.style.color = theme.ink;
                  }}
                >
                  {p.name}
                </span>
              ))}
            </div>
          </>
        )}

        {/* Children */}
        {children.length > 0 && (
          <>
            <div style={{ margin: '16px 0 6px', fontWeight: 'bold', color: theme.gold, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              🌱 Begat (Offspring)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 6px', fontSize: '0.85rem' }}>
              {children.map(c => (
                <span
                  key={c.id}
                  onClick={() => onPersonClick?.(c.id)}
                  style={{
                    background: theme.bg,
                    padding: '3px 8px',
                    border: `1px solid ${theme.border}`,
                    color: theme.ink,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.gold;
                    e.currentTarget.style.color = theme.gold;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.border;
                    e.currentTarget.style.color = theme.ink;
                  }}
                >
                  {c.name}
                </span>
              ))}
            </div>
          </>
        )}

        {/* Wikidata link */}
        <div style={{ marginTop: 20, paddingTop: 10, borderTop: `1px solid ${theme.border}`, fontSize: '0.78rem' }}>
          <a
            href={`https://www.wikidata.org/wiki/${person.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: theme.gold, textDecoration: 'none', fontStyle: 'italic' }}
          >
            Examine structural scroll on Wikidata →
          </a>
        </div>
      </div>
    </div>
  );
}