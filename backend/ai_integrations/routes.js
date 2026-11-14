import { Router } from 'express';
import { generateBingoCard, getSeasonalEvents, generateCompletionMessage, LOCATIONS } from './aiService.js';

const router = Router();

// ── POST /api/ai_integrations/generate-bingo ─────────────────────────────────
/**
 * Body:
 * {
 *   prefs: {
 *     distantaMaxima: number,
 *     genFilm: string,          // "comedie" | "actiune" | "drama" | "romantic"
 *     tipMancare: string,       // "picant" | "sarat" | "dulce" | "traditional"
 *     bautura: string,          // "ceai" | "cafea" | "alcool" | "suc"
 *     domenii: string[],        // ["stiinta","arta","istorie","natura"]
 *     hobby: string             // "citit" | "sport" | "crafting" | "filme"
 *   },
 *   alreadyVisited: number[],   // id-uri locații deja vizitate
 *   bingoSize: number,          // 5 sau 9 (default 9)
 *   date: string                // ISO date string (optional)
 * }
 */
router.post('/generate-bingo', async (req, res) => {
  try {
    const { prefs = {}, alreadyVisited = [], bingoSize = 9, date } = req.body;

    if (![5, 9].includes(Number(bingoSize))) {
      return res.status(400).json({ error: 'bingoSize trebuie să fie 5 sau 9.' });
    }

    const now = date ? new Date(date) : new Date();
    if (isNaN(now.getTime())) {
      return res.status(400).json({ error: 'Formatul câmpului `date` este invalid.' });
    }

    const result = await generateBingoCard(prefs, alreadyVisited, Number(bingoSize), now);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[POST /generate-bingo]', err);
    return res.status(500).json({ error: 'Eroare internă la generarea cardului Bingo.' });
  }
});

// ── GET /api/ai_integrations/events ──────────────────────────────────────────
/**
 * Query params: ?month=11  (1-12, optional – default luna curentă)
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
 *   userName: string,
 *   visitedLocationIds: number[],
 *   prefs: { genFilm, tipMancare, bautura, hobby }
 * }
 */
router.post('/completion-message', async (req, res) => {
  try {
    const { userName, visitedLocationIds = [], prefs = {} } = req.body;

    if (!userName || typeof userName !== 'string') {
      return res.status(400).json({ error: 'Câmpul `userName` este obligatoriu.' });
    }
    if (!Array.isArray(visitedLocationIds) || visitedLocationIds.length === 0) {
      return res.status(400).json({ error: 'Lista `visitedLocationIds` nu poate fi goală.' });
    }

    const visited = LOCATIONS.filter(l => visitedLocationIds.includes(l.id));
    const result  = await generateCompletionMessage(userName.trim(), visited, prefs);
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
