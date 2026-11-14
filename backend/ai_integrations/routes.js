import { Router } from 'express';
import { generateBingoCard, getSeasonalEvents, generateCompletionMessage, LOCATIONS } from './aiService.js';

const router = Router();

// ── POST /api/ai_integrations/generate-bingo ─────────────────────────────────
/**
 * Body:
 * {
 *   prefs: { ... } | preferences: { ... },
 *   alreadyVisited: number[] | visitedLocations: number[],
 *   bingoSize: 5 | 9,
 *   date: string (optional)
 * }
 */
router.post('/generate-bingo', async (req, res) => {
  try {
    const body = req.body || {};

    // Suport flexibil pentru prefs sau preferences sau câmpurile direct în body
    const rawPrefs = body.prefs || body.preferences || body;

    // Suport flexibil pentru alreadyVisited / visitedLocations
    const alreadyVisited = body.alreadyVisited || body.visitedLocations || body.visited || [];

    // Dimensiune card: acceptă 5 sau 9 (default 9 dacă e omis sau diferit)
    const rawSize = body.bingoSize ?? body.size ?? 9;
    const bingoSize = [5, 9].includes(Number(rawSize)) ? Number(rawSize) : 9;

    const date = body.date;
    const now = date ? new Date(date) : new Date();
    const validDate = isNaN(now.getTime()) ? new Date() : now;

    const result = await generateBingoCard(rawPrefs, alreadyVisited, bingoSize, validDate);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[POST /generate-bingo]', err);
    return res.status(500).json({ error: 'Eroare internă la generarea cardului Bingo.' });
  }
});

// ── GET /api/ai_integrations/events ──────────────────────────────────────────
/**
 * Query params: ?month=11 (1-12, optional – default luna curentă)
 */
router.get('/events', async (req, res) => {
  try {
    let month = parseInt(req.query.month, 10);
    if (isNaN(month) || month < 1 || month > 12) {
      month = new Date().getMonth() + 1;
    }

    const result = await getSeasonalEvents(month);
    return res.json({ success: true, month, ...result });
  } catch (err) {
    console.error('[GET /events]', err);
    return res.status(500).json({ error: 'Eroare la preluarea evenimentelor.' });
  }
});

// ── POST /api/ai_integrations/completion-message ──────────────────────────────
/**
 * Body:
 * {
 *   userName | username | name: string,
 *   visitedLocationIds | visitedIds: number[],
 *   prefs | preferences: object
 * }
 */
router.post('/completion-message', async (req, res) => {
  try {
    const body = req.body || {};

    const rawName = body.userName ?? body.username ?? body.name;
    const userName = (typeof rawName === 'string' && rawName.trim().length > 0)
      ? rawName.trim()
      : 'Exploratorule';

    const rawVisited = body.visitedLocationIds ?? body.visitedIds ?? body.visitedLocations ?? body.locations ?? [];
    
    // Extrage id-urile numerice dacă sunt transmise ca array de numere sau obiecte
    const visitedIds = Array.isArray(rawVisited)
      ? rawVisited.map(item => (typeof item === 'object' && item !== null ? (item.id ?? item.locationId) : item))
                  .map(Number)
                  .filter(n => !isNaN(n) && n > 0)
      : [];

    const rawPrefs = body.prefs ?? body.preferences ?? {};

    // Căutăm locațiile complete pe baza ID-urilor transmise
    const visitedLocations = LOCATIONS.filter(l => visitedIds.includes(l.id));

    const result = await generateCompletionMessage(userName, visitedLocations, rawPrefs);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[POST /completion-message]', err);
    return res.status(500).json({ error: 'Eroare la generarea mesajului final.' });
  }
});

// ── GET /api/ai_integrations ──────────────────────────────────────────────────
router.get('/', (_req, res) => {
  res.json({ message: 'AI Integrations module endpoint is working' });
});

export default router;
