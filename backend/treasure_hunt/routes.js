import { Router } from 'express';
import {
  getAllBingoCards,
  getActiveBingoCard,
  getCompletedBingoCards,
  getUserGallery,
  getBingoCardById,
  createOrGetBingoCard,
  verifyLocationVisit,
  completeBingoCard
} from './services/bingoService.js';

const router = Router();

/**
 * Middleware auxiliar pentru identificarea utilizatorului.
 * Se verifică antetul 'x-user-id' (sau 'Authorization: Bearer <token>' ca fallback).
 */
function getUserId(req) {
  const headerId = req.headers['x-user-id'];
  if (headerId && typeof headerId === 'string' && headerId.trim() !== '') {
    return headerId.trim();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1].trim();
  }

  // Utilizator demonstrativ implicit dacă nu este trimis niciun header
  return 'utilizator_demo';
}

/**
 * Middleware pentru procesarea cererilor multipart/form-data (fără dependențe externe).
 * OpenAPI specifică multipart/form-data pentru /hunt/bingos/{bingoId}/verify.
 * Dacă req.body este deja populat (ex: prin express.json), middleware-ul nu intervine.
 */
function parseMultipartIfPresent(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  
  if (contentType.includes('multipart/form-data') && (!req.body || Object.keys(req.body).length === 0)) {
    let rawData = '';
    req.setEncoding('latin1');
    req.on('data', chunk => {
      rawData += chunk;
    });
    req.on('end', () => {
      req.body = req.body || {};
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1] || boundaryMatch[2];
        const parts = rawData.split('--' + boundary);
        for (const part of parts) {
          const match = part.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?[\r\n]+(?:Content-Type:[^\r\n]+[\r\n]+)?[\r\n]*([\s\S]*?)[\r\n]*$/i);
          if (match) {
            const fieldName = match[1];
            const fileName = match[2];
            const fieldValue = match[3].replace(/[\r\n]+$/, '');
            req.body[fieldName] = fileName || fieldValue;
          }
        }
      }
      next();
    });
  } else {
    next();
  }
}

/**
 * GET /api/hunt/bingos
 * Obține toate cardurile de bingo ale utilizatorului (active și finalizate).
 * Suportă și filtrare prin query param: ?status=active sau ?status=completed
 */
router.get('/bingos', (req, res) => {
  const userId = getUserId(req);
  const statusFilter = req.query.status; // 'active' | 'completed' | undefined
  const cards = getAllBingoCards(userId, statusFilter);

  return res.status(200).json(cards);
});

/**
 * GET /api/hunt/bingos/active
 * și GET /api/hunt/active
 * Returnează cardul de bingo activ (în desfășurare) al utilizatorului.
 */
function handleGetActiveCard(req, res) {
  const userId = getUserId(req);
  const activeCard = getActiveBingoCard(userId);

  if (!activeCard) {
    return res.status(200).json({
      hasActiveCard: false,
      message: 'Nu există un card de bingo activ în acest moment.',
      card: null
    });
  }

  return res.status(200).json({
    hasActiveCard: true,
    bingoId: activeCard.bingoId,
    card: activeCard
  });
}
router.get('/bingos/active', handleGetActiveCard);
router.get('/active', handleGetActiveCard);

/**
 * GET /api/hunt/bingos/completed
 * și GET /api/hunt/completed (sau /bingos/history)
 * Returnează lista cardurilor de bingo finalizate anterior de utilizator.
 */
function handleGetCompletedCards(req, res) {
  const userId = getUserId(req);
  const completedCards = getCompletedBingoCards(userId);

  return res.status(200).json(completedCards);
}
router.get('/bingos/completed', handleGetCompletedCards);
router.get('/bingos/history', handleGetCompletedCards);
router.get('/completed', handleGetCompletedCards);

/**
 * GET /api/hunt/gallery
 * și GET /api/hunt/bingos/gallery
 * Galeria personală a utilizatorului:
 * - Pozele tuturor locațiilor vizitate (BeReal)
 * - Pozele de album generate la finalizarea cardurilor
 */
function handleGetGallery(req, res) {
  const userId = getUserId(req);
  const gallery = getUserGallery(userId);

  return res.status(200).json(gallery);
}
router.get('/gallery', handleGetGallery);
router.get('/bingos/gallery', handleGetGallery);

/**
 * POST /api/hunt/bingos
 * Creează un nou card de bingo pe baza chestionarului și a zilelor alese.
 * Respectă schema din openapi.yaml: { stayDays: int, preferences: obj }
 * Returnează 201 Created cu noul bingoId.
 */
router.post('/bingos', (req, res) => {
  const userId = getUserId(req);
  const quizData = req.body || {};

  // Validare câmpuri conform openapi.yaml
  const stayDays = quizData.stayDays || quizData.zile_ramase;
  if (!stayDays) {
    return res.status(400).json({
      error: 'Date invalide: Câmpul stayDays (sau zile_ramase) este obligatoriu.'
    });
  }

  const result = createOrGetBingoCard(userId, quizData);

  return res.status(201).json({
    message: result.message,
    bingoId: result.card.bingoId,
    card: result.card
  });
});

/**
 * GET /api/hunt/bingos/:bingoId
 * Obține detaliile și starea unui card de bingo specific după ID.
 */
router.get('/bingos/:bingoId', (req, res) => {
  const userId = getUserId(req);
  const { bingoId } = req.params;

  const card = getBingoCardById(userId, bingoId);

  if (!card) {
    return res.status(404).json({
      error: 'Cardul de bingo nu a fost găsit'
    });
  }

  return res.status(200).json(card);
});

/**
 * POST /api/hunt/bingos/:bingoId/verify
 * Validează vizita la o locație specificată (poză BeReal + GPS).
 * Suportă atât multipart/form-data (conform OpenAPI) cât și JSON.
 */
router.post('/bingos/:bingoId/verify', parseMultipartIfPresent, (req, res) => {
  const userId = getUserId(req);
  const { bingoId } = req.params;
  const verificationData = req.body || {};

  const result = verifyLocationVisit(userId, bingoId, verificationData);

  if (!result.success) {
    return res.status(result.status).json({
      error: result.error
    });
  }

  return res.status(200).json({
    message: result.message,
    location: result.location,
    allVisited: result.allVisited
  });
});

/**
 * POST /api/hunt/bingos/:bingoId/complete
 * Finalizează cardul de bingo specificat și generează poza de album + mesaj.
 */
router.post('/bingos/:bingoId/complete', (req, res) => {
  const userId = getUserId(req);
  const { bingoId } = req.params;

  const result = completeBingoCard(userId, bingoId);

  if (!result.success) {
    return res.status(result.status).json({
      error: result.error
    });
  }

  return res.status(200).json({
    message: result.message,
    bingoId: result.bingoId,
    albumPhoto: result.albumPhoto,
    completionMessage: result.completionMessage,
    card: result.card
  });
});

/**
 * GET /api/hunt/
 * Documentație și listă de rute disponibile în modulul Treasure Hunt
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Modulul Treasure Hunt Timișoara este funcțional!',
    endpoints: [
      { method: 'GET',  path: '/api/hunt/bingos',              description: 'Toate cardurile (active și finalizate). Suportă ?status=active sau ?status=completed' },
      { method: 'POST', path: '/api/hunt/bingos',              description: 'Creează un nou card de bingo (stayDays, preferences)' },
      { method: 'GET',  path: '/api/hunt/bingos/active',       description: 'Cardul de bingo activ al utilizatorului' },
      { method: 'GET',  path: '/api/hunt/bingos/completed',    description: 'Lista bingo-urilor anterioare (terminate)' },
      { method: 'GET',  path: '/api/hunt/gallery',             description: 'Galeria personală cu toate pozele (BeReal + albume)' },
      { method: 'GET',  path: '/api/hunt/bingos/:bingoId',     description: 'Detaliile unui card specific după ID' },
      { method: 'POST', path: '/api/hunt/bingos/:bingoId/verify',   description: 'Validează vizita (GPS + poză, multipart/form-data sau JSON)' },
      { method: 'POST', path: '/api/hunt/bingos/:bingoId/complete', description: 'Finalizează cardul și generează poza de album' }
    ]
  });
});

export default router;
