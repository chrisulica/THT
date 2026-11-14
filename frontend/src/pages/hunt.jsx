// 

import { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapView from '../components/map';
import BingoCard from '../components/BingoCard';
import useUserPosition from '../components/useUserPosition';
import Camera from '../components/camera';
import { useAuth } from '../context/AuthContext.jsx';

// Pasul 5: Configurare mod demo și prag distanță
const DEMO_MODE = false; // Setează pe false pentru a cere prezența fizică pe stradă
const MAX_DISTANCE_METERS = 200; // Prag 200m

// Calculează distanța în metri între două coordonate GPS (Formula Haversine)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Raza Pământului în metri
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// MOCK: forma pe care o vei primi de la getActiveBingo() + locations.json
const mockTiles = [
  { id: 't1', location_id: 'piata-victoriei', visited: false },
  { id: 't2', location_id: 'piata-unirii', visited: true },
  { id: 't3', location_id: 'catedrala', visited: false },
  { id: 't4', location_id: 'parcul-rozelor', visited: false },
  { id: 't5', location_id: 'bastion', visited: false },
  { id: 't6', location_id: 'gara-nord', visited: false },
];

const mockLocations = {
  'piata-victoriei': { name: 'Piața Victoriei', icon: '🏛️', lat: 45.7537, lng: 21.2257,
    blurb: 'Inima orașului, cu Opera și Catedrala la capete. Aici începe orice plimbare prin Timișoara.' },
  'piata-unirii': { name: 'Piața Unirii', icon: '⛪', lat: 45.7580, lng: 21.2290,
    blurb: 'Piața colorată cu clădiri baroce. Perfectă pentru o cafea.' },
  'catedrala': { name: 'Catedrala Mitropolitană', icon: '🕍', lat: 45.7520, lng: 21.2240,
    blurb: 'Cea mai cunoscută clădire din oraș, cu acoperiș multicolor.' },
  'parcul-rozelor': { name: 'Parcul Rozelor', icon: '🌹', lat: 45.7510, lng: 21.2310,
    blurb: 'Un parc liniștit, plin de trandafiri vara.' },
  'bastion': { name: 'Bastionul Theresia', icon: '🧱', lat: 45.7570, lng: 21.2350,
    blurb: 'Ultimul bastion rămas din vechea fortăreață.' },
  'gara-nord': { name: 'Gara de Nord', icon: '🚉', lat: 45.7510, lng: 21.2080,
    blurb: 'Una dintre cele mai vechi gări din țară.' },
};

// unește tile-urile cu detaliile locației (suportă atât mock cât și locații generate din Quiz)
function buildPlaces(tiles) {
  return (tiles || []).map((t) => {
    const mock = mockLocations[t.location_id] || {};
    return {
      ...mock,
      ...t,
      id: t.id || t.location_id || String(Math.random()),
      name: t.name || mock.name || 'Obiectiv',
      icon: t.icon || t.emoji || mock.icon || '📍',
      lat: t.lat ?? t.coords?.lat ?? mock.lat ?? 45.7537,
      lng: t.lng ?? t.coords?.lng ?? mock.lng ?? 21.2257,
      blurb: t.blurb || t.description || mock.blurb || '',
      visited: Boolean(t.visited),
    };
  });
}

export default function Hunt() {
  const mapRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { position, error } = useUserPosition();

  const [tiles, setTiles] = useState(() => {
    // 1. Verifică starea primită prin navigare direct din Quiz
    const session = location.state?.huntSession;
    if (session?.dayLocations?.length > 0) {
      return session.dayLocations.map((loc, idx) => ({
        id: `loc-${loc.id ?? idx}`,
        location_id: loc.id,
        name: loc.name,
        icon: loc.emoji || loc.icon || '📍',
        lat: loc.coords?.lat ?? loc.lat,
        lng: loc.coords?.lng ?? loc.lng,
        blurb: loc.description || loc.blurb || '',
        visited: Boolean(session.visitedLocations?.includes(loc.id)),
      }));
    }

    // 2. Verifică tile-urile salvate în localStorage
    try {
      const savedTiles = JSON.parse(localStorage.getItem('tht_tiles'));
      if (Array.isArray(savedTiles) && savedTiles.length > 0) {
        return savedTiles;
      }
    } catch {}

    // 3. Verifică sesiunea salvată în localStorage
    try {
      const savedSession = JSON.parse(localStorage.getItem('tht_hunt_session'));
      if (savedSession?.dayLocations?.length > 0) {
        return savedSession.dayLocations.map((loc, idx) => ({
          id: `loc-${loc.id ?? idx}`,
          location_id: loc.id,
          name: loc.name,
          icon: loc.emoji || loc.icon || '📍',
          lat: loc.coords?.lat ?? loc.lat,
          lng: loc.coords?.lng ?? loc.lng,
          blurb: loc.description || loc.blurb || '',
          visited: Boolean(savedSession.visitedLocations?.includes(loc.id)),
        }));
      }
    } catch {}

    return mockTiles;
  });

  const [selectedId, setSelectedId] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  useEffect(() => {
    localStorage.setItem('tht_tiles', JSON.stringify(tiles));
  }, [tiles]);

  const places = buildPlaces(tiles);
  const selected = places.find((p) => p.id === selectedId);
  const isGameComplete = places.length > 0 && places.every((p) => p.visited);
  function selectPlace(p) {
    setGpsError(null);
    setSelectedId(p.id);
    mapRef.current?.flyToPlace(p);
  }

  // MOCK: va fi înlocuit cu markVisited din src/lib/api.js (Rolul 1)
  async function markVisitedMock(tileId, blob, coords) {
    await new Promise((r) => setTimeout(r, 800)); // simulează încărcarea
    console.log('markVisited', tileId, `${Math.round(blob.size / 1024)} KB`, coords);
  }

  async function handlePhoto(tile, blob) {
    setGpsError(null);
    const dist = getDistanceMeters(position.lat, position.lng, tile.lat, tile.lng);
    if (dist > MAX_DISTANCE_METERS) {
      const msg = `Ești la ${dist} m de ${tile.name}. Trebuie să fii la mai puțin de ${MAX_DISTANCE_METERS} m pentru a bifa!`;
      setGpsError(msg);
      throw new Error(msg); // 👈 Asigură-te că aruncă eroare ca să nu salveze poza!
    }
    // --- Pasul 5: Verificare GPS ---
    if (!DEMO_MODE) {
      if (!position) {
        setGpsError('Nu avem încă locația ta GPS. Asigură-te că ai activat locația.');
        return;
      }

      if (position.accuracy > 100) {
        setGpsError('Semnal GPS slab (acuratețe scăzută). Ieși afară sau așteaptă câteva secunde.');
        return;
      }

      const dist = getDistanceMeters(position.lat, position.lng, tile.lat, tile.lng);
      if (dist > MAX_DISTANCE_METERS) {
        setGpsError(`Ești la ${dist} m de ${tile.name}. Trebuie să fii la mai puțin de ${MAX_DISTANCE_METERS} m pentru a bifa!`);
        return;
      }
    }
    // --------------------------------

    const coords = position
      ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy }
      : null;
    await markVisitedMock(tile.id, blob, coords);
    // În handlePhoto din hunt.jsx:
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result;
      const existingPhotos = JSON.parse(localStorage.getItem('tht_photos') || '[]');
      existingPhotos.unshift({
        id: Date.now(),
        src: base64data,
        location: tile.name,
        caption: `Am vizitat ${tile.name}!`,
        timestamp: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
      });
      localStorage.setItem('tht_photos', JSON.stringify(existingPhotos));
    };
    reader.readAsDataURL(blob);
    setTiles((prev) => prev.map((t) => (t.id === tile.id ? { ...t, visited: true } : t)));
    setSelectedId(null);
  }

  return (
    <div style={{ height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      {/* Bară superioară: Navigare la Quiz și Ieșire din cont */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        right: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1000,
        pointerEvents: 'none'
      }}>
        <button
          type="button"
          onClick={() => navigate('/quiz')}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e0e0e0',
            borderRadius: '20px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#333',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🧭 Refă Quiz-ul
        </button>

        {logout && (
          <button
            type="button"
            onClick={logout}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #f5c6cb',
              borderRadius: '20px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#d93025',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Ieșire
          </button>
        )}
      </div>

      <MapView
        ref={mapRef}
        places={places}
        onPinClick={selectPlace}
        userPosition={position}
      />

      {error && <div className="gps-banner">Nu avem acces la locația ta.</div>}
      <button
        className="center-btn"
        disabled={!position}
        onClick={() => mapRef.current?.centerOnUser()}
      >
        {position ? '📍 Centrează-mă' : 'Caut locația…'}
      </button>

      {!selected && (
        <BingoCard tiles={places} selectedId={selectedId} onTileClick={selectPlace} />
      )}

      {selected && (
        <div className="place-panel">
          <div className="panel-head">
            <span className="panel-icon">{selected.icon}</span>
            <h2 className="panel-title">{selected.name}</h2>
            <button className="panel-close" onClick={() => setSelectedId(null)}>✕</button>
          </div>
          <p className="panel-blurb">{selected.blurb}</p>
          <div className="panel-actions">
            <a
              className="btn-nav"
              href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              🧭 Navighează
            </a>
            {selected.visited ? (
              <div className="panel-visited">✓ Ai bifat deja acest loc</div>
            ) : (
              <>
                <Camera onConfirm={(blob) => handlePhoto(selected, blob)} />
                {gpsError && (
                  <div style={{
                    color: '#d93025',
                    backgroundColor: '#fce8e6',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    textAlign: 'center',
                    fontWeight: '600'
                  }}>
                    ⚠️ {gpsError}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {isGameComplete && (
          <div style={{
            position: 'absolute',
            top: '20%',
            left: '16px',
            right: '16px',
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            zIndex: 2000
          }}>
            <h2 style={{ fontSize: '28px', margin: '0 0 8px 0' }}>🎉 BINGO! 🎉</h2>
            <p>Felicitări! Ai descoperit și fotografiat toate obiectivele din Timișoara!</p>
            <button
                style={{
                  marginTop: '16px',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2e9d5b',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  // Poți reseta traseul sau naviga la galerie
                  alert('Traseu completat!');
                }}
            >
              Ai terminat vânătoarea!
            </button>
          </div>
      )}
    </div>
  );
}