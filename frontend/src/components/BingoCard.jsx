import './bingoCard.css';

export default function BingoCard({
                                      // Acceptă atât formatul tău (tiles, onTileClick), cât și pe cel din MainPage (locations, onLocationSelect)
                                      tiles,
                                      locations,
                                      selectedId,
                                      onTileClick,
                                      onLocationSelect,
                                  }) {
    // 1. Preia lista indiferent cum a fost transmisă
    const rawItems = tiles || locations || [];
    const handleItemClick = onTileClick || onLocationSelect || (() => {});

    // 2. Normalizează fiecare element (suportă atât icon cât și emoji, atât visited cât și free)
    const normalizedTiles = rawItems.map((item) => ({
        ...item,
        id: item.id,
        name: item.name,
        icon: item.icon || item.emoji || '📍',
        visited: Boolean(item.visited || item.free),
    }));

    // 3. Calculează progresul (evităm împărțirea la 0 dacă lista e goală)
    const done = normalizedTiles.filter((t) => t.visited).length;
    const total = normalizedTiles.length;
    const progressPercent = total > 0 ? (done / total) * 100 : 0;

    return (
        <div className="bingo-card">
            <div className="bingo-progress">
                <div className="bingo-progress-text">{done}/{total}</div>
                <div className="bingo-progress-bar">
                    <div
                        className="bingo-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            <div className="bingo-grid">
                {normalizedTiles.map((t, i) => (
                    <button
                        key={t.id}
                        type="button"
                        className={
                            'bingo-tile' +
                            (t.visited ? ' visited' : '') +
                            (selectedId && t.id === selectedId ? ' selected' : '')
                        }
                        onClick={() => handleItemClick(t)}
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