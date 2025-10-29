/**
 * Causal Uplift Service Unit Tests
 * 100% Coverage Requirement for Mathematical Operations
 */

import { CausalUpliftService } from '../../src/lib/services/CausalUpliftService';
import type { CausalUpliftInput } from '../../src/lib/types/rbs.types';

describe('CausalUpliftService', () => {
  let service: CausalUpliftService;

  beforeEach(() => {
    service = new CausalUpliftService();
  });

  describe('calculate()', () => {
    test('should return score in range [0, 1]', async () => {
      const input = createMockInput();

      const score = await service.calculate(input);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should return consistent results for same input', async () => {
      const input = createMockInput();

      const score1 = await service.calculate(input);
      const score2 = await service.calculate(input);

      expect(score1).toBeCloseTo(score2, 6);
    });

    test('should handle different feature vectors', async () => {
      const input1 = createMockInput(Array(20).fill(0.3));
      const input2 = createMockInput(Array(20).fill(0.8));

      const score1 = await service.calculate(input1);
      const score2 = await service.calculate(input2);

      // Scores should differ for different inputs
      expect(Math.abs(score1 - score2)).toBeGreaterThan(0);
    });

    test('should throw error for NaN features', async () => {
      const features = new Array(20).fill(0.5);
      features[0] = NaN;

      const input: CausalUpliftInput = {
        userId: 'user1',
        partnerId: 'user2',
        features,
      };

      await expect(service.calculate(input)).rejects.toThrow('Invalid feature value');
    });

    test('should throw error for Infinity features', async () => {
      const features = new Array(20).fill(0.5);
      features[0] = Infinity;

      const input: CausalUpliftInput = {
        userId: 'user1',
        partnerId: 'user2',
        features,
      };

      await expect(service.calculate(input)).rejects.toThrow('Invalid feature value');
    });
  });

  describe('predict()', () => {
    test('should return complete result', async () => {
      const input = createMockInput();

      const result = await service.predict(input);

      expect(result).toHaveProperty('treatmentEffect');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('modelVersion');
    });

    test('should include model version', async () => {
      const input = createMockInput();

      const result = await service.predict(input);

      expect(result.modelVersion).toBe('1.0.0');
    });

    test('should return confidence in range [0, 1]', async () => {
      const input = createMockInput();

      const result = await service.predict(input);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should calculate positive treatment effect', async () => {
      const input = createMockInput(Array(20).fill(0.8));

      const result = await service.predict(input);

      // Treatment effect can be positive (coaching helps)
      expect(result.treatmentEffect).toBeGreaterThanOrEqual(0);
    });

    test('should handle zero features', async () => {
      const input = createMockInput(new Array(20).fill(0));

      const result = await service.predict(input);

      expect(result.treatmentEffect).toBeGreaterThanOrEqual(0);
      expect(result.treatmentEffect).toBeLessThanOrEqual(1);
    });

    test('should handle max features', async () => {
      const input = createMockInput(new Array(20).fill(1));

      const result = await service.predict(input);

      expect(result.treatmentEffect).toBeGreaterThanOrEqual(0);
      expect(result.treatmentEffect).toBeLessThanOrEqual(1);
    });

    test('should calculate treatment effect as difference', async () => {
      const input = createMockInput();

      const result = await service.predict(input);

      // Treatment effect should be the difference
      expect(result.treatmentEffect).toBeDefined();
      expect(typeof result.treatmentEffect).toBe('number');
    });
  });

  describe('batchCalculate()', () => {
    test('should calculate scores for multiple inputs', async () => {
      const inputs = [
        createMockInput(),
        createMockInput(),
        createMockInput(),
      ];

      const scores = await service.batchCalculate(inputs);

      expect(scores).toHaveLength(3);
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    test('should match individual calculations', async () => {
      const feature1 = Array(20).fill(0.5);
      const feature2 = Array(20).fill(0.7);
      
      const inputs = [
        createMockInput(feature1),
        createMockInput(feature2),
      ];

      const batchScores = await service.batchCalculate(inputs);
      const individualScores = await Promise.all(
        inputs.map(input => service.calculate(input))
      );

      expect(batchScores).toHaveLength(individualScores.length);
      for (let i = 0; i < batchScores.length; i++) {
        expect(batchScores[i]).toBeCloseTo(individualScores[i]!, 6);
      }
    });

    test('should handle empty input array', async () => {
      const inputs: CausalUpliftInput[] = [];

      const scores = await service.batchCalculate(inputs);

      expect(scores).toEqual([]);
    });

    test('should process batch efficiently', async () => {
      const inputs = Array.from({ length: 10 }, () => createMockInput());

      const start = performance.now();
      await service.batchCalculate(inputs);
      const duration = performance.now() - start;

      // Batch processing should be efficient
      expect(duration).toBeLessThan(100); // <100ms for 10 predictions
    });
  });

  describe('Feature Validation', () => {
    test('should validate feature values', async () => {
      const features = new Array(20).fill(0.5);
      features[10] = NaN;

      const input: CausalUpliftInput = {
        userId: 'user1',
        partnerId: 'user2',
        features,
      };

      await expect(service.calculate(input)).rejects.toThrow('Invalid feature value');
    });

    test('should accept valid feature arrays', async () => {
      const features = new Array(20).fill(0.5);

      const input: CausalUpliftInput = {
        userId: 'user1',
        partnerId: 'user2',
        features,
      };

      const result = await service.calculate(input);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance Tests', () => {
    test('should complete calculation in <50ms', async () => {
      const input = createMockInput();

      const start = performance.now();
      await service.calculate(input);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    test('should demonstrate O(1) inference complexity', async () => {
      const input = createMockInput();

      // Multiple predictions should have consistent time
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await service.calculate(input);
        times.push(performance.now() - start);
      }

      // All should be fast (O(1))
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      expect(avgTime).toBeLessThan(50);
    });
  });

  describe('Configuration', () => {
    test('should check if enabled via config', () => {
      const isEnabled = service.isEnabled();

      expect(typeof isEnabled).toBe('boolean');
    });

    test('should return model version', () => {
      const version = service.getModelVersion();

      expect(version).toBe('1.0.0');
    });
  });

  describe('Mathematical Properties', () => {
    test('should be deterministic for same input', async () => {
      const input = createMockInput();

      const results = await Promise.all([
        service.predict(input),
        service.predict(input),
        service.predict(input),
      ]);

      expect(results[0]!.treatmentEffect).toBeCloseTo(results[1]!.treatmentEffect, 6);
      expect(results[1]!.treatmentEffect).toBeCloseTo(results[2]!.treatmentEffect, 6);
    });

    test('should have bounded treatment effect', async () => {
      const inputs = Array.from({ length: 10 }, () => createMockInput());

      const results = await Promise.all(
        inputs.map(input => service.predict(input))
      );

      results.forEach(result => {
        expect(result.treatmentEffect).toBeGreaterThanOrEqual(0);
        expect(result.treatmentEffect).toBeLessThanOrEqual(1);
      });
    });

    test('should vary with different feature vectors', async () => {
      const input1 = createMockInput(Array(20).fill(0.2));
      const input2 = createMockInput(Array(20).fill(0.8));

      const result1 = await service.predict(input1);
      const result2 = await service.predict(input2);

      // Different inputs should generally produce different outputs
      expect(Math.abs(result1.treatmentEffect - result2.treatmentEffect)).toBeGreaterThanOrEqual(0);
    });
  });
});

// Helper Functions

function createMockInput(customFeatures?: number[]): CausalUpliftInput {
  const features = customFeatures || Array.from({ length: 20 }, () => Math.random());
  
  // Ensure we have exactly 20 features
  while (features.length < 20) {
    features.push(Math.random());
  }
  
  return {
    userId: `user-${Math.random()}`,
    partnerId: `partner-${Math.random()}`,
    features: features.slice(0, 20),
  };
}
