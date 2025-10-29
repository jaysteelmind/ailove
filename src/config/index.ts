/**
 * Application Configuration
 * Centralized config with environment variable validation
 */

import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

/**
 * Validates required environment variables
 */
function validateEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Application Configuration
 */
export const config = {
  // Application
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiVersion: process.env.API_VERSION ?? 'v1',

  // Database
  database: {
    url: validateEnv('DATABASE_URL'),
  },

  // Qdrant Vector Database
  qdrant: {
    url: validateEnv('QDRANT_URL', 'http://localhost:6333'),
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: 'user_profiles',
    vectorSize: 768,
  },

  // Redis Cache
  redis: {
    url: validateEnv('REDIS_URL', 'redis://localhost:6379'),
    password: process.env.REDIS_PASSWORD,
    ttl: {
      rbsScore: 3600,      // 1 hour
      embedding: 86400,    // 24 hours
      session: 900,        // 15 minutes
    },
  },

  // Grok AI (X.AI)
  grok: {
    apiKey: validateEnv('GROK_API_KEY'),
    apiUrl: process.env.GROK_API_URL ?? 'https://api.x.ai/v1',
    model: 'grok-beta',
    timeout: 15000, // 15s
  },

  // OpenAI
  openai: {
    apiKey: validateEnv('OPENAI_API_KEY'),
    embeddingModel: 'text-embedding-3-large',
    embeddingDimensions: 768,
  },

  // JWT Authentication
  jwt: {
    secret: validateEnv('JWT_SECRET'),
    refreshSecret: validateEnv('JWT_REFRESH_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  // RBS Algorithm Configuration
  rbs: {
    weights: {
      alpha: parseFloat(process.env.RBS_ALPHA ?? '0.45'),
      beta: parseFloat(process.env.RBS_BETA ?? '0.30'),
      gamma: parseFloat(process.env.RBS_GAMMA ?? '0.25'),
      delta: parseFloat(process.env.RBS_DELTA ?? '0.15'),
    },
    subspaces: [
      { name: 'values' as const, start: 0, end: 128, weight: 0.30 },
      { name: 'interests' as const, start: 128, end: 384, weight: 0.25 },
      { name: 'communication' as const, start: 384, end: 448, weight: 0.20 },
      { name: 'lifestyle' as const, start: 448, end: 544, weight: 0.15 },
      { name: 'goals' as const, start: 544, end: 624, weight: 0.10 },
    ],
  },

  // Performance Targets (milliseconds)
  performance: {
    rbsPipeline: parseInt(process.env.RBS_PIPELINE_TIMEOUT_MS ?? '300', 10),
    vectorSearch: parseInt(process.env.VECTOR_SEARCH_TIMEOUT_MS ?? '200', 10),
    dbQuery: parseInt(process.env.DB_QUERY_TIMEOUT_MS ?? '100', 10),
  },

  // Causal Uplift (Modal.com)
  modal: {
    tokenId: process.env.MODAL_TOKEN_ID,
    tokenSecret: process.env.MODAL_TOKEN_SECRET,
    deploymentName: process.env.MODAL_DEPLOYMENT_NAME ?? 'ailove-causal-uplift',
  },

  // Logging & Monitoring
  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
    sentryDsn: process.env.SENTRY_DSN,
  },

  // Feature Flags
  features: {
    aiCoaching: process.env.ENABLE_AI_COACHING === 'true',
    causalUplift: process.env.ENABLE_CAUSAL_UPLIFT === 'true',
    safetyConstraints: process.env.ENABLE_SAFETY_CONSTRAINTS === 'true',
  },
} as const;

/**
 * Type-safe config export
 */
export type Config = typeof config;
