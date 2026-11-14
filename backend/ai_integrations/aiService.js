/**
 * aiService.js  –  ESM Production Version
 * Serviciul AI central pentru Treasure Hunt Timișoara.
 *
 * Caracteristici cheie:
 *   1. Normalizare exhaustivă a input-urilor (lowercase, fără diacritice, compatibilitate tipuri string/array/number).
 *   2. Relaxare progresivă a filtrelor (distanță -> locații vizitate anterior), garantând că nu returnează
 *      niciodată un card incomplet sau gol.
 *   3. Integrare OpenAI opțională (GPT-4o-mini) cu fallback silențios la algoritmul local de potrivire.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Date locații ─────────────────────────────────────────────────────────────
const LOCATIONS = JSON.parse(
  readFileSync(join(__dirname, 'locations.json'), 'utf-8')
);

const OPENAI_KEY = process.env.OPENAI_API_KEY || null;

// ── Helper: Normalizare text (lowercase + strip diacritice) ───────────────────

/**
 * Curăță și normalizează un string: lowercase, trim, eliminare diacritice românești/accente.
 * Ex: "Acțiune" -> "actiune", "Știință" -> "stiinta", "Tradițional" -> "traditional"
 *
 * @param {any} val
 * @returns {string}
 */
export function cleanString(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalizează array sau string de domenii / categorii într-o listă de string-uri curate.
 * Acceptă: "arta, natura" | ["Artă", "Natură"] | "Istorie" | null
 *
 * @param {any} input
 * @returns {string[]}
 */
export function normalizeDomenii(input) {
  if (!input) return [];

  let items = [];
  if (Array.isArray(input)) {
    items = input;
  } else if (typeof input === 'string') {
    // Împarte după virgulă, punct și virgulă sau slash
    items = input.split(/[,;/]+/);
  } else {
    items = [String(input)];
  }

  return items
    .map(cleanString)
    .filter(item => item.length > 0);
}

/**
 * Normalizează complet preferințele utilizatorului primite din frontend,
 * acceptând diverse convenții de denumire (RO/EN, camelCase, snake_case).
 *
 * @param {Object} rawPrefs
 * @returns {Object}
 */
export function normalizePreferences(rawPrefs = {}) {
  const p = (rawPrefs && typeof rawPrefs === 'object') ? rawPrefs : {};

  // Distanță maximă (km) - fallback 10 km
  const rawDist = p.distantaMaxima ?? p.maxDistance ?? p.maxDistanceKm ?? p.distance;
  const numDist = Number(rawDist);
  const distantaMaxima = (!isNaN(numDist) && numDist > 0) ? numDist : 10;

  // Zile ședere - fallback 1
  const rawDays = p.stayDays ?? p.days ?? p.zileSedere;
  const numDays = Number(rawDays);
  const stayDays = (!isNaN(numDays) && numDays > 0) ? Math.floor(numDays) : 1;

  // Gen film
  const rawFilm = p.genFilm ?? p.movie ?? p.favoriteMovie;
  const genFilm = cleanString(rawFilm);

  // Mâncare
  const rawFood = p.tipMancare ?? p.food ?? p.favoriteFood;
  const tipMancare = cleanString(rawFood);

  // Băutură
  const rawDrink = p.bautura ?? p.drink ?? p.favoriteDrink;
  const bautura = cleanString(rawDrink);

  // Hobby
  const rawHobby = p.hobby ?? p.hobbies;
  const hobby = cleanString(rawHobby);

  // Domenii (acceptă domenii, domain, category, categories)
  const rawDomenii = p.domenii ?? p.domain ?? p.category ?? p.categories;
  const domenii = normalizeDomenii(rawDomenii);

  return {
    distantaMaxima,
    stayDays,
    genFilm,
    tipMancare,
    bautura,
    hobby,
    domenii,
  };
}

/**
 * Normalizează lista de ID-uri deja vizitate.
 * Acceptă: [1, "2", 3] sau [{ id: 1 }, { locationId: 2 }]
 *
 * @param {any} list
 * @returns {number[]}
 */
export function normalizeVisitedList(list) {
  if (!Array.isArray(list)) return [];

  const ids = [];
  for (const item of list) {
    if (typeof item === 'number' && !isNaN(item)) {
      ids.push(item);
    } else if (typeof item === 'string') {
      const num = Number(item.trim());
      if (!isNaN(num)) ids.push(num);
    } else if (item && typeof item === 'object') {
      const candidate = item.id ?? item.locationId ?? item.locId;
      const num = Number(candidate);
      if (!isNaN(num)) ids.push(num);
    }
  }
  return [...new Set(ids)];
}

/** Deduce anotimpul curent din lună (1-12). */
export function getSeason(month) {
  const m = Number(month);
  if ([12, 1, 2].includes(m))  return 'iarna';
  if ([3, 4, 5].includes(m))   return 'primavara';
  if ([6, 7, 8].includes(m))   return 'vara';
  return 'toamna';
}

// ── Algoritm de Scoring ───────────────────────────────────────────────────────

/**
 * Calculează scorul de potrivire al unei locații față de preferințele normalizate.
 * Fiecare criteriu potrivit adaugă puncte ponderate.
 *
 * @param {Object} loc       - Locația din locations.json
 * @param {Object} prefs     - Preferințe normalizate
 * @param {string} season    - Anotimp ("primavara", "vara", "toamna", "iarna")
 * @returns {number}
 */
export function scoreLocation(loc, prefs, season) {
  let score = 0;

  const locSeasons = (loc.anotimp || []).map(cleanString);
  const locFilms   = (loc.genFilm || []).map(cleanString);
  const locFoods   = (loc.tipMancare || []).map(cleanString);
  const locDrinks  = (loc.bautura || []).map(cleanString);
  const locDomains = (loc.domeniu || []).map(cleanString);
  const locHobbies = (loc.hobby || []).map(cleanString);

  // 1. Hobby (pondere majoră +18 puncte)
  const matchesHobby = prefs.hobby && locHobbies.some(h => h.includes(prefs.hobby) || prefs.hobby.includes(h));
  if (matchesHobby) {
    score += 18;
  }

  // 2. Băutură (pondere majoră +16 puncte - cafenea, ceainărie etc.)
  const matchesDrink = prefs.bautura && locDrinks.some(d => d.includes(prefs.bautura) || prefs.bautura.includes(d));
  if (matchesDrink) {
    score += 16;
  }

  // 3. Domenii de interes (+14 puncte per domeniu potrivit)
  let matchedDomainsCount = 0;
  if (prefs.domenii && prefs.domenii.length > 0) {
    for (const d of prefs.domenii) {
      if (locDomains.some(ld => ld.includes(d) || d.includes(ld))) {
        score += 14;
        matchedDomainsCount++;
      }
    }
  }

  // 4. Tip mâncare (+8 puncte)
  if (prefs.tipMancare && locFoods.some(f => f.includes(prefs.tipMancare) || prefs.tipMancare.includes(f))) {
    score += 8;
  }

  // 5. Gen film (+6 puncte)
  if (prefs.genFilm && locFilms.some(f => f.includes(prefs.genFilm) || prefs.genFilm.includes(f))) {
    score += 6;
  }

  // 6. Bonus sinergie (+6 puncte dacă bifează atât băutura/mâncarea cât și activitatea/domeniul)
  if (matchesDrink && (matchesHobby || matchedDomainsCount > 0)) {
    score += 6;
  }

  // 7. Distanță (+4 dacă e în rază; penalizare ușoară dacă depășește)
  if (loc.distantaFataDeCentru <= prefs.distantaMaxima) {
    score += 4;
  } else {
    const excess = loc.distantaFataDeCentru - prefs.distantaMaxima;
    score -= Math.min(6, excess * 1.5);
  }

  // 8. Anotimp (+3 pentru sezonul curent, +1 pentru toate)
  if (locSeasons.includes(season)) {
    score += 3;
  } else if (locSeasons.includes('toate')) {
    score += 1;
  }

  return score;
}

// ── Relaxare Progresivă a Filtrelor ───────────────────────────────────────────

/**
 * Selectează locațiile optime cu relaxare treptată a filtrelor:
 *   Pas 1: Caută locații nevizitate în raza distantaMaxima
 *   Pas 2: Dacă nu sunt suficiente pentru card (targetCount), mărește treptat distanța (+2km, +4km, etc.)
 *   Pas 3: Dacă tot nu sunt suficiente (utilizatorul a vizitat aproape tot orașul), permite și locații
 *          vizitate anterior (sortate după scor), astfel încât cardul să fie 100% complet.
 *
 * @param {Object}   normPrefs   - Preferințe normalizate
 * @param {number[]} visitedIds  - ID-uri vizitate
 * @param {number}   targetCount - Numărul de locații cerut (5 sau 9)
 * @param {string}   season      - Anotimpul curent
 * @returns {{ locations: Object[], relaxedDistance: boolean, relaxedVisited: boolean }}
 */
function selectLocationsWithRelaxation(normPrefs, visitedIds, targetCount, season) {
  const maxTarget = Math.min(targetCount, LOCATIONS.length);
  const visitedSet = new Set(visitedIds);

  const unvisitedAll = LOCATIONS.filter(l => !visitedSet.has(l.id));
  const visitedAll   = LOCATIONS.filter(l => visitedSet.has(l.id));

  let relaxedDistance = false;
  let relaxedVisited  = false;

  // Pas 1 & 2: Filtrare pe distanță printre locațiile nevizitate
  let currentDist = normPrefs.distantaMaxima;
  let eligibleUnvisited = unvisitedAll.filter(l => l.distantaFataDeCentru <= currentDist);

  // Relaxare treptată a distanței dacă nu sunt suficiente nevizitate în raza inițială
  while (eligibleUnvisited.length < maxTarget && eligibleUnvisited.length < unvisitedAll.length) {
    currentDist += 2.0;
    relaxedDistance = true;
    eligibleUnvisited = unvisitedAll.filter(l => l.distantaFataDeCentru <= currentDist);
  }

  // Dacă încă nu sunt suficiente, ia toate locațiile nevizitate indiferent de distanță
  if (eligibleUnvisited.length < maxTarget && unvisitedAll.length > eligibleUnvisited.length) {
    relaxedDistance = true;
    eligibleUnvisited = [...unvisitedAll];
  }

  // Scorul pentru nevizitate
  const scoredUnvisited = eligibleUnvisited
    .map(loc => ({ ...loc, _score: scoreLocation(loc, normPrefs, season) }))
    .sort((a, b) => b._score - a._score);

  const selected = scoredUnvisited.slice(0, maxTarget);

  // Pas 3: Dacă utilizatorul a vizitat aproape toate locațiile din oraș și tot nu avem suficiente
  if (selected.length < maxTarget) {
    relaxedVisited = true;
    const deficit = maxTarget - selected.length;
    const selectedIds = new Set(selected.map(l => l.id));

    // Alege din locațiile deja vizitate, sortate după scor
    const scoredVisited = visitedAll
      .filter(l => !selectedIds.has(l.id))
      .map(loc => ({ ...loc, _score: scoreLocation(loc, normPrefs, season) }))
      .sort((a, b) => b._score - a._score);

    const extra = scoredVisited.slice(0, deficit);
    selected.push(...extra);
  }

  // Elimină câmpul intern _score
  const finalLocations = selected.map(({ _score, ...rest }) => rest);

  return {
    locations: finalLocations,
    relaxedDistance,
    relaxedVisited,
  };
}

// ── Funcția 1: Generare card Bingo ────────────────────────────────────────────

/**
 * Generează un card Bingo personalizat, adaptat preferințelor din quiz.
 *
 * @param {Object}   rawPrefs       - Răspunsurile utilizatorului la chestionar
 * @param {any[]}    alreadyVisited - ID-uri sau obiecte ale locațiilor deja vizitate
 * @param {number}   bingoSize      - 5 sau 9
 * @param {Date|string} [dateInput] - Data curentă (opțional)
 * @returns {Promise<{ locations: Object[], message: string, relaxedDistance: boolean, relaxedVisited: boolean }>}
 */
async function generateBingoCard(rawPrefs = {}, alreadyVisited = [], bingoSize = 9, dateInput = new Date()) {
  const normPrefs  = normalizePreferences(rawPrefs);
  const visitedIds = normalizeVisitedList(alreadyVisited);

  // Validare dimensiune card (fallback 9 dacă e invalid)
  const targetCount = [5, 9].includes(Number(bingoSize)) ? Number(bingoSize) : 9;

  // Calcul anotimp
  const parsedDate = dateInput ? new Date(dateInput) : new Date();
  const validDate  = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const month      = validDate.getMonth() + 1;
  const season     = getSeason(month);

  // Încearcă OpenAI dacă cheia este disponibilă
  if (OPENAI_KEY) {
    try {
      const openAiResult = await _generateBingoWithOpenAI(normPrefs, visitedIds, targetCount, season);
      if (openAiResult && openAiResult.locations && openAiResult.locations.length === targetCount) {
        return openAiResult;
      }
    } catch (err) {
      console.warn('[aiService] OpenAI a eșuat, trecere automată la smart match:', err.message);
    }
  }

  // Smart match cu relaxare progresivă (garantat 100% că returnează targetCount locații)
  const { locations, relaxedDistance, relaxedVisited } = selectLocationsWithRelaxation(
    normPrefs,
    visitedIds,
    targetCount,
    season
  );

  let message = `Am pregătit ${locations.length} locații din Timișoara special pentru tine, ideale pentru ${season}! 🗺️`;
  if (relaxedVisited) {
    message = `Felicitări pentru că ai explorat deja aproape tot orașul! Am inclus cele mai bune ${locations.length} locații din Timișoara pentru un nou traseu captivant. 🌟`;
  } else if (relaxedDistance) {
    message = `Am extins ușor perimetrul pentru a-ți oferi cele mai spectaculoase ${locations.length} locații potrivite preferințelor tale! 🚀`;
  }

  return {
    locations,
    message,
    relaxedDistance,
    relaxedVisited,
  };
}

/** Varianta opțională OpenAI */
async function _generateBingoWithOpenAI(normPrefs, visitedIds, targetCount, season) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: OPENAI_KEY });

  const visitedSet = new Set(visitedIds);
  const available = LOCATIONS.filter(l => !visitedSet.has(l.id));

  // Dacă numărul de nevizitate e mai mic decât cerut, lăsăm fallback-ul local să se ocupe de relaxare
  if (available.length < targetCount) {
    return null;
  }

  const locationsText = available.map(l =>
    `ID ${l.id}: ${l.name} (${l.distantaFataDeCentru} km) | anotimp: ${l.anotimp.join(',')} | film: ${l.genFilm.join(',')} | mancare: ${l.tipMancare.join(',')} | bautura: ${l.bautura.join(',')} | domeniu: ${l.domeniu.join(',')} | hobby: ${l.hobby.join(',')}`
  ).join('\n');

  const prompt = `
Ești ghidul turistic expert al Timișoarei. Selectează exact ${targetCount} locații din lista următoare
pentru un card Bingo personalizat, adaptat preferințelor vizitatorului.

Preferințe vizitator:
- Anotimp curent: ${season}
- Distanță maximă dorită față de centru: ${normPrefs.distantaMaxima} km
- Gen film: ${normPrefs.genFilm || 'oricare'}
- Mâncare: ${normPrefs.tipMancare || 'oricare'}
- Băutură: ${normPrefs.bautura || 'oricare'}
- Domenii de interes: ${normPrefs.domenii.join(', ') || 'oricare'}
- Hobby: ${normPrefs.hobby || 'oricare'}

Locații disponibile:
${locationsText}

Răspunde STRICT cu JSON în formatul:
{ "ids": [id1, id2, ...${targetCount} ids], "message": "O propoziție călduroasă de introducere a traseului" }
`.trim();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  if (!Array.isArray(parsed.ids)) return null;

  const selectedIds = [...new Set(parsed.ids.map(Number))].slice(0, targetCount);
  const locations = LOCATIONS.filter(l => selectedIds.includes(l.id));

  if (locations.length !== targetCount) return null;

  return {
    locations,
    message: parsed.message || `Iată cele ${locations.length} locații alese pentru tine în Timișoara!`,
    relaxedDistance: false,
    relaxedVisited: false,
  };
}

// ── Funcția 2: Evenimente și activități lunare/sezoniere ──────────────────────

const SEASONAL_EVENTS = {
  primavara: [
    '🌸 Festivalul Florilor în Parcul Rozelor (mai)',
    '🎵 Plimbare muzicală și concerte pe malul Begăi',
    '🎪 Târgul de Paști în Piața Unirii',
    '🚴 Bike Day Timișoara – tur cu bicicleta prin parcurile orașului',
    '🌿 Vizitarea Parcului Botanic în floare',
  ],
  vara: [
    '🎸 PLAI Festival – cel mai mare festival multicultural din vestul României',
    '🎭 Spectacole de operă și teatru în aer liber în Parcul Rozelor',
    '🏊 Înot și activități sportive la Complexul Bega / Sala Olimpia',
    '🌅 Apus spectaculos la o plimbare cu Vaporetto pe Bega',
    '🍦 Seri culinare cu street food în Fabric și Iulius Gardens',
  ],
  toamna: [
    '🍷 Festivalul Vinului Bănățean și serbări gastronomice',
    '🎃 Halloween și expoziții alternative la FABER',
    '📚 Târgul de carte Gaudeamus și seri literare La Două Bufnițe',
    '🍂 Plimbare printre culorile toamnei în Pădurea Verde',
    '🎬 Timișoara Film Festival – proiecții de film european',
  ],
  iarna: [
    '⛸️ Patinoarul festiv în aer liber din Iulius Gardens',
    '🎄 Târgul de Crăciun din Piața Victoriei și Piața Libertății',
    '🍵 Concerte grandioase de orgă la Domul Romano-Catolic din Piața Unirii',
    '🎆 Spectacol de Revelion în centrul istoric al Timișoarei',
    '☕ Seri calde cu ceai și ciocolată caldă în cafenelele din Cetate',
  ],
};

const MONTHLY_EVENTS = {
  1:  ['🎊 Concerte de Anul Nou la Filarmonica Banatul', '⛸️ Patinaj sub luminițe festive în Iulius Gardens'],
  2:  ['💌 Seri romantice la Teatrul Național și Opera Română', '☕ Turul cafenelelor istorice din Cetate'],
  3:  ['🌸 Primele plimbări de primăvară pe faleza Begăi', '🚴 Redeschiderea sezonului velo Timișoara'],
  4:  ['🐣 Târgul de Paști și ateliere meșteșugărești în Piața Unirii', '🎨 Expoziții de primăvară la Cazarma U și FABER'],
  5:  ['🌹 Festivalul Rozelor în Parcul Rozelor', '🎵 Zilele Muzicii Bănățene la Filarmonică'],
  6:  ['🌊 Serbările Begăi – curse de bărci și activități nautice', '🎪 Festivalul Artelor Stradale'],
  7:  ['🎸 PLAI Festival la Muzeul Satului Bănățean', '🌞 Seri de cinema în aer liber'],
  8:  ['🎭 Festivalul de Operă și Operetă în Parcul Rozelor', '🛶 Plimbări cu vaporașul la apus'],
  9:  ['📚 Noaptea Cercetătorilor Europeni la Universitatea Politehnica', '🍷 Sărbătoarea Vinului în Banat'],
  10: ['🎃 Festivalul Toamnei și Art Encounters', '🍂 Excursii ghidate în Pădurea Verde'],
  11: ['🎬 Timișoara Film Festival', '📖 Târgul de Carte și ateliere culturale la Bastion'],
  12: ['🎄 Târgul de Crăciun Timișoara', '🎆 Concerte corale de colinde la Catedrala Mitropolitană'],
};

/**
 * @param {number|string} monthInput - Luna (1-12)
 * @returns {Promise<{ season: string, seasonalEvents: string[], monthlyEvents: string[] }>}
 */
async function getSeasonalEvents(monthInput) {
  let m = parseInt(monthInput, 10);
  if (isNaN(m) || m < 1 || m > 12) {
    m = new Date().getMonth() + 1;
  }

  const season = getSeason(m);
  return {
    season,
    seasonalEvents: SEASONAL_EVENTS[season] ?? [],
    monthlyEvents:  MONTHLY_EVENTS[m]  ?? [],
  };
}

// ── Funcția 3: Mesaj de felicitare final ─────────────────────────────────────

/**
 * Generează un mesaj de felicitare personalizat care îl declară pe utilizator "un adevărat timișorean".
 *
 * @param {string}   rawUserName      - Numele/prenumele utilizatorului
 * @param {Object[]} visitedLocations - Lista locațiilor vizitate
 * @param {Object}   rawPrefs         - Preferințele utilizatorului
 * @returns {Promise<{ title: string, message: string, badge: string }>}
 */
async function generateCompletionMessage(rawUserName, visitedLocations = [], rawPrefs = {}) {
  const userName  = (typeof rawUserName === 'string' && rawUserName.trim().length > 0)
    ? rawUserName.trim()
    : 'Exploratorule';

  const normPrefs = normalizePreferences(rawPrefs);
  const locList   = Array.isArray(visitedLocations) ? visitedLocations : [];

  if (OPENAI_KEY) {
    try {
      const openAiMsg = await _completionMessageOpenAI(userName, locList, normPrefs);
      if (openAiMsg && openAiMsg.title && openAiMsg.message) {
        return openAiMsg;
      }
    } catch (err) {
      console.warn('[aiService] OpenAI mesaj final a eșuat, fallback local:', err.message);
    }
  }

  return _completionMessageLocal(userName, locList, normPrefs);
}

async function _completionMessageOpenAI(userName, visitedLocations, prefs) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: OPENAI_KEY });

  const locNames = visitedLocations.map(l => l.name).filter(Boolean).join(', ') || 'Timișoara';
  const prompt = `
Generează un mesaj de felicitare plin de căldură și entuziasm în limba română pentru ${userName},
care a finalizat cu succes traseul Treasure Hunt Timișoara.
Locații cucerite: ${locNames}.
Preferințe: film=${prefs.genFilm || 'arta'}, mâncare=${prefs.tipMancare || 'tradițional'}, băutură=${prefs.bautura || 'cafea'}, hobby=${prefs.hobby || 'explorare'}.
Declară-l explicit "un adevărat timișorean" și menționează 1-2 locații cucerite.
Răspunde STRICT cu JSON de forma:
{ "title": "titlu scurt festiv", "message": "mesaj de 3-4 propoziții", "badge": "emoji simbol (ex: 🏅)" }
`.trim();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.9,
  });

  return JSON.parse(response.choices[0].message.content);
}

function _completionMessageLocal(userName, visitedLocations, prefs) {
  const count = visitedLocations.length || 5;
  const sampleLoc = visitedLocations[Math.floor(Math.random() * visitedLocations.length)]?.name
    || 'Piața Unirii';

  const hobbyCompliments = {
    sport:    'ai cucerit fiecare pas cu energie molipsitoare!',
    citit:    'ai citit printre rândurile istoriei și ai descoperit secretele ascunse ale orașului!',
    crafting: 'ai simțit măiestria și spiritul creator ce pulsează pe fiecare străduță!',
    filme:    'ai trăit aventura ca într-un scenariu de film premiat pe străzile din Cetate!',
  };

  const compliment = hobbyCompliments[prefs.hobby] || 'ai explorat fiecare colț cu entuziasm autentic!';

  return {
    title:   `🏆 Felicitări, ${userName}! Ești un adevărat timișorean!`,
    message: `Felicitări, ${userName}! Ai descoperit ${count} locații emblematice din inima Timișoarei și ${compliment} ` +
             `Amintirile din locuri precum ${sampleLoc} îți vor rămâne mereu vii. ` +
             `De astăzi, Timișoara te consideră de-al casei – un adevărat timișorean cu suflet bănățean! ` +
             `Orașul te așteaptă oricând la noi aventuri. 🌟`,
    badge:   '🏅',
  };
}

// ── Exporturi ─────────────────────────────────────────────────────────────────
export {
  generateBingoCard,
  getSeasonalEvents,
  generateCompletionMessage,
  LOCATIONS,
};
