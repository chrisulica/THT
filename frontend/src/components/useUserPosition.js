import { useEffect, useState } from 'react';

export default function useUserPosition() {
  const [position, setPosition] = useState(null); // { lat, lng, accuracy }
  const [error, setError] = useState(null);       // 'denied' | 'unavailable' | 'timeout' | 'unsupported'

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('unsupported');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null);
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy, // în metri
        });
      },
      (err) => {
        if (err.code === 1) setError('denied');
        else if (err.code === 2) setError('unavailable');
        else setError('timeout');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { position, error };
}