import { calculateDistanceKm } from './haversine.js';

/**
 * Determină sezonul curent pe baza datei calendaristice curente.
 * Lunile în JavaScript încep de la 0 (Ianuarie = 0, Decembrie = 11).
 * 
 * @param {Date} [date=new Date()] Data pentru care se calculează sezonul
 * @returns {'primavara' | 'vara' | 'toamna' | 'iarna'} Numele sezonului
 */
export function getCurrentSeason(date = new Date()) {
  const month = date.getMonth(); // 0 - 11

  // Martie (2), Aprilie (3), Mai (4)
  if (month >= 2 && month <= 4) {
    return 'primavara';
  }
  // Iunie (5), Iulie (6), August (7)
  if (month >= 5 && month <= 7) {
    return 'vara';
  }
  // Septembrie (8), Octombrie (9), Noiembrie (10)
  if (month >= 8 && month <= 10) {
    return 'toamna';
  }
  // Decembrie (11), Ianuarie (0), Februarie (1)
  return 'iarna';
}

/**
 * Calculează scorul de potrivire al unei locații în raport cu răspunsurile la quiz ale utilizatorului.
 * 
 * @param {Object} location Obiectul locație din locations.json
 * @param {Object} quiz Obiect cu răspunsurile date de utilizator
 * @param {string} season Sezonul curent
 * @returns {number} Scorul obținut de locație
 */
export function calculateLocationScore(location, quiz, season) {
  let score = 0;

  // Extragem valorile din quiz (suportăm atât denumirile în română cât și cele din openapi)
  const alegere = (quiz.alegere || quiz.category || '').toLowerCase();
  const film = (quiz.film || quiz.favoriteMovie || '').toLowerCase();
  const mancare = (quiz.mancare || quiz.favoriteFood || '').toLowerCase();
  const bautura = (quiz.bautura || quiz.favoriteDrink || '').toLowerCase();
  const hobby = (quiz.hobby || '').toLowerCase();

  const tags = (location.taguri || []).map(t => t.toLowerCase());
  const locCategory = (location.categorie || '').toLowerCase();

  // 1. Potrivire pe categorie principală (alegere: stiinta / arta / istorie / natura)
  if (alegere && locCategory === alegere) {
    score += 5;
  } else if (alegere && tags.includes(alegere)) {
    score += 3;
  }

  // 2. Potrivire pe preferințe de film (comedie / actiune / drama / romantic)
  if (film && tags.includes(film)) {
    score += 2;
  }

  // 3. Potrivire pe mâncare (picant / sarat / dulce / traditional)
  if (mancare && tags.includes(mancare)) {
    score += 2;
  }

  // 4. Potrivire pe băutură (ceai / cafea / alcool / suc)
  if (bautura && tags.includes(bautura)) {
    score += 2;
  }

  // 5. Potrivire pe hobby (citit / sport / crafting / filme)
  if (hobby && tags.includes(hobby)) {
    score += 3;
  } else if (hobby === 'filme' && (tags.includes('film') || tags.includes('teatru') || tags.includes('cinema'))) {
    score += 2;
  }

  // 6. Bonus dacă sezonul curent este printre sezoanele ideale ale locației
  if (season && location.sezoane && location.sezoane.includes(season)) {
    score += 2;
  }

  return score;
}

/**
 * Filtrează locațiile pe baza sezonului, distanței maxime și a celor deja folosite,
 * apoi le sortează descrescător după scorul de potrivire.
 * 
 * @param {Array} allLocations Lista tuturor locațiilor disponibile
 * @param {Object} quiz Răspunsurile utilizatorului din quiz
 * @param {Set<string>} usedLocationIds ID-urile locațiilor deja folosite în cardurile anterioare
 * @returns {Array} Lista ordonată de locații eligibile cu scor și distanță atașate
 */
export function filterAndRankLocations(allLocations, quiz, usedLocationIds = new Set()) {
  const currentSeason = getCurrentSeason();

  // Coordonate implicite: centrul Timișoarei (Piața Victoriei) dacă utilizatorul nu oferă coordonate
  const userLat = typeof quiz.lat === 'number'
    ? quiz.lat
    : (typeof quiz.userLat === 'number' ? quiz.userLat : 45.7538);

  const userLng = typeof quiz.lng === 'number'
    ? quiz.lng
    : (typeof quiz.userLng === 'number' ? quiz.userLng : 21.2257);

  // Distanța maximă în km (implicit 10 km pentru tot orașul Timișoara dacă nu este specificat)
  const maxDistanceKm = typeof quiz.distanta_max_km === 'number'
    ? quiz.distanta_max_km
    : (typeof quiz.maxDistance === 'number' ? quiz.maxDistance : 10);

  // 1. Excludem locațiile deja folosite în zilele/cardurile anterioare
  const availableLocations = allLocations.filter(loc => !usedLocationIds.has(loc.id));

  // 2. Calculăm distanța și scorul pentru fiecare locație disponibilă
  const scoredLocations = availableLocations.map(loc => {
    const distance = calculateDistanceKm(userLat, userLng, loc.lat, loc.lng);
    const score = calculateLocationScore(loc, quiz, currentSeason);
    const fitsSeason = loc.sezoane && loc.sezoane.includes(currentSeason);

    return {
      ...loc,
      calculatedDistanceKm: Math.round(distance * 100) / 100, // rotunjit la 2 zecimale
      matchScore: score,
      fitsSeason
    };
  });

  // 3. Filtrăm strict după sezon și distanța maximă cerută de utilizator
  let filtered = scoredLocations.filter(loc => loc.fitsSeason && loc.calculatedDistanceKm <= maxDistanceKm);

  // Fallback de siguranță: dacă utilizatorul a setat o distanță prea mică și rămân sub 9 locații,
  // completăm cu cele mai apropiate locații disponibile din sezonul curent pentru a putea forma grila de 3x3 (9 căsuțe)
  if (filtered.length < 9) {
    const seasonalOnly = scoredLocations
      .filter(loc => loc.fitsSeason)
      .sort((a, b) => a.calculatedDistanceKm - b.calculatedDistanceKm);

    if (seasonalOnly.length >= 9) {
      filtered = seasonalOnly;
    } else {
      // Dacă nici după sezon nu avem 9, folosim toate locațiile disponibile ordonate după distanță
      filtered = [...scoredLocations].sort((a, b) => a.calculatedDistanceKm - b.calculatedDistanceKm);
    }
  }

  // 4. Sortăm descrescător după scorul de potrivire; la scor egal, alegem locația mai apropiată
  filtered.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return a.calculatedDistanceKm - b.calculatedDistanceKm;
  });

  return filtered;
}
