/**
 * Subspace Resonance Service Unit Tests
 * 100% Coverage Requirement for Mathematical Operations
 */

import { SubspaceResonanceService } from '../../src/lib/services/SubspaceResonanceService';
import type { EmbeddingVector } from '../../src/lib/types/rbs.types';

describe('SubspaceResonanceService', () => {
  let service: SubspaceResonanceService;

  beforeEach(() => {
    service = new SubspaceResonanceService();
  });

  describe('calculate()', () => {
    test('should return score in range [0, 1]', () => {
      const embedding1 = createRandomEmbedding();
      const embedding2 = createRandomEmbedding();

      const score = service.calculate(embedding1, embedding2);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should return 1.0 for identical embeddings', () => {
      const embedding = createRandomEmbedding();

      const score = service.calculate(embedding, embedding);

      expect(score).toBeCloseTo(1.0, 6);
    });

    test('should be symmetric (SR(u1, u2) = SR(u2, u1))', () => {
      const embedding1 = createRandomEmbedding();
      const embedding2 = createRandomEmbedding();

      const score1 = service.calculate(embedding1, embedding2);
      const score2 = service.calculate(embedding2, embedding1);

      expect(score1).toBeCloseTo(score2, 6);
    });

    test('should return ~0 for orthogonal vectors', () => {
      const embedding1 = createZeroEmbedding();
      embedding1[0] = 1;

      const embedding2 = createZeroEmbedding();
      embedding2[128] = 1; // Different subspace

      const score = service.calculate(embedding1, embedding2);

      expect(score).toBeLessThan(0.1);
    });

    test('should handle zero vectors gracefully', () => {
      const embedding1 = createZeroEmbedding();
      const embedding2 = createRandomEmbedding();

      const score = service.calculate(embedding1, embedding2);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should throw error for invalid embedding size', () => {
      const embedding1 = createRandomEmbedding();
      const embedding2 = new Array(100).fill(0);

      expect(() => {
        service.calculate(embedding1, embedding2);
      }).toThrow('Invalid embedding2 size');
    });

    test('should throw error for NaN values', () => {
      const embedding1 = createRandomEmbedding();
      const embedding2 = createRandomEmbedding();
      embedding2[0] = NaN;

      expect(() => {
        service.calculate(embedding1, embedding2);
      }).toThrow('contains invalid values');
    });

    test('should throw error for Infinity values', () => {
      const embedding1 = createRandomEmbedding();
      const embedding2 = createRandomEmbedding();
      embedding2[0] = Infinity;

      expect(() => {
        service.calculate(embedding1, embedding2);
      }).toThrow('contains invalid values');
    });

    test('should weight subspaces correctly', () => {
      // Create embeddings with similarity only in values subspace (0:128)
      const embedding1 = createZeroEmbedding();
      const embedding2 = createZeroEmbedding();

      // Fill values subspace with identical values
      for (let i = 0; i < 128; i++) {
        embedding1[i] = 1;
        embedding2[i] = 1;
      }

      const score = service.calculate(embedding1, embedding2);

      // Should be ~0.30 (values weight)
      expect(score).toBeCloseTo(0.30, 2);
    });
  });

  describe('batchCalculate()', () => {
    test('should calculate scores for multiple candidates', () => {
      const embedding = createRandomEmbedding();
      const candidates = [
        createRandomEmbedding(),
        createRandomEmbedding(),
        createRandomEmbedding(),
      ];

      const scores = service.batchCalculate(embedding, candidates);

      expect(scores).toHaveLength(3);
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    test('should match individual calculations', () => {
      const embedding = createRandomEmbedding();
      const candidates = [
        createRandomEmbedding(),
        createRandomEmbedding(),
      ];

      const batchScores = service.batchCalculate(embedding, candidates);
      const individualScores = candidates.map(c => service.calculate(embedding, c));

      expect(batchScores).toEqual(individualScores);
    });

    test('should handle empty candidate array', () => {
      const embedding = createRandomEmbedding();
      const candidates: EmbeddingVector[] = [];

      const scores = service.batchCalculate(embedding, candidates);

      expect(scores).toEqual([]);
    });
  });

  describe('Performance Tests', () => {
    test('should complete single calculation in <50ms', () => {
      const embedding1 = createRandomEmbedding();
      const embedding2 = createRandomEmbedding();

      const start = performance.now();
      service.calculate(embedding1, embedding2);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    test('should verify O(d·k) complexity', () => {
      // This test validates that doubling the work approximately doubles the time
      const embedding = createRandomEmbedding();

      // Measure time for n=10 candidates
      const candidates10 = Array.from({ length: 10 }, () => createRandomEmbedding());
      const start1 = performance.now();
      service.batchCalculate(embedding, candidates10);
      const time1 = performance.now() - start1;

      // Measure time for n=20 candidates
      const candidates20 = Array.from({ length: 20 }, () => createRandomEmbedding());
      const start2 = performance.now();
      service.batchCalculate(embedding, candidates20);
      const time2 = performance.now() - start2;

      // Ratio should be approximately 2.0 (linear scaling)
      const ratio = time2 / time1;
      expect(ratio).toBeGreaterThan(1.5);
      expect(ratio).toBeLessThan(2.5);
    });
  });

  describe('Mathematical Properties', () => {
    test('should satisfy triangle inequality (approximately)', () => {
      const e1 = createRandomEmbedding();
      const e2 = createRandomEmbedding();
      const e3 = createRandomEmbedding();

      const d12 = 1 - service.calculate(e1, e2);
      const d23 = 1 - service.calculate(e2, e3);
      const d13 = 1 - service.calculate(e1, e3);

      // d(1,3) ≤ d(1,2) + d(2,3) + ε (approximate due to subspace weighting)
      expect(d13).toBeLessThanOrEqual(d12 + d23 + 0.1);
    });

    test('should be non-negative', () => {
      const embedding1 = createRandomEmbedding();
      const embedding2 = createRandomEmbedding();

      const score = service.calculate(embedding1, embedding2);

      expect(score).toBeGreaterThanOrEqual(0);
    });

    test('should handle normalized vs unnormalized vectors consistently', () => {
      const embedding1 = createRandomEmbedding();
      const embedding2 = createRandomEmbedding();

      // Original calculation
      const score1 = service.calculate(embedding1, embedding2);

      // Scale vectors (should not affect cosine similarity)
      const scaled1 = embedding1.map(x => x * 10);
      const scaled2 = embedding2.map(x => x * 10);

      const score2 = service.calculate(scaled1, scaled2);

      expect(score1).toBeCloseTo(score2, 5);
    });
  });
});

// Helper Functions

function createRandomEmbedding(): EmbeddingVector {
  return Array.from({ length: 768 }, () => Math.random() * 2 - 1); // Range [-1, 1]
}

function createZeroEmbedding(): EmbeddingVector {
  return new Array(768).fill(0);
}
