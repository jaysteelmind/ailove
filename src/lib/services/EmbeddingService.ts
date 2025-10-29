/**
 * EmbeddingService - Text to Vector Conversion
 * 
 * Converts user traits and profile text into 768-dimensional embeddings
 * using OpenAI's text-embedding-3-large model.
 * 
 * Mathematical Foundation:
 * - Model: text-embedding-3-large
 * - Output Dimension: 768 (optimized for balance of quality and speed)
 * - Normalization: L2 normalized vectors
 * - Similarity Metric: Cosine similarity
 * 
 * Performance Targets:
 * - Single embedding: <500ms
 * - Batch embedding (50 texts): <2000ms
 * - Cache hit rate: >60%
 * 
 * Complexity:
 * - API call: O(n) where n = text length
 * - Batch processing: O(k * n) where k = batch size
 */

import OpenAI from 'openai';
import { config } from '../../config';
import { CacheRepository } from '../repositories/CacheRepository';

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
  model: string;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokens: number;
  model: string;
}

export class EmbeddingService {
  private openai: OpenAI;
  private cacheRepo: CacheRepository;
  private readonly model = 'text-embedding-3-large';
  private readonly dimensions = 768; // Reduced from 3072 for performance
  private readonly maxBatchSize = 50; // OpenAI batch limit

  constructor(cacheRepo?: CacheRepository) {
    const apiKey = config.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    this.openai = new OpenAI({ apiKey });
    this.cacheRepo = cacheRepo || new CacheRepository();
  }

  /**
   * Generate embedding for a single text
   * 
   * Uses L2 normalization for cosine similarity compatibility.
   * Results are cached for 24 hours.
   * 
   * Complexity: O(n) where n = text length
   * Target Latency: <500ms (cache miss), <10ms (cache hit)
   * 
   * @param text Input text to embed
   * @param userId Optional user ID for cache key
   * @returns 768-dimensional embedding vector
   */
  async generateEmbedding(
    text: string,
    userId?: string
  ): Promise<EmbeddingResult> {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Check cache first
    const cacheKey = userId
      ? `embedding:user:${userId}`
      : `embedding:text:${this.hashText(text)}`;

    const cached = await this.cacheRepo.get<EmbeddingResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Generate embedding via OpenAI API
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: text,
      dimensions: this.dimensions,
      encoding_format: 'float',
    });

    const result: EmbeddingResult = {
      embedding: response.data[0].embedding,
      tokenCount: response.usage.total_tokens,
      model: this.model,
    };

    // Normalize vector (L2 norm)
    result.embedding = this.normalizeVector(result.embedding);

    // Cache for 24 hours
    await this.cacheRepo.set(cacheKey, result, 86400);

    return result;
  }

  /**
   * Generate embeddings for multiple texts in batch
   * 
   * Processes up to 50 texts per API call for efficiency.
   * Automatically splits larger batches.
   * 
   * Complexity: O(k * n) where k = batch size, n = avg text length
   * Target Latency: <2000ms for 50 texts
   * 
   * @param texts Array of texts to embed
   * @returns Array of 768-dimensional vectors
   */
  async generateEmbeddingBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    // Validate inputs
    if (texts.length === 0) {
      throw new Error('Texts array cannot be empty');
    }

    const validTexts = texts.filter((t) => t && t.trim().length > 0);
    if (validTexts.length === 0) {
      throw new Error('All texts are empty');
    }

    // Process in chunks if needed
    if (validTexts.length > this.maxBatchSize) {
      return this.processBatchesSequentially(validTexts);
    }

    // Single batch processing
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: validTexts,
      dimensions: this.dimensions,
      encoding_format: 'float',
    });

    const embeddings = response.data.map((d) =>
      this.normalizeVector(d.embedding)
    );

    return {
      embeddings,
      totalTokens: response.usage.total_tokens,
      model: this.model,
    };
  }

  /**
   * Generate embedding from user traits
   * 
   * Converts structured trait data into natural language text,
   * then generates embedding for matching.
   * 
   * Complexity: O(k + n) where k = number of traits, n = text length
   * Target Latency: <500ms
   * 
   * @param traits User trait objects with dimension, trait, value, confidence
   * @param userId User ID for caching
   */
  async generateTraitEmbedding(
    traits: Array<{
      dimension: string;
      trait: string;
      value: number;
      confidence: number;
    }>,
    userId: string
  ): Promise<EmbeddingResult> {
    if (traits.length === 0) {
      throw new Error('Traits array cannot be empty');
    }

    // Convert traits to natural language text
    const traitText = this.traitsToText(traits);

    // Generate embedding with user-specific cache
    return this.generateEmbedding(traitText, userId);
  }

  /**
   * Convert structured traits to natural language text
   * 
   * Format: "User values: [trait1], [trait2]. Interests: [trait3], ..."
   * Weight traits by confidence and value.
   * 
   * Complexity: O(n) where n = number of traits
   */
  private traitsToText(
    traits: Array<{
      dimension: string;
      trait: string;
      value: number;
      confidence: number;
    }>
  ): string {
    // Group traits by dimension
    const grouped = traits.reduce((acc, t) => {
      if (!acc[t.dimension]) acc[t.dimension] = [];
      acc[t.dimension].push(t);
      return acc;
    }, {} as Record<string, typeof traits>);

    // Build natural language text
    const sentences: string[] = [];

    for (const [dimension, dimTraits] of Object.entries(grouped)) {
      // Sort by confidence * value (weighted importance)
      const sorted = dimTraits.sort(
        (a, b) => b.confidence * b.value - a.confidence * a.value
      );

      // Take top traits with confidence > 0.5
      const topTraits = sorted
        .filter((t) => t.confidence > 0.5)
        .map((t) => t.trait.replace(/_/g, ' '))
        .slice(0, 5); // Top 5 per dimension

      if (topTraits.length > 0) {
        const dimensionName = dimension.charAt(0).toUpperCase() + dimension.slice(1);
        sentences.push(`${dimensionName}: ${topTraits.join(', ')}`);
      }
    }

    return sentences.join('. ') + '.';
  }

  /**
   * Normalize vector to unit length (L2 norm)
   * 
   * Required for cosine similarity: cos(θ) = dot(a,b) / (||a|| * ||b||)
   * With unit vectors: cos(θ) = dot(a,b)
   * 
   * Complexity: O(d) where d = vector dimension (768)
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );

    if (magnitude === 0) {
      throw new Error('Cannot normalize zero vector');
    }

    return vector.map((val) => val / magnitude);
  }

  /**
   * Process large batches sequentially
   * 
   * Splits into chunks of maxBatchSize and processes sequentially
   * to stay within API limits.
   * 
   * Complexity: O(k * n) where k = total texts, n = avg text length
   */
  private async processBatchesSequentially(
    texts: string[]
  ): Promise<BatchEmbeddingResult> {
    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const chunk = texts.slice(i, i + this.maxBatchSize);
      const result = await this.generateEmbeddingBatch(chunk);
      allEmbeddings.push(...result.embeddings);
      totalTokens += result.totalTokens;
    }

    return {
      embeddings: allEmbeddings,
      totalTokens,
      model: this.model,
    };
  }

  /**
   * Hash text for cache key generation
   * 
   * Uses simple hash function for cache key uniqueness.
   * Not cryptographically secure - only for cache keys.
   * 
   * Complexity: O(n) where n = text length
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Invalidate cached embedding for user
   * 
   * Called when user profile changes significantly.
   * 
   * Complexity: O(1)
   */
  async invalidateCache(userId: string): Promise<void> {
    await this.cacheRepo.delete(`embedding:user:${userId}`);
  }

  /**
   * Health check - verify OpenAI API connectivity
   * 
   * Complexity: O(1)
   * Target Latency: <1000ms
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test with minimal text
      await this.openai.embeddings.create({
        model: this.model,
        input: 'test',
        dimensions: this.dimensions,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default EmbeddingService;
