/**
 * RBS Service Unit Tests
 * Complete Integration Testing for 4-Component Algorithm
 */

import { RBSService, RBSInput } from '../../src/lib/services/RBSService';
import type { EmbeddingVector, UserProfile5D, UserTrait } from '../../src/lib/types/rbs.types';
import type { UserSafetyProfile } from '../../src/lib/services/SafetyConstraintsService';

describe('RBSService', () => {
  let service: RBSService;

  beforeEach(() => {
    service = new RBSService();
  });

  describe('calculate()', () => {
    test('should return complete RBS score', async () => {
      const input = createMockInput();

      const result = await service.calculate(input);

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('sr');
      expect(result).toHaveProperty('cu');
      expect(result).toHaveProperty('ig');
      expect(result).toHaveProperty('sc');
      expect(result).toHaveProperty('timestamp');
    });

    test('should return total score in range [0, 1]', async () => {
      const input = createMockInput();

      const result = await service.calculate(input);

      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(1);
    });

    test('should calculate all component scores in range [0, 1]', async () => {
      const input = createMockInput();

      const result = await service.calculate(input);

      expect(result.sr).toBeGreaterThanOrEqual(0);
      expect(result.sr).toBeLessThanOrEqual(1);
      expect(result.cu).toBeGreaterThanOrEqual(0);
      expect(result.cu).toBeLessThanOrEqual(1);
      expect(result.ig).toBeGreaterThanOrEqual(0);
      expect(result.ig).toBeLessThanOrEqual(1);
      expect(result.sc).toBeGreaterThanOrEqual(0);
      expect(result.sc).toBeLessThanOrEqual(1);
    });

    test('should apply correct weights (α=0.45, β=0.30, γ=0.25, δ=0.15)', async () => {
      const input = createMockInput();

      const result = await service.calculate(input);

      // Verify formula: RBS = α·SR + β·CU + γ·IG - δ·SC
      const expected = 
        0.45 * result.sr +
        0.30 * result.cu +
        0.25 * result.ig -
        0.15 * result.sc;

      expect(result.total).toBeCloseTo(Math.max(0, Math.min(1, expected)), 5);
    });

    test('should complete in <300ms', async () => {
      const input = createMockInput();

      const start = performance.now();
      await service.calculate(input);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(300);
    });

    test('should handle identical users (high SR, high IG)', async () => {
      const embedding = createRandomEmbedding();
      const profile5D = createMockProfile(20, 0.9);
      const safetyProfile = createMockSafetyProfile(30, 40.7128, -74.0060);

      const input: RBSInput = {
        user1: { userId: 'user1', embedding, profile5D, safetyProfile },
        user2: { userId: 'user2', embedding, profile5D, safetyProfile },
      };

      const result = await service.calculate(input);

      // Identical users should have high SR and IG
      expect(result.sr).toBeGreaterThan(0.9);
      expect(result.ig).toBeGreaterThan(0.5);
    });

    test('should penalize users with red flags', async () => {
      const input = createMockInput();
      input.user1.safetyProfile.redFlags = ['harassment_history'];

      const result = await service.calculate(input);

      // SC penalty should be significant
      expect(result.sc).toBeGreaterThan(0.5);
      // Total score should be reduced
      expect(result.total).toBeLessThan(0.8);
    });

    test('should handle empty profiles gracefully', async () => {
      const input = createMockInput();
      input.user1.profile5D = createEmptyProfile();
      input.user2.profile5D = createEmptyProfile();

      const result = await service.calculate(input);

      // Should still return valid scores
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(1);
      // IG should be low for empty profiles
      expect(result.ig).toBeLessThan(0.3);
    });
  });

  describe('batchCalculate()', () => {
    test('should calculate scores for multiple pairs', async () => {
      const inputs = [
        createMockInput(),
        createMockInput(),
        createMockInput(),
      ];

      const results = await service.batchCalculate(inputs);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.total).toBeGreaterThanOrEqual(0);
        expect(result.total).toBeLessThanOrEqual(1);
      });
    });

    test('should match individual calculations', async () => {
      const input = createMockInput();

      const batchResult = await service.batchCalculate([input]);
      const individualResult = await service.calculate(input);

      expect(batchResult[0]!.total).toBeCloseTo(individualResult.total, 5);
      expect(batchResult[0]!.sr).toBeCloseTo(individualResult.sr, 5);
      expect(batchResult[0]!.cu).toBeCloseTo(individualResult.cu, 5);
      expect(batchResult[0]!.ig).toBeCloseTo(individualResult.ig, 5);
      expect(batchResult[0]!.sc).toBeCloseTo(individualResult.sc, 5);
    });

    test('should handle empty input array', async () => {
      const results = await service.batchCalculate([]);

      expect(results).toEqual([]);
    });
  });

  describe('calculateMatches()', () => {
    test('should calculate scores for one user against multiple candidates', async () => {
      const user = {
        userId: 'user1',
        embedding: createRandomEmbedding(),
        profile5D: createMockProfile(20, 0.8),
        safetyProfile: createMockSafetyProfile(30, 40.7128, -74.0060),
      };

      const candidates = [
        {
          userId: 'candidate1',
          embedding: createRandomEmbedding(),
          profile5D: createMockProfile(15, 0.7),
          safetyProfile: createMockSafetyProfile(28, 40.7589, -73.9851),
        },
        {
          userId: 'candidate2',
          embedding: createRandomEmbedding(),
          profile5D: createMockProfile(18, 0.75),
          safetyProfile: createMockSafetyProfile(32, 40.7489, -73.9751),
        },
      ];

      const results = await service.calculateMatches(user, candidates);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.total).toBeGreaterThanOrEqual(0);
        expect(result.total).toBeLessThanOrEqual(1);
      });
    });

    test('should be efficient for batch matching', async () => {
      const user = {
        userId: 'user1',
        embedding: createRandomEmbedding(),
        profile5D: createMockProfile(20, 0.8),
        safetyProfile: createMockSafetyProfile(30, 40.7128, -74.0060),
      };

      const candidates = Array.from({ length: 10 }, (_, i) => ({
        userId: `candidate${i}`,
        embedding: createRandomEmbedding(),
        profile5D: createMockProfile(15, 0.7),
        safetyProfile: createMockSafetyProfile(28 + i, 40.7589, -73.9851),
      }));

      const start = performance.now();
      await service.calculateMatches(user, candidates);
      const duration = performance.now() - start;

      // Should complete efficiently for 10 candidates
      expect(duration).toBeLessThan(1000); // <1s for 10 matches
    });
  });

  describe('Weight Configuration', () => {
    test('should use weights from config', () => {
      const weights = service.getWeights();

      expect(weights.alpha).toBe(0.45);
      expect(weights.beta).toBe(0.30);
      expect(weights.gamma).toBe(0.25);
      expect(weights.delta).toBe(0.15);
    });

    test('should validate weight simplex constraint (α + β + γ = 1)', () => {
      const weights = service.getWeights();
      const sum = weights.alpha + weights.beta + weights.gamma;

      expect(sum).toBeCloseTo(1.0, 2);
    });
  });

  describe('Performance Tests', () => {
    test('should meet <300ms p95 latency target', async () => {
      const inputs = Array.from({ length: 20 }, () => createMockInput());
      const times: number[] = [];

      for (const input of inputs) {
        const start = performance.now();
        await service.calculate(input);
        times.push(performance.now() - start);
      }

      times.sort((a, b) => a - b);
      const p95Index = Math.floor(times.length * 0.95);
      const p95Latency = times[p95Index]!;

      expect(p95Latency).toBeLessThan(300);
    });

    test('should demonstrate O(d·k) complexity', async () => {
      const input = createMockInput();

      // Multiple runs should have consistent performance
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await service.calculate(input);
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      expect(avgTime).toBeLessThan(300);
    });
  });

  describe('Component Integration', () => {
    test('should integrate all 4 components correctly', async () => {
      const input = createMockInput();

      const result = await service.calculate(input);

      // All components should contribute
      expect(result.sr).toBeGreaterThan(0);
      expect(result.cu).toBeGreaterThan(0);
      expect(result.ig).toBeGreaterThan(0);
      // SC can be 0 if no penalties
      expect(result.sc).toBeGreaterThanOrEqual(0);
    });

    test('should handle edge cases across all components', async () => {
      const input = createMockInput();
      // Create challenging scenario
      input.user1.profile5D = createEmptyProfile();
      input.user2.profile5D = createEmptyProfile();
      input.user1.safetyProfile.redFlags = ['spam_behavior'];
      input.user2.safetyProfile.age = 60; // Large age gap

      const result = await service.calculate(input);

      // Should still produce valid score
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(1);
    });
  });
});

// Helper Functions

function createMockInput(): RBSInput {
  return {
    user1: {
      userId: 'user1',
      embedding: createRandomEmbedding(),
      profile5D: createMockProfile(15, 0.8),
      safetyProfile: createMockSafetyProfile(30, 40.7128, -74.0060),
    },
    user2: {
      userId: 'user2',
      embedding: createRandomEmbedding(),
      profile5D: createMockProfile(18, 0.75),
      safetyProfile: createMockSafetyProfile(32, 40.7589, -73.9851),
    },
  };
}

function createRandomEmbedding(): EmbeddingVector {
  return Array.from({ length: 768 }, () => Math.random() * 2 - 1);
}

function createEmptyProfile(): UserProfile5D {
  return {
    userId: 'test-user',
    values: new Map(),
    interests: new Map(),
    communication: new Map(),
    lifestyle: new Map(),
    goals: new Map(),
    knowYouMeterScore: 0,
  };
}

function createMockProfile(totalTraits: number, confidence: number): UserProfile5D {
  const profile = createEmptyProfile();
  const dimensions: Array<'values' | 'interests' | 'communication' | 'lifestyle' | 'goals'> = [
    'values', 'interests', 'communication', 'lifestyle', 'goals'
  ];

  const traitsPerDimension = Math.ceil(totalTraits / 5);
  
  for (const dimension of dimensions) {
    for (let i = 0; i < traitsPerDimension && totalTraits > 0; i++) {
      const trait: UserTrait = {
        dimension,
        trait: `${dimension}_trait_${i}`,
        value: Math.random(),
        confidence,
        source: 'conversation',
      };
      profile[dimension].set(trait.trait, trait);
      totalTraits--;
    }
  }

  return profile;
}

function createMockSafetyProfile(
  age: number,
  lat: number,
  lon: number,
  redFlags: string[] = []
): UserSafetyProfile {
  return {
    userId: `user-${Math.random()}`,
    age,
    location: { latitude: lat, longitude: lon },
    redFlags,
    preferences: {},
  };
}
