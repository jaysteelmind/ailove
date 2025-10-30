import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const healthRoute = await import('./app/api/health/route.js');
    return healthRoute.GET(req as any, res as any);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const route = await import('./app/api/auth/register/route.js');
  return route.POST(req as any);
});

app.post('/api/auth/login', async (req, res) => {
  const route = await import('./app/api/auth/login/route.js');
  return route.POST(req as any);
});

app.post('/api/auth/refresh', async (req, res) => {
  const route = await import('./app/api/auth/refresh/route.js');
  return route.POST(req as any);
});

app.post('/api/auth/logout', async (req, res) => {
  const route = await import('./app/api/auth/logout/route.js');
  return route.POST(req as any);
});

// User routes
app.get('/api/users/profile', async (req, res) => {
  const route = await import('./app/api/users/profile/route.js');
  return route.GET(req as any);
});

app.patch('/api/users/profile', async (req, res) => {
  const route = await import('./app/api/users/profile/route.js');
  return route.PATCH(req as any);
});

// Chat routes
app.post('/api/chat/message', async (req, res) => {
  const route = await import('./app/api/chat/message/route.js');
  return route.POST(req as any);
});

app.get('/api/chat/history', async (req, res) => {
  const route = await import('./app/api/chat/history/route.js');
  return route.GET(req as any);
});

// Match routes
app.get('/api/matches/discover', async (req, res) => {
  const route = await import('./app/api/matches/discover/route.js');
  return route.GET(req as any);
});

app.get('/api/matches/mutual', async (req, res) => {
  const route = await import('./app/api/matches/mutual/route.js');
  return route.GET(req as any);
});

app.post('/api/matches/:id/accept', async (req, res) => {
  const route = await import('./app/api/matches/[id]/accept/route.js');
  return route.POST(req as any, { params: { id: req.params.id } });
});

app.post('/api/matches/:id/reject', async (req, res) => {
  const route = await import('./app/api/matches/[id]/reject/route.js');
  return route.POST(req as any, { params: { id: req.params.id } });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI Love Backend Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️  Database: PostgreSQL, Redis, Qdrant`);
  console.log(`🤖 AI Services: Grok (X.AI), OpenAI Embeddings`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
