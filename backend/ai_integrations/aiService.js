/**
 * aiService.js  –  ESM version
 * Serviciul AI central pentru Treasure Hunt Timișoara.
 *
 * Moduri de funcționare:
 *   1. OPENAI  – dacă OPENAI_API_KEY e prezentă în .env, apelează GPT-4o-mini.
 *   2. SMART MATCH – algoritm local de scoring pe locations.json (niciodată eroare).
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Date ─────────────────────────────────────────────────────────────────────
const LOCATIONS = JSON.parse(
  readFileSync(join(__dirname, 'locations.json'), 'utf-8')
);

const OPENAI_KEY = process.env.OPENAI_API_KEY || null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Deduce anotimpul din lună (1-12). */
function getSeason(month) {
  if ([12, 1, 2].includes(month))  return 'iarna';
  if ([3, 4, 5].includes(month))   return 'primavara';
  if ([6, 7, 8].includes(month))   return 'vara';
  return 'toamna';
}

/**
 * Calculează scorul de potrivire al unei locații față de preferințele utilizatorului.
 * Fiecare tag care se potrivește adaugă puncte.
 */
function scoreLocation(loc, prefs, season) {
  let score = 0;

  // Anotimp (prioritate mare)
  if (loc.anotimp.includes('toate') || loc.anotimp.includes(season)) score += 3;

  // Distanță
  if (loc.distantaFataDeCentru <= (prefs.distantaMaxima ?? 10)) score += 2;

  // Gen film
  if (prefs.genFilm && loc.genFilm.includes(prefs.genFilm)) score += 2;

  // Tip mâncare
  if (prefs.tipMancare && loc.tipMancare.includes(prefs.tipMancare)) score += 2;

  // Băutură
  if (prefs.bautura && loc.bautura.includes(prefs.bautura)) score += 2;

  // Domenii (array, +1 per potrivire)
  if (Array.isArray(prefs.domenii)) {
    for (const d of prefs.domenii) {
      if (loc.domeniu.includes(d)) score += 1;
    }
  }

  // Hobby
  if (prefs.hobby && loc.hobby.includes(prefs.hobby)) score += 2;

  return score;
}

// ── Funcția 1: Generare card Bingo ────────────────────────────────────────────

/**
 * @param {Object}   prefs          – preferințele din quiz
 * @param {number[]} alreadyVisited – id-urile locațiilor deja vizitate
 * @param {number}   bingoSize      – 5 sau 9 locații pentru card
 * @param {Date}     [now=new Date()]
 * @returns {Promise<{ locations: Object[], message: string }>}
 */
async function generateBingoCard(prefs, alreadyVisited = [], bingoSize = 9, now = new Date()) {
  const month  = now.getMonth() + 1;
  const season = getSeason(month);

  const available = LOCATIONS.filter(l => !alreadyVisited.includes(l.id));

  if (OPENAI_KEY) {
    try {
      return await _generateBingoWithOpenAI(prefs, available, bingoSize, season);
    } catch (err) {
      console.warn('[aiService] OpenAI apel eșuat, fallback la smart match:', err.message);
    }
  }

  return _generateBingoSmartMatch(prefs, available, bingoSize, season);
}

/** Varianta AI reală */
async function _generateBingoWithOpenAI(prefs, available, bingoSize, season) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: OPENAI_KEY });

  const locationsText = available.map(l =>
    `ID ${l.id}: ${l.name} | tags: anotimp=${l.anotimp.join(',')}, distanta=${l.distantaFataDeCentru}km, genFilm=${l.genFilm.join(',')}, mancare=${l.tipMancare.join(',')}, bautura=${l.bautura.join(',')}, domeniu=${l.domeniu.join(',')}, hobby=${l.hobby.join(',')}`
  ).join('\n');

  const prompt = `
Ești un ghid local expert în Timișoara. Selectează exact ${bingoSize} locații din lista de mai jos
pentru un card Bingo personalizat, bazat pe preferințele vizitatorului.

Preferințe vizitator:
- Anotimp curent: ${season}
- Distanță maximă față de centru: ${prefs.distantaMaxima ?? 10} km
- Gen film preferat: ${prefs.genFilm ?? 'orice'}
- Tip mâncare preferat: ${prefs.tipMancare ?? 'orice'}
- Băutură preferată: ${prefs.bautura ?? 'orice'}
- Domenii de interes: ${(prefs.domenii ?? []).join(', ') || 'orice'}
- Hobby: ${prefs.hobby ?? 'orice'}

Locații disponibile:
${locationsText}

Răspunde DOAR cu un JSON valid de forma:
{ "ids": [id1, id2, ...${bingoSize} ids], "message": "Un mesaj scurt de prezentare a cardului (1-2 propoziții)" }
`.trim();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  const selectedIds = parsed.ids.slice(0, bingoSize);
  const locations = LOCATIONS.filter(l => selectedIds.includes(l.id));
  return { locations, message: parsed.message };
}

/** Varianta smart-match locală */
function _generateBingoSmartMatch(prefs, available, bingoSize, season) {
  const scored = available.map(l => ({
    ...l,
    _score: scoreLocation(l, prefs, season),
  }));

  scored.sort((a, b) => b._score - a._score);
  const top = scored.slice(0, bingoSize).map(({ _score, ...rest }) => rest);

  const message = `Am pregătit ${top.length} locații din Timișoara special pentru tine, perfecte pentru ${season}! 🗺️`;
  return { locations: top, message };
}

// ── Funcția 2: Evenimente / activități ale lunii ──────────────────────────────

const SEASONAL_EVENTS = {
  primavara: [
    '🌸 Festivalul Florilor în Parcul Rozelor (mai)',
    '🎵 Plimbare muzicală pe malul Begăi',
    '🎪 Târgul de Paști în Piața Unirii',
    '🚴 Bike Day Timișoara – tur cu bicicleta prin oraș',
    '🌿 Vizitarea Parcului Botanic în floare',
  ],
  vara: [
    '🎸 PLAI Festival – cel mai mare festival multicultural din vest',
    '🎭 Spectacole în aer liber la Cetatea din Timișoara',
    '🏊 Distracție la Strandul Tineretului',
    '🌅 Sunset pe malul Canalului Bega',
    '🍦 Piața de seară cu street food în Fabric',
  ],
  toamna: [
    '🍷 Festivalul Vinului Bănățean',
    '🎃 Halloween la Fabrica de Pensule',
    '📚 Librăreasa – târg de carte second-hand',
    '🍂 Plimbare printre frunze la Lacul Verde',
    '🎬 TFF – Timișoara Film Festival (ediție toamnă)',
  ],
  iarna: [
    '⛸️ Patinoarul sezonier în centrul Timișoarei',
    '🎄 Târgul de Crăciun Timișoara – cel mai mare din vest',
    '🍵 Seri de ceai și carte la Librăria Două Bufnițe',
    '🎆 Revelion în Piața Victoriei',
    '🏔️ Excursii la munte la 2h distanță (Semenic, Poiana Mărului)',
  ],
};

const MONTHLY_EVENTS = {
  1:  ['🎊 Concerte de Anul Nou la Filarmonica Banatul', '☃️ Miniexpediție la Semenic'],
  2:  ['💌 Seară romantică la Teatrul Național', "🌹 Ateliere de Valentine's Day"],
  3:  ['🌸 Expoziție foto de primăvară la Bastion', '🚲 Prima ieșire cu bicicleta pe Bega'],
  4:  ['🐣 Concerte de Paști în Piața Unirii', '🎨 Open studio la Fabrica de Pensule'],
  5:  ['🌹 Festivalul Rozelor', '🎵 Jazz in the Park – ediție Timișoara'],
  6:  ['🌊 Ziua Internațională a Mediului – acțiuni ecologice', '🎪 Festivalul Stradal'],
  7:  ['🎸 PLAI Festival', '🌞 Concerte în aer liber pe malul Begăi'],
  8:  ['🏕️ Tabere de vară pentru tineri', '🎭 Spectacole de teatru în aer liber'],
  9:  ['📚 Noaptea Cercetătorilor la UPT', '🍷 Festivalul Vinului'],
  10: ['🎃 Festivalul Halloween la Fabrica de Pensule', '🍂 Hike la Semenic în culorile toamnei'],
  11: ['🎬 Timișoara Film Festival', '📖 Târg de carte Gaudeamus'],
  12: ['🎄 Târgul de Crăciun (cel mai mare din România)', '🎆 Revelion în Piața Victoriei'],
};

/**
 * @param {number} month  – 1–12
 * @returns {Promise<{ season: string, seasonalEvents: string[], monthlyEvents: string[] }>}
 */
async function getSeasonalEvents(month) {
  const season = getSeason(month);
  return {
    season,
    seasonalEvents: SEASONAL_EVENTS[season] ?? [],
    monthlyEvents:  MONTHLY_EVENTS[month]  ?? [],
  };
}

// ── Funcția 3: Mesaj de felicitare final ─────────────────────────────────────

/**
 * @param {string}   userName         – prenumele utilizatorului
 * @param {Object[]} visitedLocations – locațiile vizitate
 * @param {Object}   prefs            – preferințele din quiz
 * @returns {Promise<{ title: string, message: string, badge: string }>}
 */
async function generateCompletionMessage(userName, visitedLocations, prefs = {}) {
  if (OPENAI_KEY) {
    try {
      return await _completionMessageOpenAI(userName, visitedLocations, prefs);
    } catch (err) {
      console.warn('[aiService] OpenAI apel eșuat, fallback:', err.message);
    }
  }
  return _completionMessageLocal(userName, visitedLocations, prefs);
}

async function _completionMessageOpenAI(userName, visitedLocations, prefs) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: OPENAI_KEY });

  const locNames = visitedLocations.map(l => l.name).join(', ');
  const prompt = `
Generează un mesaj de felicitare personalizat și entuziasmant în română pentru ${userName},
care a finalizat un traseu Treasure Hunt prin Timișoara.
Locații vizitate: ${locNames}.
Preferințele lui: film=${prefs.genFilm}, mâncare=${prefs.tipMancare}, băutură=${prefs.bautura}, hobby=${prefs.hobby}.
Declară-l "un adevărat timișorean" și menționează 1-2 locații vizitate.
Răspunde cu JSON: { "title": "titlu scurt", "message": "mesaj (3-4 propoziții)", "badge": "emoji simbol" }
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
  const count    = visitedLocations.length;
  const favLoc   = visitedLocations[Math.floor(Math.random() * count)]?.name ?? 'Timișoara';
  const hobbyMsg = prefs.hobby === 'sport'    ? 'ai dat dovadă de energie și determinare!'
                 : prefs.hobby === 'citit'    ? 'ai descoperit poveștile ascunse ale orașului!'
                 : prefs.hobby === 'crafting' ? 'ai simțit creativitatea orașului pas cu pas!'
                 : 'ai explorat orașul cu suflet deschis!';

  return {
    title:   `🏆 Felicitări, ${userName}! Ești un adevărat timișorean!`,
    message: `Bravo, ${userName}! Ai cucerit ${count} locații din inima Timișoarei și ${hobbyMsg} ` +
             `Locuri precum ${favLoc} îți vor rămâne cu siguranță în amintire. ` +
             `Timișoara te-a adoptat – acum ești cu adevărat unul de-al ei! ` +
             `Revino oricând, orașul are mereu ceva nou de oferit. 🌟`,
    badge:   '🏅',
  };
}

// ── Export ────────────────────────────────────────────────────────────────────
export { generateBingoCard, getSeasonalEvents, generateCompletionMessage, getSeason, LOCATIONS };
