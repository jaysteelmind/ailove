/**
 * Cache Repository
 * Redis-based caching layer for performance optimization
 * 
 * Handles:
 * - Session management (JWT tokens)
 * - RBS score caching (TTL: 1 hour)
 * - Embedding caching (TTL: 24 hours)
 * - Match candidate caching (TTL: 30 minutes)
 * 
 * Performance: <10ms p95 for all operations
 * Complexity: O(1) for all operations (Redis hash tables)
 */

import Redis from 'ioredis';
import type { RBSScore } from '../types/rbs.types';

export interface CacheConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

export class CacheRepository {
  private redis: Redis;

  // TTL constants (in seconds)
  private readonly SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
  private readonly RBS_SCORE_TTL = 60 * 60; // 1 hour
  private readonly EMBEDDING_TTL = 60 * 60 * 24; // 24 hours
  private readonly CANDIDATE_TTL = 60 * 30; // 30 minutes

  constructor(config?: CacheConfig) {
    this.redis = new Redis({
      host: config?.host || process.env.REDIS_HOST || 'localhost',
      port: config?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config?.password || process.env.REDIS_PASSWORD,
      db: config?.db || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Store session data
   * 
   * @param sessionId - Session identifier
   * @param data - Session data
   * @param ttl - Time to live in seconds (optional)
   * 
   * Time Complexity: O(1)
   * Target Latency: <10ms
   */
  async setSession(sessionId: string, data: any, ttl?: number): Promise<void> {
    const key = `session:${sessionId}`;
    await this.redis.setex(key, ttl || this.SESSION_TTL, JSON.stringify(data));
  }

  /**
   * Get session data
   * 
   * @param sessionId - Session identifier
   * @returns Session data or null
   * 
   * Time Complexity: O(1)
   * Target Latency: <5ms
   */
  async getSession(sessionId: string): Promise<any | null> {
    const key = `session:${sessionId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Delete session
   * 
   * @param sessionId - Session identifier
   * 
   * Time Complexity: O(1)
   * Target Latency: <5ms
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    await this.redis.del(key);
  }

  /**
   * Extend session TTL
   * 
   * @param sessionId - Session identifier
   * @param ttl - New TTL in seconds
   * 
   * Time Complexity: O(1)
   * Target Latency: <5ms
   */
  async extendSession(sessionId: string, ttl?: number): Promise<void> {
    const key = `session:${sessionId}`;
    await this.redis.expire(key, ttl || this.SESSION_TTL);
  }

  // ============================================
  // RBS Score Caching
  // ============================================

  /**
   * Cache RBS score for a user pair
   * 
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @param score - RBS score data
   * 
   * Time Complexity: O(1)
   * Target Latency: <10ms
   */
  async cacheRbsScore(userId1: string, userId2: string, score: RBSScore): Promise<void> {
    const key = this.getRbsScoreKey(userId1, userId2);
    await this.redis.setex(key, this.RBS_SCORE_TTL, JSON.stringify(score));
  }

  /**
   * Get cached RBS score
   * 
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @returns Cached RBS score or null
   * 
   * Time Complexity: O(1)
   * Target Latency: <5ms
   */
  async getRbsScore(userId1: string, userId2: string): Promise<RBSScore | null> {
    const key = this.getRbsScoreKey(userId1, userId2);
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Generate consistent key for RBS score (order-independent)
   */
  private getRbsScoreKey(userId1: string, userId2: string): string {
    const sortedIds = [userId1, userId2].sort();
    return `rbs:${sortedIds[0]}:${sortedIds[1]}`;
  }

  // ============================================
  // Embedding Caching
  // ============================================

  /**
   * Cache user embedding
   * 
   * @param userId - User ID
   * @param embedding - 768-dim embedding vector
   * 
   * Time Complexity: O(1)
   * Target Latency: <10ms
   */
  async cacheEmbedding(userId: string, embedding: number[]): Promise<void> {
    const key = `embedding:${userId}`;
    await this.redis.setex(key, this.EMBEDDING_TTL, JSON.stringify(embedding));
  }

  /**
   * Get cached embedding
   * 
   * @param userId - User ID
   * @returns Cached embedding or null
   * 
   * Time Complexity: O(1)
   * Target Latency: <5ms
   */
  async getEmbedding(userId: string): Promise<number[] | null> {
    const key = `embedding:${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Batch cache embeddings
   * 
   * @param embeddings - Map of userId to embedding
   * 
   * Time Complexity: O(n)
   * Target Latency: <50ms for n=10
   */
  async batchCacheEmbeddings(embeddings: Map<string, number[]>): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const [userId, embedding] of embeddings.entries()) {
      const key = `embedding:${userId}`;
      pipeline.setex(key, this.EMBEDDING_TTL, JSON.stringify(embedding));
    }

    await pipeline.exec();
  }

  // ============================================
  // Match Candidate Caching
  // ============================================

  /**
   * Cache match candidates for a user
   * 
   * @param userId - User ID
   * @param candidates - Array of candidate user IDs
   * 
   * Time Complexity: O(n)
   * Target Latency: <10ms
   */
  async cacheCandidates(userId: string, candidates: string[]): Promise<void> {
    const key = `candidates:${userId}`;
    await this.redis.setex(key, this.CANDIDATE_TTL, JSON.stringify(candidates));
  }

  /**
   * Get cached candidates
   * 
   * @param userId - User ID
   * @returns Array of candidate IDs or null
   * 
   * Time Complexity: O(1)
   * Target Latency: <5ms
   */
  async getCandidates(userId: string): Promise<string[] | null> {
    const key = `candidates:${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Invalidate candidates cache for a user
   * 
   * @param userId - User ID
   * 
   * Time Complexity: O(1)
   * Target Latency: <5ms
   */
  async invalidateCandidates(userId: string): Promise<void> {
    const key = `candidates:${userId}`;
    await this.redis.del(key);
  }

  // ============================================
  // Cache Statistics
  // ============================================

  /**
   * Get cache hit/miss statistics
   * 
   * @returns Cache statistics
   * 
   * Time Complexity: O(1)
   * Target Latency: <10ms
   */
  async getStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
  }> {
    const info = await this.redis.info('stats');
    const lines = info.split('\r\n');

    let hits = 0;
    let misses = 0;

    for (const line of lines) {
      if (line.startsWith('keyspace_hits:')) {
        hits = parseInt(line.split(':')[1] || '0');
      } else if (line.startsWith('keyspace_misses:')) {
        misses = parseInt(line.split(':')[1] || '0');
      }
    }

    const total = hits + misses;
    const hitRate = total > 0 ? hits / total : 0;

    return { hits, misses, hitRate };
  }

  /**
   * Get total number of cached keys
   * 
   * @returns Key count
   * 
   * Time Complexity: O(1)
   * Target Latency: <5ms
   */
  async getKeyCount(): Promise<number> {
    return this.redis.dbsize();
  }

  /**
   * Clear all cache (use with caution)
   * 
   * Time Complexity: O(n)
   * Target Latency: Variable
   */
  async clearAll(): Promise<void> {
    await this.redis.flushdb();
  }

  // ============================================
  // General Cache Operations
  // ============================================

  /**
   * Set arbitrary cache key
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   * 
   * Time Complexity: O(1)
   * Target Latency: <10ms
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } else {
      await this.redis.set(key, JSON.stringify(value));
    }
  }

  /**
   * Get arbitrary cache key
   * 
   * @param key - Cache key
   * @returns Cached value or null
   * 
   * Time Complexity: O(1)
   * Target Latency: <5ms
   */
  async get(key: string): Promise<any | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Delete cache key
   * 
   * @param key - Cache key
   * 
   * Time Complexity: O(1)
   * Target Latency: <5ms
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Check if key exists
   * 
   * @param key - Cache key
   * @returns True if exists
   * 
   * Time Complexity: O(1)
   * Target Latency: <5ms
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Health check
   * 
   * @returns True if Redis is responsive
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}
