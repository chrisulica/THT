import { Router } from 'express';

const router = Router();

// GET /api/ai_integrations
router.get('/', (req, res) => {
  res.json({ message: 'AI Integrations module endpoint is working' });
});

export default router;
