import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { filterAndRankLocations, normalizeQuizPayload } from './scoring.js';
import { calculateDistanceKm } from './haversine.js';
import { seedDemoDataIfEnabled } from './demoSeed.js';

// Obținem calea absolută către fișierul locations.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const locationsFilePath = path.join(__dirname, '../data/locations.json');

// Citim locațiile din fișierul JSON
let allLocations = [];
try {
  const data = fs.readFileSync(locationsFilePath, 'utf-8');
  allLocations = JSON.parse(data);
} catch (error) {
  console.error('Eroare la încărcarea fișierului locations.json:', error);
}

/**
 * Structura stocării în memorie (fără bază de date).
 * Map: userId -> {
 *   quizAnswers: Object,
 *   usedLocationIds: Set<string>,
 *   cards: Array<BingoCard>,
 *   activeCardId: string | null
 * }
 */
const userStore = new Map();

// Rulăm seed-ul automat pentru prezentare dacă DEMO_MODE=true
seedDemoDataIfEnabled(userStore, allLocations);

/**
 * Returnează sau inițializează starea utilizatorului în memorie.
 * 
 * @param {string} userId Identificatorul utilizatorului
 * @returns {Object} Starea utilizatorului
 */
function getUserState(userId) {
  // Dacă se cere demo_user în DEMO_MODE și nu e populat, rulăm seed-ul
  if (userId === 'demo_user' && !userStore.has('demo_user') && process.env.DEMO_MODE === 'true') {
    seedDemoDataIfEnabled(userStore, allLocations);
  }

  if (!userStore.has(userId)) {
    userStore.set(userId, {
      userId,
      quizAnswers: null,
      usedLocationIds: new Set(),
      cards: [],
      activeCardId: null
    });
  }
  return userStore.get(userId);
}

/**
 * Returnează toate cardurile de bingo ale utilizatorului (active și finalizate),
 * opțional filtrate după status ('active' sau 'completed').
 * 
 * @param {string} userId
 * @param {string} [status] Filtru opțional: 'active' sau 'completed'
 * @returns {Array} Lista de carduri
 */
export function getAllBingoCards(userId, status) {
  const userState = getUserState(userId);
  if (status === 'active') {
    return userState.cards.filter(card => !card.completed);
  }
  if (status === 'completed') {
    return userState.cards.filter(card => card.completed);
  }
  return userState.cards;
}

/**
 * Returnează cardul activ (nefinalizat) al utilizatorului, dacă există.
 * 
 * @param {string} userId
 * @returns {Object | null} Cardul activ sau null dacă nu există
 */
export function getActiveBingoCard(userId) {
  const userState = getUserState(userId);
  if (userState.activeCardId) {
    const card = userState.cards.find(c => c.bingoId === userState.activeCardId && !c.completed);
    if (card) return card;
  }
  // Căutare fallback: primul card nefinalizat
  return userState.cards.find(card => !card.completed) || null;
}

/**
 * Returnează lista tuturor cardurilor de bingo anterioare (finalizate).
 * 
 * @param {string} userId
 * @returns {Array} Lista cardurilor completate
 */
export function getCompletedBingoCards(userId) {
  const userState = getUserState(userId);
  return userState.cards.filter(card => card.completed);
}

/**
 * Colectează toate pozele utilizatorului (galeria personală):
 * - Poze de la locațiile vizitate (BeReal)
 * - Poze de album generate la finalizarea fiecărui card
 * 
 * @param {string} userId
 * @returns {Object} Galeria cu totalul și listele de poze
 */
export function getUserGallery(userId) {
  const userState = getUserState(userId);

  const locationPhotos = [];
  const albumPhotos = [];

  for (const card of userState.cards) {
    // Poze de album (pentru cardurile finalizate)
    if (card.completed && card.albumPhoto) {
      albumPhotos.push({
        bingoId: card.bingoId,
        dayNumber: card.dayNumber,
        photoUrl: card.albumPhoto,
        completionMessage: card.completionMessage,
        completedAt: card.completedAt
      });
    }

    // Pozele vizitelor la locații
    for (const loc of card.locations) {
      if (loc.visited && loc.photoUrl) {
        locationPhotos.push({
          bingoId: card.bingoId,
          dayNumber: card.dayNumber,
          locationId: loc.locationId,
          locationName: loc.name,
          category: loc.category,
          photoUrl: loc.photoUrl,
          visitedAt: loc.visitedAt
        });
      }
    }
  }

  return {
    userId,
    totalPhotos: locationPhotos.length + albumPhotos.length,
    albumPhotos,
    locationPhotos
  };
}

/**
 * Returnează un card de bingo după ID.
 * 
 * @param {string} userId
 * @param {string} bingoId
 * @returns {Object | null}
 */
export function getBingoCardById(userId, bingoId) {
  const userState = getUserState(userId);
  return userState.cards.find(card => card.bingoId === bingoId) || null;
}

/**
 * Selectează locații variate pentru cardul de bingo, asigurând diversitatea categoriilor.
 * Regula: maxim 4 locații din aceeași categorie pe un card, iar restul vin din categorii diferite,
 * respectând ordinea descrescătoare a scorului.
 * 
 * @param {Array} rankedLocations Lista de locații sortată descrescător după scor
 * @param {number} targetCount Numărul de locații dorit (implicit 9 pentru grila 3x3)
 * @param {number} maxPerCategory Limita maximă din aceeași categorie (implicit 4)
 * @returns {Array} Lista celor 9 locații variate
 */
function selectVariedLocations(rankedLocations, targetCount = 9, maxPerCategory = 4) {
  const selected = [];
  const selectedIds = new Set();
  const categoryCounts = {};

  // Pasul 1: Preluăm în ordinea scorului, respectând limita de maxim 4 per categorie
  for (const loc of rankedLocations) {
    if (selected.length >= targetCount) break;

    const category = loc.categorie || 'alta';
    const currentCount = categoryCounts[category] || 0;

    if (currentCount < maxPerCategory) {
      selected.push(loc);
      selectedIds.add(loc.id);
      categoryCounts[category] = currentCount + 1;
    }
  }

  // Pasul 2 (fallback de siguranță): Dacă nu s-au strâns 9 locații din cauza limitei stricte,
  // completăm cu următoarele cele mai bune locații disponibile în ordinea scorului
  if (selected.length < targetCount) {
    for (const loc of rankedLocations) {
      if (selected.length >= targetCount) break;
      if (!selectedIds.has(loc.id)) {
        selected.push(loc);
        selectedIds.add(loc.id);
      }
    }
  }

  return selected;
}

/**
 * Creează un nou card de bingo sau returnează cardul activ existent.
 * Respectă regula:
 * 1. Dacă există deja un card activ (nefinalizat), îl returnează pe acesta fără a reseta progresul.
 * 2. Dacă toate cardurile anterioare sunt finalizate și utilizatorul mai are zile, creează următorul card (ziua X).
 * 3. Folosește 9 locații nefolosite anterior (grilă 3x3), variate (maxim 4 din aceeași categorie).
 * 
 * @param {string} userId
 * @param {Object} quizData Datele din quiz (stayDays, preferences etc.)
 * @returns {{ card: Object, isNew: boolean, message: string }}
 */
export function createOrGetBingoCard(userId, quizData) {
  const userState = getUserState(userId);

  // 1. Verificăm dacă există deja un card activ
  if (userState.activeCardId) {
    const existingActiveCard = userState.cards.find(c => c.bingoId === userState.activeCardId);
    if (existingActiveCard && !existingActiveCard.completed) {
      // Ne asigurăm că fiecare locație are id și location_id
      existingActiveCard.locations.forEach(loc => {
        if (!loc.id) loc.id = loc.locationId;
        if (!loc.location_id) loc.location_id = loc.locationId;
      });
      return {
        card: existingActiveCard,
        isNew: false,
        message: 'Ai deja un card de bingo activ în desfășurare. Continuă explorarea locațiilor!'
      };
    }
  }

  // 2. Normalizăm datele din quiz (suportă atât convenția OpenAPI cât și formatul frontend)
  const flatQuiz = normalizeQuizPayload(quizData);

  const totalDays = Number(flatQuiz.stayDays || flatQuiz.days || flatQuiz.zile_ramase || 1);
  const currentCardNumber = userState.cards.length + 1;

  // Verificăm dacă utilizatorul a terminat deja numărul maxim de zile alocate
  if (userState.cards.length >= totalDays && userState.cards.every(c => c.completed)) {
    const lastCard = userState.cards[userState.cards.length - 1];
    lastCard.locations.forEach(loc => {
      if (!loc.id) loc.id = loc.locationId;
      if (!loc.location_id) loc.location_id = loc.locationId;
    });
    return {
      card: lastCard,
      isNew: false,
      message: `Felicitări! Ai completat toate cele ${totalDays} zile de Treasure Hunt!`
    };
  }

  // Salvăm / actualizăm cele mai recente răspunsuri la quiz
  userState.quizAnswers = flatQuiz;

  // 3. Selectăm cele mai bune locații folosind funcțiile de scoring și distanță
  let rankedLocations = filterAndRankLocations(
    allLocations,
    flatQuiz,
    userState.usedLocationIds
  );

  // Dacă nu avem suficiente locații nefolosite pentru o grilă de 9, resetăm istoricul ID-urilor
  if (rankedLocations.length < 9) {
    userState.usedLocationIds.clear();
    rankedLocations = filterAndRankLocations(
      allLocations,
      flatQuiz,
      userState.usedLocationIds
    );
  }

  // Selectăm 9 locații variate: maxim 4 din aceeași categorie, restul din categorii diferite, în ordinea scorului
  const selectedLocations = selectVariedLocations(rankedLocations, 9, 4);

  // Marcăm noile locații ca folosite pentru a nu se repeta în cardurile viitoare
  selectedLocations.forEach(loc => userState.usedLocationIds.add(loc.id));

  // 4. Construim obiectul card de bingo cu id, location_id și locationId
  const newBingoId = `bingo_${crypto.randomUUID().slice(0, 8)}`;
  const newCard = {
    bingoId: newBingoId,
    userId,
    dayNumber: currentCardNumber,
    totalDays: totalDays,
    createdAt: new Date().toISOString(),
    completed: false,
    completedAt: null,
    albumPhoto: null,
    completionMessage: null,
    // Grila 3x3 cu 9 locații, compatibilă atât cu locationId, cât și cu id și location_id
    locations: selectedLocations.map(loc => ({
      id: loc.id,
      location_id: loc.id,
      locationId: loc.id,
      name: loc.nume,
      description: loc.descriere,
      lat: loc.lat,
      lng: loc.lng,
      category: loc.categorie,
      tags: loc.taguri,
      distanceKm: loc.calculatedDistanceKm,
      visited: false,
      visitedAt: null,
      photoUrl: null
    }))
  };

  // Salvăm noul card în colecția utilizatorului și îl setăm ca activ
  userState.cards.push(newCard);
  userState.activeCardId = newBingoId;

  return {
    card: newCard,
    isNew: true,
    message: `Cardul de bingo pentru Ziua ${currentCardNumber} din ${totalDays} a fost generat cu succes!`
  };
}

/**
 * Validează vizita la o locație specifică de pe un card de bingo.
 * Verifică dacă utilizatorul se află în proximitatea locației (max 500m = 0.5km) și atașează poza.
 * 
 * @param {string} userId
 * @param {string} bingoId
 * @param {Object} verificationData { locationId, id, location_id, userLat, userLng, photo }
 * @returns {{ success: boolean, message: string, location?: Object, error?: string, status: number }}
 */
export function verifyLocationVisit(userId, bingoId, verificationData) {
  const userState = getUserState(userId);
  const card = userState.cards.find(c => c.bingoId === bingoId);

  if (!card) {
    return {
      success: false,
      status: 404,
      error: 'Cardul de bingo nu a fost găsit'
    };
  }

  if (card.completed) {
    return {
      success: false,
      status: 400,
      error: 'Acest card de bingo este deja finalizat!'
    };
  }

  const { locationId, id, location_id, userLat, userLng, photo } = verificationData;
  const targetId = locationId || id || location_id;

  // Căutăm locația în lista cardului (după locationId, id sau location_id)
  const targetLocation = card.locations.find(loc => loc.locationId === targetId || loc.id === targetId || loc.location_id === targetId);
  if (!targetLocation) {
    return {
      success: false,
      status: 400,
      error: `Locația cu ID-ul '${targetId}' nu aparține acestui card de bingo.`
    };
  }

  if (targetLocation.visited) {
    return {
      success: true,
      status: 200,
      message: 'Această locație a fost deja marcată ca vizitată.',
      location: targetLocation
    };
  }

  // Verificăm dacă poza este prezentă (necesară pentru validarea vizitei)
  if (!photo || (typeof photo === 'string' && photo.trim() === '')) {
    return {
      success: false,
      status: 400,
      error: 'Poza este obligatorie pentru validarea vizitei la locație.'
    };
  }

  // Verificăm dacă suntem în modul DEMO (DEMO_MODE=true în .env)
  const isDemoMode = process.env.DEMO_MODE === 'true';

  // În afara modului DEMO, verificăm obligatoriu distanța GPS (max 500 m)
  if (!isDemoMode) {
    const latNum = Number(userLat);
    const lngNum = Number(userLng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return {
        success: false,
        status: 400,
        error: 'Coordonatele utilizatorului (userLat, userLng) sunt obligatorii și trebuie să fie numere valide.'
      };
    }

    // Calculăm distanța față de locație cu formula Haversine
    const distance = calculateDistanceKm(latNum, lngNum, targetLocation.lat, targetLocation.lng);

    // Marjă de toleranță: 0.5 km (500 de metri)
    const MAX_TOLERANCE_KM = 0.5;

    if (distance > MAX_TOLERANCE_KM) {
      return {
        success: false,
        status: 400,
        error: `Ești prea departe de ${targetLocation.name}. Distanța curentă este de ${distance.toFixed(2)} km (maxim permis: ${MAX_TOLERANCE_KM} km).`
      };
    }
  }

  // Marcăm locația ca vizitată
  targetLocation.visited = true;
  targetLocation.visitedAt = new Date().toISOString();
  targetLocation.photoUrl = photo || 'https://via.placeholder.com/600x400?text=BeReal+Timi%C8%99oara';

  // Verificăm câte locații au fost vizitate până acum pe acest card
  const visitedCount = card.locations.filter(l => l.visited).length;

  return {
    success: true,
    status: 200,
    message: `Felicitări! Ai vizitat cu succes: ${targetLocation.name}! (${visitedCount}/9 locații bifate pe acest card)`,
    location: targetLocation,
    allVisited: visitedCount === card.locations.length
  };
}

/**
 * Finalizează un card de bingo, generează poza de album și mesajul de final.
 * 
 * @param {string} userId
 * @param {string} bingoId
 * @returns {{ success: boolean, status: number, message?: string, albumPhoto?: string, completionMessage?: string, card?: Object, error?: string }}
 */
export function completeBingoCard(userId, bingoId) {
  const userState = getUserState(userId);
  const card = userState.cards.find(c => c.bingoId === bingoId);

  if (!card) {
    return {
      success: false,
      status: 404,
      error: 'Cardul de bingo nu a fost găsit'
    };
  }

  // Verificăm dacă toate locațiile sunt bifate (sau dacă utilizatorul a finalizat)
  const unvisitedCount = card.locations.filter(l => !l.visited).length;
  if (unvisitedCount > 0) {
    return {
      success: false,
      status: 400,
      error: `Nu poți finaliza cardul încă. Mai ai ${unvisitedCount} locații nevizitate din cele 9!`
    };
  }

  // Marcăm cardul ca finalizat
  card.completed = true;
  card.completedAt = new Date().toISOString();
  card.albumPhoto = `https://images.unsplash.com/photo-1584448141569-69f342da535c?auto=format&fit=crop&w=1200&q=80`;
  card.completionMessage = `Felicitări! Ești un adevărat timișorean! Ai finalizat cardul pentru Ziua ${card.dayNumber}!`;

  // Eliberăm cardul activ pentru a permite crearea următorului card
  if (userState.activeCardId === bingoId) {
    userState.activeCardId = null;
  }

  return {
    success: true,
    status: 200,
    message: 'Card finalizat. S-a generat poza de album și mesajul de adevărat timișorean.',
    bingoId: card.bingoId,
    albumPhoto: card.albumPhoto,
    completionMessage: card.completionMessage,
    card
  };
}
