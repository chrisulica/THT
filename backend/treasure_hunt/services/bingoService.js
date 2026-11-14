import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { filterAndRankLocations } from './scoring.js';
import { calculateDistanceKm } from './haversine.js';

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

/**
 * Returnează sau inițializează starea utilizatorului în memorie.
 * 
 * @param {string} userId Identificatorul utilizatorului
 * @returns {Object} Starea utilizatorului
 */
function getUserState(userId) {
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
 * Returnează toate cardurile de bingo ale utilizatorului (active și finalizate).
 * 
 * @param {string} userId
 * @returns {Array} Lista de carduri
 */
export function getAllBingoCards(userId) {
  const userState = getUserState(userId);
  return userState.cards;
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
 * Creează un nou card de bingo sau returnează cardul activ existent.
 * Respectă regula:
 * 1. Dacă există deja un card activ (nefinalizat), îl returnează pe acesta fără a reseta progresul.
 * 2. Dacă toate cardurile anterioare sunt finalizate și utilizatorul mai are zile, creează următorul card (ziua X).
 * 3. Folosește 9 locații nefolosite anterior (grilă 3x3).
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
      return {
        card: existingActiveCard,
        isNew: false,
        message: 'Ai deja un card de bingo activ în desfășurare. Continuă explorarea locațiilor!'
      };
    }
  }

  // 2. Extragem numărul de zile (zile_ramase / stayDays)
  // Acceptăm atât câmpuri la nivel rădăcină, cât și în sub-obiectul preferences
  const preferences = quizData.preferences || {};
  const flatQuiz = { ...quizData, ...preferences };

  const totalDays = Number(flatQuiz.zile_ramase || flatQuiz.stayDays || 1);
  const currentCardNumber = userState.cards.length + 1;

  // Verificăm dacă utilizatorul a terminat deja numărul maxim de zile alocate
  if (userState.cards.length >= totalDays && userState.cards.every(c => c.completed)) {
    return {
      card: userState.cards[userState.cards.length - 1],
      isNew: false,
      message: `Felicitări! Ai completat toate cele ${totalDays} zile de Treasure Hunt!`
    };
  }

  // Salvăm / actualizăm cele mai recente răspunsuri la quiz
  userState.quizAnswers = flatQuiz;

  // 3. Selectăm cele mai bune locații folosind funcțiile de scoring și distanță
  const rankedLocations = filterAndRankLocations(
    allLocations,
    flatQuiz,
    userState.usedLocationIds
  );

  // Avem nevoie de 9 locații pentru grila 3x3
  const selectedLocations = rankedLocations.slice(0, 9);

  if (selectedLocations.length < 9) {
    // Dacă nu avem suficiente locații neutilizate, resetăm istoricul celor folosite ca să putem genera cardul
    userState.usedLocationIds.clear();
    const fallbackRanked = filterAndRankLocations(allLocations, flatQuiz, userState.usedLocationIds);
    selectedLocations.push(...fallbackRanked.slice(0, 9 - selectedLocations.length));
  }

  // Marcăm noile locații ca folosite pentru a nu se repeta în cardurile viitoare
  selectedLocations.forEach(loc => userState.usedLocationIds.add(loc.id));

  // 4. Construim obiectul card de bingo
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
    // Grila 3x3 cu 9 locații
    locations: selectedLocations.map(loc => ({
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
 * @param {Object} verificationData { locationId, userLat, userLng, photo }
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

  const { locationId, userLat, userLng, photo } = verificationData;

  // Căutăm locația în lista cardului
  const targetLocation = card.locations.find(loc => loc.locationId === locationId);
  if (!targetLocation) {
    return {
      success: false,
      status: 400,
      error: `Locația cu ID-ul '${locationId}' nu aparține acestui card de bingo.`
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

  // Verificăm coordonatele utilizatorului
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
