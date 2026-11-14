import './bingoCard.css';

export default function BingoCard({ tiles, selectedId, onTileClick }) {
  const done = tiles.filter((t) => t.visited).length;
  const total = tiles.length;

  return (
    <div className="bingo-card">
      <div className="bingo-progress">
        <div className="bingo-progress-text">{done}/{total}</div>
        <div className="bingo-progress-bar">
          <div
            className="bingo-progress-fill"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="bingo-grid">
        {tiles.map((t, i) => (
          <button
            key={t.id}
            className={
              'bingo-tile' +
              (t.visited ? ' visited' : '') +
              (t.id === selectedId ? ' selected' : '')
            }
            onClick={() => onTileClick(t)}
          >
            <span className="tile-number">{i + 1}</span>
            <span className="tile-icon">{t.icon}</span>
            <span className="tile-name">{t.name}</span>
            <span className="tile-state">{t.visited ? '✓ Bifat' : 'De vizitat'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}