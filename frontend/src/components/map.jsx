import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TIMISOARA = [45.7537, 21.2257];
const bounds = [ [45.7410, 21.2050] ,  [45.7680, 21.2550]];

function makePinIcon(number, visited) {
  return L.divIcon({
    className: '',
    html: `<div class="num-pin ${visited ? 'visited' : ''}">${number}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

const MapView = forwardRef(function MapView({ places, onPinClick, userPosition }, ref) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
    const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);

  // expune funcția "centrează" către Hunt.jsx
  useImperativeHandle(ref, () => ({
    centerOnUser() {
      const map = mapRef.current;
      if (map && userPosition) {
        map.flyTo([userPosition.lat, userPosition.lng], 17);
      }
    },
  }));
  // creează harta o singură dată
  useEffect(() => {
    const map = L.map(containerRef.current, {
      center: TIMISOARA, 
      zoom: 14, 
      minZoom: 14, 
      maxZoom: 18,
      maxBounds: bounds,          // Blochează navigarea în afara coordonatelor de mai sus
      maxBoundsViscosity: 1.0     // Face ca marginile să fie "solide" (harta nu sare înapoi)
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
    return () => map.remove();   // important pentru React
  }, []);

  // redesenează pinii când se schimbă locațiile sau starea (vizitat)
  useEffect(() => {
    const map = mapRef.current;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = places.map((p, i) =>
      L.marker([p.lat, p.lng], { icon: makePinIcon(i + 1, p.visited) })
        .addTo(map)
        .on('click', () => onPinClick(p))
    );
    if (places.length) {
      map.fitBounds(places.map((p) => [p.lat, p.lng]), { padding: [40, 40] , maxZoom: 16,});
    }
  }, [places]);
    // pinul albastru al utilizatorului
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPosition) return;
    const latlng = [userPosition.lat, userPosition.lng];

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(latlng, {
        icon: L.divIcon({
          className: '',
          html: '<div class="user-dot"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: 1000, // deasupra pinilor locațiilor
        interactive: false,
      }).addTo(map);

      accuracyCircleRef.current = L.circle(latlng, {
        radius: userPosition.accuracy,
        color: '#1a73e8',
        weight: 1,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(latlng);
      accuracyCircleRef.current.setLatLng(latlng);
      accuracyCircleRef.current.setRadius(userPosition.accuracy);
    }
  }, [userPosition]);
  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
});

export default MapView;
