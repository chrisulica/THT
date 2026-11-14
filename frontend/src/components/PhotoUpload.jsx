/**
 * components/PhotoUpload.jsx
 * BeReal-style photo capture: file picker + camera capture.
 * Calls onPhotoAdded(photoObject) when a photo is confirmed.
 */

import { useRef, useState } from 'react';

export default function PhotoUpload({ selectedLocation, onPhotoAdded }) {
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  function confirmPhoto() {
    if (!preview) return;
    onPhotoAdded({
      id:         Date.now(),
      src:        preview,
      caption:    caption || selectedLocation?.name || 'Fără titlu',
      location:   selectedLocation?.name || 'Locație necunoscută',
      timestamp:  new Date().toLocaleString('ro-RO'),
    });
    setPreview(null);
    setCaption('');
    // Reset inputs
    if (fileInputRef.current)   fileInputRef.current.value   = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }

  function discard() {
    setPreview(null);
    setCaption('');
  }

  return (
    <div className="photo-upload">
      <h3>📸 Dovedește că ai fost acolo!</h3>
      {selectedLocation && (
        <p className="upload-hint">
          Locație selectată: <strong>{selectedLocation.name}</strong>
        </p>
      )}

      {!preview ? (
        <div className="upload-buttons">
          {/* File picker */}
          <button
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            🖼️ Alege din galerie
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFile}
          />

          {/* Camera capture */}
          <button
            className="btn-secondary"
            onClick={() => cameraInputRef.current?.click()}
          >
            📷 Fă o poză acum
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
        </div>
      ) : (
        <div className="preview-box">
          <img src={preview} alt="Preview" className="photo-preview" />
          <input
            type="text"
            placeholder="Adaugă o descriere..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="caption-input"
          />
          <div className="preview-actions">
            <button className="btn-primary" onClick={confirmPhoto}>
              ✅ Salvează poza
            </button>
            <button className="btn-ghost" onClick={discard}>
              ✕ Renunță
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
