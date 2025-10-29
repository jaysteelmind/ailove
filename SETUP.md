# AI Love Dating Platform - Setup Guide

Complete setup guide for local development and production deployment.

---

## Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis
- Qdrant 1.7+
- npm 10+

---

## 1. Environment Setup

### Clone Repository
```bash
git clone https://github.com/jaysteelmind/ailove.git
cd ailove
```

### Install Dependencies
```bash
npm install
```

### Configure Environment Variables

Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ailove?schema=public"

# Qdrant Vector Database
QDRANT_URL="http://localhost:6333"
QDRANT_API_KEY=""

# Redis Cache
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""

# Grok AI (X.AI)
GROK_API_KEY="your-grok-api-key"
GROK_API_URL="https://api.x.ai/v1"

# OpenAI (for embeddings)
OPENAI_API_KEY="your-openai-api-key"

# JWT Authentication
JWT_SECRET="generate-with-openssl-rand-hex-32"
JWT_REFRESH_SECRET="generate-with-openssl-rand-hex-32"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Application
NODE_ENV="development"
PORT="3000"

# RBS Algorithm Weights
RBS_ALPHA="0.45"
RBS_BETA="0.30"
RBS_GAMMA="0.25"
RBS_DELTA="0.15"
```

### Generate JWT Secrets
```bash
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For JWT_REFRESH_SECRET
```

---

## 2. Database Setup

### Start PostgreSQL
```bash
# macOS with Homebrew
brew services start postgresql@16

# Linux
sudo systemctl start postgresql

# Docker
docker run -d \
  --name ailove-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ailove \
  -p 5432:5432 \
  postgres:16
```

### Run Migrations
```bash
npx prisma migrate dev
npx prisma generate
```

### Seed Database (Optional)
```bash
npx tsx scripts/seed.ts
```

---

## 3. Vector Database Setup

### Start Qdrant
```bash
# Docker (Recommended)
docker run -d \
  --name ailove-qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant:v1.7.4

# Or install locally
# Follow: https://qdrant.tech/documentation/guides/installation/
```

### Verify Qdrant
```bash
curl http://localhost:6333/collections
```

---

## 4. Redis Setup

### Start Redis
```bash
# macOS with Homebrew
brew services start redis

# Linux
sudo systemctl start redis

# Docker
docker run -d \
  --name ailove-redis \
  -p 6379:6379 \
  redis:latest
```

### Verify Redis
```bash
redis-cli ping
# Should return: PONG
```

---

## 5. API Keys

### Get Grok API Key

1. Go to https://x.ai/api
2. Sign up for API access
3. Generate API key
4. Add to `.env` as `GROK_API_KEY`

### Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Add to `.env` as `OPENAI_API_KEY`

---

## 6. Run Application

### Development Mode
```bash
npm run dev
```

Server starts at: http://localhost:3000

### Production Mode
```bash
npm run build
npm start
```

---

## 7. Run Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm test -- tests/unit/
```

### Watch Mode
```bash
npm test -- --watch
```

### Coverage Report
```bash
npm test -- --coverage
```

---

## 8. Verify Installation

### Health Check
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "database": { "status": "healthy", "latency": 5 },
      "qdrant": { "status": "healthy", "latency": 3 },
      "redis": { "status": "healthy", "latency": 2 }
    }
  }
}
```

### Test Authentication
```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "firstName": "Test",
    "lastName": "User",
    "dateOfBirth": "1990-01-01",
    "gender": "male",
    "location": {
      "city": "San Francisco",
      "state": "CA",
      "country": "USA",
      "latitude": 37.7749,
      "longitude": -122.4194
    }
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

---

## 9. Database Schema

### View Current Schema
```bash
npx prisma studio
```

Opens web UI at: http://localhost:5555

### Reset Database
```bash
npx prisma migrate reset
```

---

## 10. Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database Connection Error
```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql postgresql://user:password@localhost:5432/ailove
```

### Qdrant Connection Error
```bash
# Check Qdrant is running
docker ps | grep qdrant

# View logs
docker logs ailove-qdrant
```

### Redis Connection Error
```bash
# Check Redis is running
redis-cli ping

# View info
redis-cli info
```

### Prisma Migration Issues
```bash
# Reset Prisma client
npx prisma generate

# Force reset migrations
npx prisma migrate reset --force
```

---

## 11. Performance Optimization

### Database Indexes

Already created in Prisma schema:
- User email (unique)
- UserTrait composite (userId, dimension, trait)
- Match pair (userId, matchedUserId)
- Match status indexes

### Redis Caching

Configured cache TTLs:
- RBS scores: 1 hour
- Embeddings: 24 hours
- Sessions: 7 days

### Qdrant Optimization

HNSW parameters:
- m: 16 (connections per layer)
- ef_construct: 100 (construction depth)

---

## 12. Production Deployment

### Environment Variables

Set production values:
```env
NODE_ENV="production"
DATABASE_URL="production-postgres-url"
REDIS_URL="production-redis-url"
QDRANT_URL="production-qdrant-url"
```

### Build
```bash
npm run build
```

### Start
```bash
npm start
```

### Process Manager (PM2)
```bash
npm install -g pm2

pm2 start npm --name "ailove" -- start
pm2 save
pm2 startup
```

---

## 13. Monitoring

### Health Checks

- Endpoint: `GET /api/health`
- Frequency: Every 30 seconds
- Alert on: Non-200 status

### Performance Metrics

Monitor:
- RBS pipeline latency (target: <300ms p95)
- Vector search latency (target: <200ms p95)
- Database query time (target: <100ms p95)
- API response times (target: <500ms p95)

---

## 14. Backup Strategy

### Database Backup
```bash
# Daily backup
pg_dump ailove > backup-$(date +%Y%m%d).sql

# Restore
psql ailove < backup-20250101.sql
```

### Qdrant Backup
```bash
# Backup storage directory
tar -czf qdrant-backup-$(date +%Y%m%d).tar.gz qdrant_storage/
```

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/jaysteelmind/ailove/issues
- Documentation: See README-PRD1.md

---

**Setup Complete!** 🎉

Your AI Love Dating Platform backend is ready for development.
