import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapView from '../components/map';
import BingoCard from '../components/BingoCard';
import useUserPosition from '../components/useUserPosition';
import Camera from '../components/camera';
import { aiApi } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Mapează o locație din backend în obiectul de afișare pe hartă și în cardul Bingo.
 */
function mapAiLocationToPlace(loc, index) {
  const lat = loc.coords?.lat ?? loc.lat ?? 45.7537;
  const lng = loc.coords?.lng ?? loc.lng ?? 21.2257;

  return {
    id: loc.id ?? `loc-${index}`,
    location_id: loc.id ?? `loc-${index}`,
    name: loc.name || `Locație ${index + 1}`,
    icon: loc.emoji || loc.icon || '📍',
    lat: Number(lat),
    lng: Number(lng),
    blurb: loc.description || loc.address || 'Locație din Timișoara',
    address: loc.address || 'Timișoara',
    distantaFataDeCentru: loc.distantaFataDeCentru,
    visited: Boolean(loc.visited),
    raw: loc,
  };
}

export default function Hunt() {
  const mapRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { position, error: gpsError } = useUserPosition();

  // Stare sesiune pe mai multe zile
  const [session, setSession] = useState(null);
  const [places, setPlaces] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [completionData, setCompletionData] = useState(null);
  const [actionError, setActionError] = useState(null);

  // ── 1. Inițializare sesiune (DOAR din Quiz sau localStorage) ────────────────
  useEffect(() => {
    // Verifică dacă am primit sesiune direct din SetupPage (state)
    const passedSession = location.state?.huntSession;
    if (passedSession && Array.isArray(passedSession.dayLocations) && passedSession.dayLocations.length > 0) {
      setSession(passedSession);
      setPlaces(passedSession.dayLocations.map(mapAiLocationToPlace));
      return;
    }

    // Altfel, verifică dacă există sesiune salvată anterior în localStorage
    const savedStr = localStorage.getItem('tht_hunt_session');
    if (savedStr) {
      try {
        const saved = JSON.parse(savedStr);
        if (saved && Array.isArray(saved.dayLocations) && saved.dayLocations.length > 0) {
          setSession(saved);
          setPlaces(saved.dayLocations.map(mapAiLocationToPlace));
          return;
        }
      } catch (err) {
        console.warn('Sesiune invalidă în localStorage:', err);
      }
    }

    // Dacă utilizatorul nu a completat quiz-ul, NU afișăm trasee hardcodate
    setSession(null);
    setPlaces([]);
  }, [location.state]);

  const selected = places.find((p) => p.id === selectedId);

  function selectPlace(p) {
    setSelectedId(p.id);
    mapRef.current?.flyToPlace(p);
  }

  // ── 2. Marcarea unei locații ca vizitată (Poză / Verificare) ────────────────
  async function handlePhoto(place, blob) {
    const coords = position
      ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy }
      : null;
    console.log('Poză trimisă pentru:', place.name, coords, blob);

    // Actualizăm starea locației în ziua curentă
    setPlaces((prev) =>
      prev.map((t) => (t.id === place.id ? { ...t, visited: true } : t))
    );

    // Actualizăm și în sesiune în localStorage
    if (session) {
      const updatedDayLocations = (session.dayLocations || []).map((l) =>
        l.id === place.id ? { ...l, visited: true } : l
      );
      const updatedSession = { ...session, dayLocations: updatedDayLocations };
      setSession(updatedSession);
      localStorage.setItem('tht_hunt_session', JSON.stringify(updatedSession));
    }
  }

  // ── 3. Progresia către Ziua Următoare (sau Finalizare Traseu) ────────────────
  const handleAdvanceDay = useCallback(async () => {
    if (!session) return;

    setLoading(true);
    setActionError(null);

    const currentDay = session.currentDay || 1;
    const totalDays = session.totalDays || 1;

    // Cumulăm toate ID-urile vizitate până acum + ID-urile din ziua curentă
    const currentDayIds = places.map((p) => p.id);
    const cumulativeVisited = [...new Set([...(session.visitedLocations || []), ...currentDayIds])];

    try {
      // Dacă mai sunt zile de parcurs (currentDay < totalDays)
      if (currentDay < totalDays) {
        const nextPayload = {
          prefs: session.prefs,
          alreadyVisited: cumulativeVisited,
          bingoSize: 5,
        };

        const res = await aiApi.generateBingo(nextPayload);

        if (!res || !Array.isArray(res.locations) || res.locations.length === 0) {
          throw new Error('Nu s-au putut genera locații noi pentru ziua următoare.');
        }

        const nextSession = {
          ...session,
          currentDay: currentDay + 1,
          visitedLocations: cumulativeVisited,
          dayLocations: res.locations,
          message: res.message,
        };

        setSession(nextSession);
        localStorage.setItem('tht_hunt_session', JSON.stringify(nextSession));
        setPlaces(res.locations.map(mapAiLocationToPlace));
        setSelectedId(null);
      } else {
        // Dacă s-a terminat ultima zi -> apelăm completion-message
        const compPayload = {
          userName: user?.username || 'Exploratorule',
          visitedLocationIds: cumulativeVisited,
          prefs: session.prefs,
        };

        const compRes = await aiApi.getCompletionMessage(compPayload);
        setCompletionData(compRes);
      }
    } catch (err) {
      console.error('Eroare la avansarea zilei:', err);
      setActionError(err.message || 'Eroare la încărcarea traseului pentru ziua următoare.');
    } finally {
      setLoading(false);
    }
  }, [session, places, user]);

  // Resetare aventură și reluare Quiz
  function handleResetAdventure() {
    localStorage.removeItem('tht_hunt_session');
    setSession(null);
    setPlaces([]);
    setCompletionData(null);
    navigate('/setup');
  }

  const currentDay = session?.currentDay || 1;
  const totalDays = session?.totalDays || 1;
  const visitedCount = places.filter((p) => p.visited).length;
  const isDayFinished = places.length > 0 && visitedCount === places.length;

  return (
    <div style={{ height: '100dvh', position: 'relative', overflow: 'hidden', background: '#eef2f6' }}>
      {/* ── Harta Leaflet ── */}
      <MapView
        ref={mapRef}
        places={places}
        onPinClick={selectPlace}
        userPosition={position}
      />

      {/* ── Banners GPS ── */}
      {gpsError && (
        <div className="gps-banner" style={{ top: 70 }}>
          Nu avem acces la locația ta GPS.
        </div>
      )}

      <button
        className="center-btn"
        disabled={!position}
        onClick={() => mapRef.current?.centerOnUser()}
        style={{ top: 75 }}
      >
        {position ? '📍 Centrează-mă' : 'Caut GPS…'}
      </button>

      {/* ── SITUAȚIA 1: Utilizatorul NU a completat încă quiz-ul (Harta e curată, fără hardcodări) ── */}
      {!session && places.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            width: '90%',
            maxWidth: '460px',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(10px)',
            borderRadius: '24px',
            padding: '28px 24px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🧭</div>
          <h2 style={{ margin: '0 0 10px', fontSize: '22px', color: '#1e293b' }}>
            Treasure Hunt Timișoara
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
            Harta ta este pregătită! Răspunde la scurtul quiz cu preferințele tale (băutura preferată, hobby, cultură și numărul de zile) pentru a genera traseul tău personalizat prin Timișoara.
          </p>
          <button
            type="button"
            onClick={() => navigate('/setup')}
            style={{
              width: '100%',
              padding: '14px 20px',
              border: 'none',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(26,115,232,0.35)',
            }}
          >
            🚀 Completează Quiz-ul
          </button>
        </div>
      )}

      {/* ── SITUAȚIA 2: Sesiune activă cu traseu pe zile ── */}
      {session && (
        <>
          {/* Bara Superioară: Status zi și progres */}
          <header
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              right: 10,
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(8px)',
              borderRadius: '16px',
              boxShadow: '0 4px 18px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  background: '#e8f0fe',
                  color: '#1a73e8',
                  padding: '6px 10px',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                }}
              >
                🗓️ Ziua {currentDay} / {totalDays}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                  {visitedCount} din {places.length} locații bifate
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {session.message || 'Traseu personalizat conform răspunsurilor tale'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleAdvanceDay}
                disabled={loading}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '10px',
                  background: isDayFinished ? '#2e9d5b' : '#1a73e8',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                {loading
                  ? 'Se încarcă…'
                  : currentDay < totalDays
                  ? isDayFinished
                    ? `✓ Treci la Ziua ${currentDay + 1}`
                    : `Ziua ${currentDay + 1} ➡️`
                  : '🏆 Finalizează'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/setup')}
                style={{
                  padding: '8px 10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
                title="Modifică preferințele quiz-ului"
              >
                ⚙️
              </button>
            </div>
          </header>

          {actionError && (
            <div className="gps-banner" style={{ top: 70, background: '#fef2f2', color: '#991b1b' }}>
              ⚠️ {actionError}
            </div>
          )}

          {/* Cardul BINGO interactiv */}
          {!selected && places.length > 0 && (
            <BingoCard tiles={places} selectedId={selectedId} onTileClick={selectPlace} />
          )}

          {/* Panou Detalii Locație Selectată */}
          {selected && (
            <div className="place-panel">
              <div className="panel-head">
                <span className="panel-icon">{selected.icon}</span>
                <h2 className="panel-title">{selected.name}</h2>
                <button className="panel-close" onClick={() => setSelectedId(null)}>
                  ✕
                </button>
              </div>
              <p className="panel-blurb">{selected.blurb}</p>
              {selected.address && (
                <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 12px 0' }}>
                  📍 <strong>Adresă:</strong> {selected.address}
                </p>
              )}
              <div className="panel-actions">
                <a
                  className="btn-nav"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  🧭 Navighează (GPS: {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)})
                </a>
                {selected.visited ? (
                  <div className="panel-visited">✓ Ai bifat deja acest loc</div>
                ) : (
                  <Camera onConfirm={(blob) => handlePhoto(selected, blob)} />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MODAL DE FINALIZARE ȘI FELICITARE (După terminarea tuturor zilelor) ── */}
      {completionData && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              padding: '32px 24px',
              maxWidth: '480px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontSize: '56px', marginBottom: '8px' }}>
              {completionData.badge || '🏅'}
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', margin: '0 0 14px' }}>
              {completionData.title || 'Felicitări! Ești un adevărat timișorean!'}
            </h2>
            <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.6, margin: '0 0 24px' }}>
              {completionData.message}
            </p>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '14px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#64748b',
              }}
            >
              🎉 Ai finalizat cu succes toate cele <strong>{totalDays} zile</strong> de aventură în Timișoara!
            </div>
            <button
              type="button"
              onClick={handleResetAdventure}
              style={{
                width: '100%',
                padding: '14px 20px',
                border: 'none',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              🔄 Începe o Aventură Nouă
            </button>
          </div>
        </div>
      )}
    </div>
  );
}