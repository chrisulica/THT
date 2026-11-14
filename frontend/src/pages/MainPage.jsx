/**
 * pages/MainPage.jsx
 * Main screen: BINGO card + photo upload + gallery.
 */

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BingoCard    from '../components/BingoCard.jsx';
import PhotoUpload  from '../components/PhotoUpload.jsx';
import Gallery      from '../components/Gallery.jsx';

export default function MainPage() {
  const { user, logout } = useAuth();
  const { state }        = useLocation();
  const navigate         = useNavigate();

  const route    = state?.route;
  const locations = route?.locations || [];

  const [activeTab, setActiveTab]           = useState('bingo');  // 'bingo' | 'photo' | 'gallery'
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [photos, setPhotos]                 = useState([]);

  function handleLocationSelect(loc) {
    setSelectedLocation(loc);
  }

  function handlePhotoAdded(photo) {
    setPhotos((prev) => [photo, ...prev]);
    setActiveTab('gallery');
  }

  function goToPhoto() {
    setActiveTab('photo');
  }

  if (!route) {
    return (
      <div className="main-page center-msg">
        <p>Nu există un traseu generat.</p>
        <button className="btn-primary" onClick={() => navigate('/setup')}>
          ← Înapoi la Setup
        </button>
      </div>
    );
  }

  return (
    <div className="main-page">
      {/* ── Top Nav ── */}
      <header className="main-header">
        <div className="main-title">
          <span>🗺️</span>
          <h2>Treasure Hunt Timișoara</h2>
        </div>
        <div className="main-user">
          <span className="user-badge">👤 {user?.username}</span>
          <button className="link-btn logout-btn" onClick={logout}>Ieșire</button>
        </div>
      </header>

      {/* ── Tab Bar ── */}
      <nav className="tab-bar">
        <button
          className={activeTab === 'bingo'   ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('bingo')}
        >
          🎯 BINGO
        </button>
        <button
          className={activeTab === 'photo'   ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('photo')}
        >
          📸 Poze
          {selectedLocation && <span className="tab-badge">1</span>}
        </button>
        <button
          className={activeTab === 'gallery' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('gallery')}
        >
          🖼️ Galerie
          {photos.length > 0 && <span className="tab-badge">{photos.length}</span>}
        </button>
      </nav>

      {/* ── Content ── */}
      <main className="main-content">
        {activeTab === 'bingo' && (
          <div>
            {selectedLocation && (
              <div className="selected-location-banner">
                <span>{selectedLocation.emoji} Ai selectat: <strong>{selectedLocation.name}</strong></span>
                <button className="btn-secondary small" onClick={goToPhoto}>
                  📸 Fă o poză
                </button>
              </div>
            )}
            <BingoCard
              locations={locations}
              onLocationSelect={handleLocationSelect}
              selectedId={selectedLocation?.id}
            />
          </div>
        )}

        {activeTab === 'photo' && (
          <PhotoUpload
            selectedLocation={selectedLocation}
            onPhotoAdded={handlePhotoAdded}
          />
        )}

        {activeTab === 'gallery' && (
          <Gallery photos={photos} />
        )}
      </main>
    </div>
  );
}
