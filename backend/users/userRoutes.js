/**
 * userRoutes.js  (also exported as routes.js via re-export in routes.js)
 * Maps HTTP verbs + paths to controller functions.
 *
 * Public endpoints:
 *   POST /api/users/register
 *   POST /api/users/login
 *
 * Protected endpoints (require Bearer token):
 *   GET  /api/users/me
 */

import { Router } from 'express';
import { register, login, getMe } from './userController.js';
import { requireAuth } from './authMiddleware.js';

const router = Router();

// Public
router.post('/register', register);
router.post('/login',    login);

// Protected
router.get('/me', requireAuth, getMe);

export default router;
