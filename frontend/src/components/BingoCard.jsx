import { useState } from 'react';
import './bingoCard.css';

/**
 * components/BingoCard.jsx
 * Cardul Bingo interactiv ce afișează locațiile traseului într-o grilă dinamică
 * cu bară de progres și stare vizitat/nevizitat.
 */
export default function BingoCard({
  tiles,
  locations,
  selectedId,
  onTileClick,
  onLocationSelect,
}) {
  const items = (tiles && tiles.length > 0) ? tiles : (locations || []);
  const handleClick = onTileClick || onLocationSelect;

  const done = items.filter((t) => t.visited).length;
  const total = items.length;

  return (
    <div className="bingo-card">
      <div className="bingo-progress">
        <div className="bingo-progress-text">{done}/{total}</div>
        <div className="bingo-progress-bar">
          <div
            className="bingo-progress-fill"
            style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="bingo-grid">
        {items.map((t, i) => (
          <button
            key={t.id || i}
            className={
              'bingo-tile' +
              (t.visited ? ' visited' : '') +
              (t.id === selectedId ? ' selected' : '')
            }
            onClick={() => handleClick && handleClick(t)}
            title={t.name}
          >
            <span className="tile-number">{i + 1}</span>
            <span className="tile-icon">{t.icon || t.emoji || '📍'}</span>
            <span className="tile-name">{t.name}</span>
            <span className="tile-state">{t.visited ? '✓ Bifat' : 'De vizitat'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
