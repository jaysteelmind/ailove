/**
 * Subspace Resonance Service
 * Component 1 of RBS Algorithm
 * 
 * Performs category-specific compatibility analysis across 5 trait dimensions:
 * - Values (0:128) - weight 0.30
 * - Interests (128:384) - weight 0.25
 * - Communication (384:448) - weight 0.20
 * - Lifestyle (448:544) - weight 0.15
 * - Goals (544:624) - weight 0.10
 * 
 * Complexity: O(d·k) where d=768, k=5
 * Target Latency: <50ms per pair
 */

import type { EmbeddingVector, Subspace } from '../types/rbs.types';
import { config } from '../../config/index';

export class SubspaceResonanceService {
  private readonly subspaces: readonly Subspace[];

  constructor() {
    this.subspaces = config.rbs.subspaces;
    this.validateSubspaces();
  }

  /**
   * Calculate Subspace Resonance score between two users
   * 
   * @param embedding1 - First user's 768-dim embedding vector
   * @param embedding2 - Second user's 768-dim embedding vector
   * @returns SR score in range [0, 1]
   * 
   * Mathematical Formula:
   * SR(u₁, u₂) = Σ(wᵢ · cos_sim(v₁ᵢ, v₂ᵢ)) for i ∈ subspaces
   * 
   * Time Complexity: O(d·k) = O(768·5) = O(3840)
   * Space Complexity: O(1) - no auxiliary storage
   */
  public calculate(embedding1: EmbeddingVector, embedding2: EmbeddingVector): number {
    this.validateEmbeddings(embedding1, embedding2);

    let weightedSum = 0;

    for (const subspace of this.subspaces) {
      // Extract subspace vectors
      const v1 = this.extractSubspace(embedding1, subspace);
      const v2 = this.extractSubspace(embedding2, subspace);

      // Calculate cosine similarity for this subspace
      const similarity = this.cosineSimilarity(v1, v2);

      // Weight by subspace importance
      weightedSum += subspace.weight * similarity;
    }

    // Normalize to [0, 1] and ensure bounds
    return this.clamp(weightedSum, 0, 1);
  }

  /**
   * Calculate cosine similarity between two vectors
   * 
   * cos_sim(v₁, v₂) = (v₁ · v₂) / (||v₁|| · ||v₂||)
   * 
   * @param v1 - First vector
   * @param v2 - Second vector
   * @returns Cosine similarity in range [-1, 1]
   * 
   * Time Complexity: O(n) where n = vector length
   * Space Complexity: O(1)
   */
  private cosineSimilarity(v1: number[], v2: number[]): number {
    if (v1.length !== v2.length) {
      throw new Error(`Vector length mismatch: ${v1.length} !== ${v2.length}`);
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    // Single pass calculation for efficiency
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i]! * v2[i]!;
      magnitude1 += v1[i]! * v1[i]!;
      magnitude2 += v2[i]! * v2[i]!;
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    // Handle zero vectors
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Extract subspace slice from embedding vector
   * 
   * @param embedding - Full 768-dim vector
   * @param subspace - Subspace definition
   * @returns Subspace slice
   * 
   * Time Complexity: O(n) where n = subspace size
   * Space Complexity: O(n)
   */
  private extractSubspace(embedding: EmbeddingVector, subspace: Subspace): number[] {
    return embedding.slice(subspace.start, subspace.end);
  }

  /**
   * Validate embedding vectors
   */
  private validateEmbeddings(embedding1: EmbeddingVector, embedding2: EmbeddingVector): void {
    const expectedSize = config.qdrant.vectorSize;

    if (embedding1.length !== expectedSize) {
      throw new Error(`Invalid embedding1 size: ${embedding1.length}, expected ${expectedSize}`);
    }

    if (embedding2.length !== expectedSize) {
      throw new Error(`Invalid embedding2 size: ${embedding2.length}, expected ${expectedSize}`);
    }

    // Check for NaN or Infinity
    if (!this.isValidVector(embedding1)) {
      throw new Error('embedding1 contains invalid values (NaN or Infinity)');
    }

    if (!this.isValidVector(embedding2)) {
      throw new Error('embedding2 contains invalid values (NaN or Infinity)');
    }
  }

  /**
   * Validate subspace configuration
   */
  private validateSubspaces(): void {
    const expectedSize = config.qdrant.vectorSize;
    let totalCoverage = 0;

    for (const subspace of this.subspaces) {
      if (subspace.start < 0 || subspace.end > expectedSize) {
        throw new Error(`Invalid subspace bounds: [${subspace.start}, ${subspace.end}]`);
      }

      if (subspace.start >= subspace.end) {
        throw new Error(`Invalid subspace range: start=${subspace.start} >= end=${subspace.end}`);
      }

      totalCoverage += (subspace.end - subspace.start);
    }

    // Verify total weight sums to ~1.0
    const totalWeight = this.subspaces.reduce((sum, s) => sum + s.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(`Subspace weights sum to ${totalWeight}, expected ~1.0`);
    }
  }

  /**
   * Check if vector contains only valid numbers
   */
  private isValidVector(vector: number[]): boolean {
    return vector.every(val => Number.isFinite(val));
  }

  /**
   * Clamp value to range [min, max]
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Calculate SR for multiple pairs in batch
   * Optimized for batch processing
   * 
   * @param embedding - User embedding
   * @param candidates - Array of candidate embeddings
   * @returns Array of SR scores
   * 
   * Time Complexity: O(n·d·k) where n=candidates, d=768, k=5
   */
  public batchCalculate(embedding: EmbeddingVector, candidates: EmbeddingVector[]): number[] {
    return candidates.map(candidate => this.calculate(embedding, candidate));
  }
}
