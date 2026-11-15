import { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapView from '../components/map';
import BingoCard from '../components/BingoCard';
import useUserPosition from '../components/useUserPosition';
import Camera from '../components/camera';
import FinalAlbumModal from '../components/FinalAlbumModal';
import { useAuth } from '../context/AuthContext.jsx';

const MAX_DISTANCE_METERS = 200; // Prag 200m pentru Modul Real

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

// 6 locații implicite pentru Timișoara (format 2x3 Bingo)
const mockTiles = [
  { id: 't1', location_id: 'piata-victoriei', visited: false },
  { id: 't2', location_id: 'piata-unirii', visited: false },
  { id: 't3', location_id: 'catedrala', visited: false },
  { id: 't4', location_id: 'parcul-rozelor', visited: false },
  { id: 't5', location_id: 'bastion', visited: false },
  { id: 't6', location_id: 'gara-nord', visited: false },
];

const mockLocations = {
  'piata-victoriei': {
    name: 'Piața Victoriei',
    icon: '🏛️',
    lat: 45.7537,
    lng: 21.2257,
    blurb: 'Inima orașului, cu Opera și Catedrala la capete. Aici începe orice plimbare prin Timișoara.',
  },
  'piata-unirii': {
    name: 'Piața Unirii',
    icon: '⛪',
    lat: 45.758,
    lng: 21.229,
    blurb: 'Piața colorată cu clădiri baroce spectaculoase. Perfectă pentru o cafea sau o fotografie.',
  },
  'catedrala': {
    name: 'Catedrala Mitropolitană',
    icon: '🕍',
    lat: 45.752,
    lng: 21.224,
    blurb: 'Cea mai cunoscută clădire din oraș, cu acoperiș multicolor din țigle smălțuite.',
  },
  'parcul-rozelor': {
    name: 'Parcul Rozelor',
    icon: '🌹',
    lat: 45.751,
    lng: 21.231,
    blurb: 'Un parc liniștit pe malul Begăi, plin de trandafiri și cu o scenă în aer liber.',
  },
  'bastion': {
    name: 'Bastionul Theresia',
    icon: '🧱',
    lat: 45.757,
    lng: 21.235,
    blurb: 'Ultimul bastion rămas din vechea cetate Vauban a Timișoarei, astăzi spațiu cultural.',
  },
  'gara-nord': {
    name: 'Gara de Nord',
    icon: '🚉',
    lat: 45.751,
    lng: 21.208,
    blurb: 'Poarta feroviară a orașului, cu o istorie bogată încă din secolul al XIX-lea.',
  },
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
  const { user, logout } = useAuth();
  const { position, error: gpsUnavailable } = useUserPosition();

  // Mod Demo vs Mod Real (toggle persistat în localStorage)
  const [demoMode, setDemoMode] = useState(() => {
    const saved = localStorage.getItem('tht_demo_mode');
    return saved !== null ? saved === 'true' : true; // Default Activ pentru prezentare/testare
  });

  // Stare pentru albumul foto final
  const [showAlbumModal, setShowAlbumModal] = useState(true);

  // Lista de fotografii capturate
  const [photos, setPhotos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tht_photos')) || [];
    } catch {
      return [];
    }
  });

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

  // Salvează tile-urile și progresul la orice modificare
  useEffect(() => {
    localStorage.setItem('tht_tiles', JSON.stringify(tiles));
  }, [tiles]);

  const places = buildPlaces(tiles);
  const selected = places.find((p) => p.id === selectedId);
  const isGameComplete = places.length > 0 && places.every((p) => p.visited);

  function toggleDemoMode() {
    setDemoMode((prev) => {
      const next = !prev;
      localStorage.setItem('tht_demo_mode', String(next));
      return next;
    });
    setGpsError(null);
  }

  function selectPlace(p) {
    setGpsError(null);
    setSelectedId(p.id);
    mapRef.current?.flyToPlace(p);
  }

  // Descarcă o poză salvată pentru monumentul bifat
  function downloadSavedPhoto(photoObj, placeName) {
    if (!photoObj?.src) return;
    const a = document.createElement('a');
    a.href = photoObj.src;
    a.download = `${placeName.replace(/\s+/g, '_')}_bereal.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handlePhoto(tile, blob) {
    setGpsError(null);

    // --- Verificare distanță GPS în funcție de Modul Demo ---
    if (!demoMode) {
      if (!position) {
        const msg = 'Nu avem încă locația ta GPS. Asigură-te că ai activat locația pe dispozitiv.';
        setGpsError(msg);
        throw new Error(msg);
      }

      const dist = getDistanceMeters(position.lat, position.lng, tile.lat, tile.lng);
      if (dist > MAX_DISTANCE_METERS) {
        const msg = `Ești la ${dist} m de ${tile.name}. În Modul Real trebuie să fii la mai puțin de ${MAX_DISTANCE_METERS} m pentru a bifa!`;
        setGpsError(msg);
        throw new Error(msg);
      }
    }

    // Salvează poza ca base64 în colecția de fotografii
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result;
      const newPhoto = {
        id: Date.now(),
        locationId: tile.location_id || tile.id,
        src: base64data,
        location: tile.name,
        caption: `Am vizitat ${tile.name}!`,
        timestamp: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
      };

      const updatedPhotos = [newPhoto, ...photos.filter((p) => p.location !== tile.name)];
      setPhotos(updatedPhotos);
      localStorage.setItem('tht_photos', JSON.stringify(updatedPhotos));
    };
    reader.readAsDataURL(blob);

    // Actualizează tile-urile și sesiunea
    setTiles((prev) => prev.map((t) => (t.id === tile.id ? { ...t, visited: true } : t)));

    // Actualizează sesiunea de hunt din localStorage
    try {
      const savedSession = JSON.parse(localStorage.getItem('tht_hunt_session'));
      if (savedSession) {
        const visitedList = savedSession.visitedLocations || [];
        if (!visitedList.includes(tile.location_id || tile.id)) {
          savedSession.visitedLocations = [...visitedList, tile.location_id || tile.id];
          localStorage.setItem('tht_hunt_session', JSON.stringify(savedSession));
        }
      }
    } catch {}

    setSelectedId(null);
  }

  // Resetare completă a sesiunii pentru a reîncepe de la Quiz
  function handleResetSession() {
    localStorage.removeItem('tht_hunt_session');
    localStorage.removeItem('tht_tiles');
    localStorage.removeItem('tht_photos');
    localStorage.removeItem('tht_quiz_completed');
    navigate('/quiz');
  }

  // Găsește poza făcută pentru locația selectată curent
  const currentPlacePhoto = selected
    ? photos.find(
        (ph) =>
          ph.location === selected.name ||
          ph.locationId === selected.id ||
          ph.locationId === selected.location_id
      )
    : null;

  return (
    <div style={{ height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      {/* ── Header / Bară superioară complexă ── */}
      <header
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          right: '10px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1200,
          pointerEvents: 'none',
        }}
      >
        {/* Grupul stânga: Mod Demo toggle + Badge sesiune activă */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
          {/* Buton / Toggle Mod Demo */}
          <button
            type="button"
            onClick={toggleDemoMode}
            style={{
              background: demoMode ? '#9DB288' : '#ffffff',
              color: '#32174d',
              border: '1.5px solid #9DB288',
              borderRadius: '20px',
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: '700',
              boxShadow: '0 4px 12px rgba(50, 23, 77, 0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
            title="Apasă pentru a comuta între Modul Demo (fără limită GPS) și Modul Real (sub 200m)"
          >
            {demoMode ? '🎮 Mod Demo: Activ' : '📍 Mod Real: 200m'}
          </button>

          {/* Indicator vizual Sesiune Bingo Activă */}
          <span
            style={{
              background: '#32174d',
              color: '#f5f7e9',
              borderRadius: '20px',
              padding: '7px 13px',
              fontSize: '12px',
              fontWeight: '700',
              boxShadow: '0 4px 12px rgba(50, 23, 77, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            🎯 Sesiune Activă
          </span>
        </div>

        {/* Grupul dreapta: Utilizator, Refă Quiz și Ieșire */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
          {user?.username && (
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                color: '#32174d',
                borderRadius: '20px',
                padding: '7px 12px',
                fontSize: '13px',
                fontWeight: '600',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}
            >
              👤 {user.username}
            </span>
          )}

          <button
            type="button"
            onClick={() => navigate('/quiz')}
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e0e0e0',
              borderRadius: '20px',
              padding: '7px 13px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#32174d',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            🧭 Quiz
          </button>

          {logout && (
            <button
              type="button"
              onClick={logout}
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #f5c6cb',
                borderRadius: '20px',
                padding: '7px 13px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#d93025',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                cursor: 'pointer',
              }}
            >
              Ieșire
            </button>
          )}
        </div>
      </header>

      {/* ── Componenta Hartă Leaflet ── */}
      <MapView
        ref={mapRef}
        places={places}
        onPinClick={selectPlace}
        userPosition={position}
      />

      {gpsUnavailable && (
        <div className="gps-banner">
          ⚠️ Accesul la geolocație nu este permis. Activează GPS-ul sau folosește <strong>Modul Demo</strong>.
        </div>
      )}

      {/* Buton recentrare pe utilizator */}
      <button
        className="center-btn"
        disabled={!position}
        onClick={() => mapRef.current?.centerOnUser()}
        title="Centrează harta pe poziția ta GPS"
      >
        {position ? '📍 Centrează-mă' : 'Caut locația…'}
      </button>

      {/* ── Cardul BINGO (afișat când nu e selectată o locație) ── */}
      {!selected && (
        <BingoCard tiles={places} selectedId={selectedId} onTileClick={selectPlace} />
      )}

      {/* ── Buton plutitor pentru redeschiderea Albumului dacă s-a completat jocul ── */}
      {isGameComplete && !showAlbumModal && (
        <button
          type="button"
          onClick={() => setShowAlbumModal(true)}
          style={{
            position: 'absolute',
            bottom: '18px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
            background: '#8A2BE2',
            color: '#ffffff',
            border: '2px solid #ffffff',
            borderRadius: '24px',
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '700',
            fontFamily: 'Source Sans 3, sans-serif',
            boxShadow: '0 6px 20px rgba(138, 43, 226, 0.45)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          🎉 Vezi Albumul Foto BINGO
        </button>
      )}

      {/* ── Panoul de Detalii al Locației Selectate ── */}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="panel-visited">✓ Ai bifat deja acest loc!</div>

                {/* Previzualizare și buton de descărcare individuală */}
                {currentPlacePhoto && (
                  <div
                    style={{
                      background: '#f5f7e9',
                      border: '1px solid #9DB288',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <img
                      src={currentPlacePhoto.src}
                      alt={selected.name}
                      style={{
                        width: '56px',
                        height: '56px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '1px solid #ccc',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '13px', color: '#32174d' }}>
                        Poza ta BeReal
                      </strong>
                      <small style={{ color: '#666' }}>{currentPlacePhoto.timestamp}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadSavedPhoto(currentPlacePhoto, selected.name)}
                      style={{
                        background: '#9DB288',
                        color: '#32174d',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                      title="Descarcă poza în galeria telefonului"
                    >
                      📥 Descarcă
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Camera onConfirm={(blob) => handlePhoto(selected, blob)} />
                {gpsError && (
                  <div
                    style={{
                      color: '#d93025',
                      backgroundColor: '#fce8e6',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      textAlign: 'center',
                      fontWeight: '600',
                      border: '1px solid #f5c6cb',
                    }}
                  >
                    ⚠️ {gpsError}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Album Foto Final (Colaj 2x3 & Mesaj Aleatoriu) ── */}
      {isGameComplete && showAlbumModal && (
        <FinalAlbumModal
          places={places}
          photos={photos}
          onReset={handleResetSession}
          onClose={() => setShowAlbumModal(false)}
        />
      )}
    </div>
  );
}