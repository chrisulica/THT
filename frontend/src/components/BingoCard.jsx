/**
 * components/BingoCard.jsx
 * 5×5 BINGO grid. Stamps cells on click. Detects win (row/col/diagonal).
 */

import { useState, useEffect } from 'react';

const SIZE = 5;

export default function BingoCard({ locations = [], onLocationSelect }) {
  const [stamped, setStamped] = useState(new Set());
  const [winLines, setWinLines] = useState([]);

  // Auto-stamp FREE SPACE (index 12 = center)
  useEffect(() => {
    const freeIdx = locations.findIndex((l) => l.free);
    if (freeIdx !== -1) {
      setStamped(new Set([freeIdx]));
    }
  }, [locations]);

  function toggleStamp(idx) {
    if (locations[idx]?.free) return; // FREE SPACE always stamped
    const next = new Set(stamped);
    if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
    setStamped(next);
    checkWin(next);
    if (!stamped.has(idx) && onLocationSelect) {
      onLocationSelect(locations[idx]);
    }
  }

  function checkWin(s) {
    const lines = [];
    // Rows
    for (let r = 0; r < SIZE; r++) {
      const row = Array.from({ length: SIZE }, (_, c) => r * SIZE + c);
      if (row.every((i) => s.has(i))) lines.push(row);
    }
    // Cols
    for (let c = 0; c < SIZE; c++) {
      const col = Array.from({ length: SIZE }, (_, r) => r * SIZE + c);
      if (col.every((i) => s.has(i))) lines.push(col);
    }
    // Diagonals
    const d1 = Array.from({ length: SIZE }, (_, i) => i * SIZE + i);
    const d2 = Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i));
    if (d1.every((i) => s.has(i))) lines.push(d1);
    if (d2.every((i) => s.has(i))) lines.push(d2);
    setWinLines(lines);
  }

  const winSet = new Set(winLines.flat());

  const grid = locations.slice(0, SIZE * SIZE);

  return (
    <div className="bingo-wrapper">
      {winLines.length > 0 && (
        <div className="bingo-win-banner">
          🎉 BINGO! Ai completat {winLines.length} linie{winLines.length > 1 ? 'i' : ''}!
        </div>
      )}

      <div className="bingo-header-row">
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div key={letter} className="bingo-letter">{letter}</div>
        ))}
      </div>

      <div className="bingo-grid">
        {grid.map((loc, idx) => {
          const isStamped = stamped.has(idx);
          const isWin     = winSet.has(idx);
          const isFree    = loc.free;
          return (
            <button
              key={loc.id}
              className={[
                'bingo-cell',
                isStamped ? 'stamped' : '',
                isWin     ? 'win'     : '',
                isFree    ? 'free'    : '',
              ].join(' ')}
              onClick={() => toggleStamp(idx)}
              title={loc.name}
            >
              <span className="cell-emoji">{loc.emoji}</span>
              <span className="cell-name">{isFree ? 'FREE' : loc.name}</span>
              {isStamped && !isFree && <span className="stamp">✔</span>}
            </button>
          );
        })}
      </div>

      <p className="bingo-counter">
        {stamped.size} / {grid.length} locații vizitate
      </p>
    </div>
  );
}
