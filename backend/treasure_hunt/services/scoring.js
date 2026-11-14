import { calculateDistanceKm } from './haversine.js';

/**
 * Elimină diacriticele și convertește textul la litere mici.
 * Ex: "Tradițional" -> "traditional", "Comedie" -> "comedie", "Știință" -> "stiinta".
 * 
 * @param {string} str Textul de normalizat
 * @returns {string} Textul curățat
 */
export function normalizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

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
 * Normalizează corpul cererii pentru quiz / generare card, acceptând ambele convenții de denumire
 * (OpenAPI: stayDays, preferences etc. și formatul frontend: days, maxDistanceKm, movie, food, drink, domain, hobby).
 * Completează cu coordonatele implicite din centrul Timișoarei dacă lipsesc.
 * 
 * @param {Object} rawBody Corpul brut al cererii
 * @returns {Object} Obiect normalizat cu toate variantele de chei
 */
export function normalizeQuizPayload(rawBody = {}) {
  const prefs = (typeof rawBody.preferences === 'object' && rawBody.preferences !== null)
    ? rawBody.preferences
    : {};

  // 1. Zile: stayDays / zile_ramase / days
  const rawDays = rawBody.stayDays ?? rawBody.zile_ramase ?? rawBody.days ?? prefs.stayDays ?? prefs.zile_ramase ?? prefs.days;
  const stayDays = (rawDays !== undefined && rawDays !== null && rawDays !== '')
    ? Number(rawDays)
    : undefined;

  // 2. Distanță maximă: distanta_max_km / maxDistance / maxDistanceKm (implicit 10 km)
  const rawDist = rawBody.distanta_max_km ?? rawBody.maxDistance ?? rawBody.maxDistanceKm ?? prefs.distanta_max_km ?? prefs.maxDistance ?? prefs.maxDistanceKm;
  const maxDistance = (rawDist !== undefined && rawDist !== null && rawDist !== '')
    ? Number(rawDist)
    : 10;

  // 3. Coordonate GPS: userLat/userLng sau lat/lng, cu fallback pe centrul Timișoarei (45.7538, 21.2257)
  const rawLat = rawBody.userLat ?? rawBody.lat ?? prefs.userLat ?? prefs.lat;
  const rawLng = rawBody.userLng ?? rawBody.lng ?? prefs.userLng ?? prefs.lng;
  const userLat = (typeof rawLat === 'number' && !isNaN(rawLat))
    ? rawLat
    : (rawLat && !isNaN(Number(rawLat)) ? Number(rawLat) : 45.7538);
  const userLng = (typeof rawLng === 'number' && !isNaN(rawLng))
    ? rawLng
    : (rawLng && !isNaN(Number(rawLng)) ? Number(rawLng) : 21.2257);

  // 4. Preferințe cu normalizare (litere mici, fără diacritice)
  const rawMovie = prefs.movie ?? prefs.film ?? prefs.favoriteMovie ?? rawBody.movie ?? rawBody.film ?? rawBody.favoriteMovie;
  const rawFood = prefs.food ?? prefs.mancare ?? prefs.favoriteFood ?? rawBody.food ?? rawBody.mancare ?? rawBody.favoriteFood;
  const rawDrink = prefs.drink ?? prefs.bautura ?? prefs.favoriteDrink ?? rawBody.drink ?? rawBody.bautura ?? rawBody.favoriteDrink;
  const rawDomain = prefs.domain ?? prefs.alegere ?? prefs.category ?? rawBody.domain ?? rawBody.alegere ?? rawBody.category;
  const rawHobby = prefs.hobby ?? rawBody.hobby;

  const movie = normalizeText(rawMovie);
  const food = normalizeText(rawFood);
  const drink = normalizeText(rawDrink);
  const domain = normalizeText(rawDomain);
  const hobby = normalizeText(rawHobby);

  return {
    stayDays,
    zile_ramase: stayDays,
    days: stayDays,
    maxDistance,
    distanta_max_km: maxDistance,
    maxDistanceKm: maxDistance,
    userLat,
    lat: userLat,
    userLng,
    lng: userLng,
    film: movie,
    favoriteMovie: movie,
    movie: movie,
    mancare: food,
    favoriteFood: food,
    food: food,
    bautura: drink,
    favoriteDrink: drink,
    drink: drink,
    alegere: domain,
    category: domain,
    domain: domain,
    hobby: hobby,
    preferences: {
      film: movie,
      favoriteMovie: movie,
      movie: movie,
      mancare: food,
      favoriteFood: food,
      food: food,
      bautura: drink,
      favoriteDrink: drink,
      drink: drink,
      alegere: domain,
      category: domain,
      domain: domain,
      hobby: hobby
    }
  };
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

  // Extragem valorile normalizate din quiz
  const alegere = normalizeText(quiz.domain || quiz.alegere || quiz.category);
  const film = normalizeText(quiz.movie || quiz.film || quiz.favoriteMovie);
  const mancare = normalizeText(quiz.food || quiz.mancare || quiz.favoriteFood);
  const bautura = normalizeText(quiz.drink || quiz.bautura || quiz.favoriteDrink);
  const hobby = normalizeText(quiz.hobby);

  const tags = (location.taguri || []).map(t => normalizeText(t));
  const locCategory = normalizeText(location.categorie);

  // 1. Potrivire pe categorie principală (alegere / domain: stiinta / arta / istorie / natura)
  if (alegere && locCategory === alegere) {
    score += 5;
  } else if (alegere && tags.includes(alegere)) {
    score += 3;
  }

  // 2. Potrivire pe preferințe de film (movie / film: comedie / actiune / drama / romantic)
  if (film && tags.includes(film)) {
    score += 2;
  }

  // 3. Potrivire pe mâncare (food / mancare: picant / sarat / dulce / traditional)
  if (mancare && tags.includes(mancare)) {
    score += 2;
  }

  // 4. Potrivire pe băutură (drink / bautura: ceai / cafea / alcool / suc)
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
  if (season && location.sezoane && location.sezoane.some(s => normalizeText(s) === season)) {
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

  // Coordonate GPS: centrul Timișoarei dacă lipsesc
  const userLat = typeof quiz.lat === 'number'
    ? quiz.lat
    : (typeof quiz.userLat === 'number' ? quiz.userLat : 45.7538);

  const userLng = typeof quiz.lng === 'number'
    ? quiz.lng
    : (typeof quiz.userLng === 'number' ? quiz.userLng : 21.2257);

  // Distanța maximă în km (implicit 10 km dacă nu e specificat)
  const maxDistanceKm = typeof quiz.distanta_max_km === 'number'
    ? quiz.distanta_max_km
    : (typeof quiz.maxDistance === 'number'
      ? quiz.maxDistance
      : (typeof quiz.maxDistanceKm === 'number' ? quiz.maxDistanceKm : 10));

  // 1. Excludem locațiile deja folosite în zilele/cardurile anterioare
  const availableLocations = allLocations.filter(loc => !usedLocationIds.has(loc.id));

  // 2. Calculăm distanța și scorul pentru fiecare locație disponibilă
  const scoredLocations = availableLocations.map(loc => {
    const distance = calculateDistanceKm(userLat, userLng, loc.lat, loc.lng);
    const score = calculateLocationScore(loc, quiz, currentSeason);
    const fitsSeason = loc.sezoane && loc.sezoane.some(s => normalizeText(s) === currentSeason);

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
  // completăm cu cele mai apropiate locații disponibile din sezonul curent pentru a forma grila de 3x3
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
