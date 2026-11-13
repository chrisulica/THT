import { Router } from 'express';

const router = Router();

// GET /api/treasure_hunt
router.get('/', (req, res) => {
  res.json({ message: 'Treasure Hunt module endpoint is working' });
});

export default router;
