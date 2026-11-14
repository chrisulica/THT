// 

import { useRef, useState, useEffect } from 'react';
import MapView from '../components/map';
import BingoCard from '../components/BingoCard';
import useUserPosition from '../components/useUserPosition';
import Camera from '../components/camera';

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

// unește tile-urile cu detaliile locației
function buildPlaces(tiles) {
  return tiles.map((t) => ({ ...t, ...mockLocations[t.location_id] }));
}

export default function Hunt() {
  const mapRef = useRef(null);
  const { position, error } = useUserPosition();
  const [tiles, setTiles] = useState(() => {
    const saved = localStorage.getItem('tht_tiles');
    return saved ? JSON.parse(saved) : mockTiles;
  });
  const [selectedId, setSelectedId] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  useEffect(() => {
    localStorage.setItem('tht_tiles', JSON.stringify(tiles));
  }, [tiles]);

  const places = buildPlaces(tiles);
  const selected = places.find((p) => p.id === selectedId);

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
    setTiles((prev) => prev.map((t) => (t.id === tile.id ? { ...t, visited: true } : t)));
    setSelectedId(null);
  }

  return (
    <div style={{ height: '100dvh', position: 'relative', overflow: 'hidden' }}>
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
    </div>
  );
}