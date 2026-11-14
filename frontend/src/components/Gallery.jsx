/**
 * components/Gallery.jsx
 * Personal photo gallery – displays photos saved during the treasure hunt.
 */

export default function Gallery({ photos }) {
  if (photos.length === 0) {
    return (
      <div className="gallery-empty">
        <span>🏞️</span>
        <p>Galeria ta este goală. Fă prima poză la o locație!</p>
      </div>
    );
  }

  return (
    <div className="gallery">
      <h3>🗂️ Galeria mea ({photos.length} poze)</h3>
      <div className="gallery-grid">
        {photos.map((photo) => (
          <div key={photo.id} className="gallery-item">
            <img src={photo.src} alt={photo.caption} />
            <div className="gallery-info">
              <p className="gallery-caption">{photo.caption}</p>
              <p className="gallery-meta">📍 {photo.location}</p>
              <p className="gallery-meta">🕐 {photo.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
