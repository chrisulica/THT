import { Router } from 'express';
import {
  getAllBingoCards,
  getBingoCardById,
  createOrGetBingoCard,
  verifyLocationVisit,
  completeBingoCard
} from './services/bingoService.js';

const router = Router();

/**
 * Middleware auxiliar pentru identificarea utilizatorului.
 * Conform cerinței: se folosește header-ul 'x-user-id' (sau Bearer token ca fallback).
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

  // Utilizator implicit dacă nu este trimis niciun header
  return 'utilizator_demo';
}

/**
 * GET /api/hunt/bingos
 * Obține toate cardurile de bingo ale utilizatorului (active și finalizate).
 */
router.get('/bingos', (req, res) => {
  const userId = getUserId(req);
  const cards = getAllBingoCards(userId);

  return res.status(200).json(cards);
});

/**
 * POST /api/hunt/bingos
 * Creează un card nou de bingo pe baza chestionarului sau returnează cardul activ existent.
 * Dacă utilizatorul are deja un card activ în progres, nu se resetează progresul.
 */
router.post('/bingos', (req, res) => {
  const userId = getUserId(req);
  const quizData = req.body || {};

  const result = createOrGetBingoCard(userId, quizData);

  // Returnăm 201 (Created) conform specificației OpenAPI
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
 * Validează vizita la o locație specifică (verificare distanță GPS + poză).
 */
router.post('/bingos/:bingoId/verify', (req, res) => {
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
 * Finalizează cardul de bingo dacă toate locațiile au fost vizitate și generează poza de album.
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
 * Rute de compatibilitate directă la nivel rădăcină (pentru verificări simple)
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Modulul Treasure Hunt Timișoara este funcțional!',
    endpoints: [
      'GET  /api/hunt/bingos',
      'POST /api/hunt/bingos',
      'GET  /api/hunt/bingos/:bingoId',
      'POST /api/hunt/bingos/:bingoId/verify',
      'POST /api/hunt/bingos/:bingoId/complete'
    ]
  });
});

export default router;
