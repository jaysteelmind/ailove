/**
 * GET /api/health
 * 
 * Health check endpoint for monitoring
 * 
 * Performance Target: <100ms
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { QdrantService } from '@/lib/services/QdrantService';
import { CacheRepository } from '@/lib/repositories/CacheRepository';
import { GrokService } from '@/lib/services/GrokService';
import { EmbeddingService } from '@/lib/services/EmbeddingService';
import { successResponse, errorResponse, HttpStatus } from '@/lib/utils/api-response';

const prisma = new PrismaClient();

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {} as Record<string, { status: string; latency?: number }>,
  };

  let allHealthy = true;

  // Check PostgreSQL
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    allHealthy = false;
    health.services.database = { status: 'unhealthy' };
  }

  // Check Qdrant
  try {
    const start = Date.now();
    const qdrant = new QdrantService();
    const isHealthy = await qdrant.healthCheck();
    health.services.qdrant = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      latency: Date.now() - start,
    };
    if (!isHealthy) allHealthy = false;
  } catch (error) {
    allHealthy = false;
    health.services.qdrant = { status: 'unhealthy' };
  }

  // Check Redis
  try {
    const start = Date.now();
    const cache = new CacheRepository();
    await cache.set('health_check', 'ok', 10);
    await cache.get('health_check');
    health.services.redis = {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    allHealthy = false;
    health.services.redis = { status: 'unhealthy' };
  }

  // Check Grok API (optional - can be slow)
  const checkGrok = process.env.HEALTH_CHECK_GROK === 'true';
  if (checkGrok) {
    try {
      const start = Date.now();
      const grok = new GrokService();
      const isHealthy = await grok.healthCheck();
      health.services.grok = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        latency: Date.now() - start,
      };
      if (!isHealthy) allHealthy = false;
    } catch (error) {
      health.services.grok = { status: 'unhealthy' };
    }
  }

  // Check OpenAI API (optional - can be slow)
  const checkOpenAI = process.env.HEALTH_CHECK_OPENAI === 'true';
  if (checkOpenAI) {
    try {
      const start = Date.now();
      const cache = new CacheRepository();
      const embedding = new EmbeddingService(cache);
      const isHealthy = await embedding.healthCheck();
      health.services.openai = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        latency: Date.now() - start,
      };
      if (!isHealthy) allHealthy = false;
    } catch (error) {
      health.services.openai = { status: 'unhealthy' };
    }
  }

  health.status = allHealthy ? 'healthy' : 'degraded';

  const statusCode = allHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

  return NextResponse.json(
    allHealthy
      ? successResponse(health)
      : errorResponse('SERVICE_DEGRADED', 'One or more services are unhealthy', health),
    { status: statusCode }
  );
}
