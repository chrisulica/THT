import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import aiIntegrationsRouter from './ai_integrations/routes.js';
import treasureHuntRouter from './treasure_hunt/routes.js';
import usersRouter from './users/routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Configurare CORS pentru a permite frontend-ului Vite de pe localhost să apeleze backend-ul
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root & Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend server is running',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Module routes
app.use('/api/ai_integrations', aiIntegrationsRouter);
app.use('/api/hunt', treasureHuntRouter);
app.use('/api/treasure_hunt', treasureHuntRouter);
app.use('/api/users', usersRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});

export default app;
