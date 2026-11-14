import { useRef } from 'react';
import MapView from '../components/map';
import useUserPosition from '../components/useUserPosition';

const testPlaces = [
  { id: 'a', lat: 45.7537, lng: 21.2257, visited: false },
  { id: 'b', lat: 45.7489, lng: 21.2087, visited: true },
  { id: 'c', lat: 45.7600, lng: 21.2300, visited: false },
];

const ERROR_TEXT = {
  denied: 'Nu avem acces la locația ta. Activeaz-o din setările browserului (iconița de lângă adresă) și reîncarcă pagina.',
  unavailable: 'Nu îți putem determina locația. Încearcă într-un loc cu semnal mai bun.',
  timeout: 'Căutarea locației durează prea mult. Mai așteaptă puțin sau ieși într-un loc deschis.',
  unsupported: 'Telefonul sau browserul tău nu suportă localizarea.',
};

export default function Hunt() {
  const mapRef = useRef(null);
  const { position, error } = useUserPosition();

  return (
    <div style={{ height: '100dvh', position: 'relative' }}>
      <MapView
        ref={mapRef}
        places={testPlaces}
        onPinClick={(p) => console.log(p)}
        userPosition={position}
      />

      {error && <div className="gps-banner">{ERROR_TEXT[error]}</div>}

      <button
        className="center-btn"
        disabled={!position}
        onClick={() => mapRef.current?.centerOnUser()}
      >
        {position ? '📍 Centrează-mă' : 'Caut locația…'}
      </button>
    </div>
  );
}