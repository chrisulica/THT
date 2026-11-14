/**
 * Serviciu pentru calculul distanței geografice dintre două puncte folosind formula Haversine.
 * Formula Haversine ține cont de curbura Pământului (raza aprox. 6371 km).
 */

/**
 * Calculează distanța în kilometri dintre două seturi de coordonate GPS (latitudine și longitudine).
 * 
 * @param {number} lat1 Latitudinea primului punct (ex: locația utilizatorului)
 * @param {number} lon1 Longitudinea primului punct
 * @param {number} lat2 Latitudinea celui de-al doilea punct (ex: locația obiectivului)
 * @param {number} lon2 Longitudinea celui de-al doilea punct
 * @returns {number} Distanța în kilometri
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  // Convertim gradele în radiani
  const toRadian = (degree) => (degree * Math.PI) / 180;

  const R = 6371; // Raza Pământului în kilometri

  const dLat = toRadian(lat2 - lat1);
  const dLon = toRadian(lon2 - lon1);

  const radLat1 = toRadian(lat1);
  const radLat2 = toRadian(lat2);

  // Formula Haversine
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Rezultatul este distanța în km
  return R * c;
}
