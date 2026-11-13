import { Router } from 'express';

const router = Router();

// GET /api/users
router.get('/', (req, res) => {
  res.json({ message: 'Users module endpoint is working' });
});

export default router;
