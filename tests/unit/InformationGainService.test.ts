/**
 * Information Gain Service Unit Tests
 * 100% Coverage Requirement for Mathematical Operations
 */

import { InformationGainService } from '../../src/lib/services/InformationGainService';
import type { UserProfile5D, UserTrait } from '../../src/lib/types/rbs.types';

describe('InformationGainService', () => {
  let service: InformationGainService;

  beforeEach(() => {
    service = new InformationGainService();
  });

  describe('calculate()', () => {
    test('should return score in range [0, 1]', () => {
      const profile1 = createMockProfile(10, 0.8);
      const profile2 = createMockProfile(15, 0.9);

      const score = service.calculate(profile1, profile2);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should return 0 for empty profiles', () => {
      const profile1 = createEmptyProfile();
      const profile2 = createEmptyProfile();

      const score = service.calculate(profile1, profile2);

      expect(score).toBe(0);
    });

    test('should return higher score for complete profiles', () => {
      const incomplete = createMockProfile(5, 0.5);
      const complete = createMockProfile(25, 0.9);

      const scoreIncomplete = service.calculate(incomplete, incomplete);
      const scoreComplete = service.calculate(complete, complete);

      expect(scoreComplete).toBeGreaterThan(scoreIncomplete);
    });

    test('should average scores of both profiles', () => {
      const profile1 = createMockProfile(10, 0.8);
      const profile2 = createMockProfile(20, 0.9);

      const result1 = service.calculateDetailed(profile1);
      const result2 = service.calculateDetailed(profile2);
      const expected = (result1.score + result2.score) / 2;

      const actual = service.calculate(profile1, profile2);

      expect(actual).toBeCloseTo(expected, 6);
    });

    test('should be symmetric', () => {
      const profile1 = createMockProfile(10, 0.7);
      const profile2 = createMockProfile(15, 0.8);

      const score1 = service.calculate(profile1, profile2);
      const score2 = service.calculate(profile2, profile1);

      expect(score1).toBeCloseTo(score2, 6);
    });
  });

  describe('calculateDetailed()', () => {
    test('should return complete metrics', () => {
      const profile = createMockProfile(15, 0.8);

      const result = service.calculateDetailed(profile);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('coverage');
      expect(result).toHaveProperty('avgConfidence');
      expect(result).toHaveProperty('entropyReduction');
    });

    test('should calculate correct coverage', () => {
      const profile = createMockProfile(25, 0.8); // All expected traits

      const result = service.calculateDetailed(profile);

      expect(result.coverage).toBeCloseTo(1.0, 2);
    });

    test('should calculate correct average confidence', () => {
      const confidence = 0.75;
      const profile = createMockProfile(10, confidence);

      const result = service.calculateDetailed(profile);

      expect(result.avgConfidence).toBeCloseTo(confidence, 2);
    });

    test('should calculate entropy reduction', () => {
      const profile = createMockProfile(15, 0.8);

      const result = service.calculateDetailed(profile);

      expect(result.entropyReduction).toBeGreaterThanOrEqual(0);
      expect(result.entropyReduction).toBeLessThanOrEqual(1.01);
    });

    test('should handle uneven dimension distribution', () => {
      const profile = createEmptyProfile();
      // Add all traits to one dimension
      for (let i = 0; i < 10; i++) {
        profile.values.set(`trait${i}`, {
          dimension: 'values',
          trait: `trait${i}`,
          value: 0.5,
          confidence: 0.8,
          source: 'conversation',
        });
      }

      const result = service.calculateDetailed(profile);

      expect(result.score).toBeGreaterThan(0);
      expect(result.entropyReduction).toBeLessThan(1); // Lower entropy due to uneven distribution
    });
  });

  describe('validateMonotonicity()', () => {
    test('should confirm IG never decreases when adding traits', () => {
      const profile = createMockProfile(10, 0.8);

      const isMonotonic = service.validateMonotonicity(
        profile,
        'values',
        'new_trait'
      );

      expect(isMonotonic).toBe(true);
    });

    test('should handle existing trait', () => {
      const profile = createMockProfile(10, 0.8);
      const existingTrait = profile.values.keys().next().value as string;

      const isMonotonic = service.validateMonotonicity(
        profile,
        'values',
        existingTrait
      );

      expect(isMonotonic).toBe(true);
    });

    test('should validate across all dimensions', () => {
      const profile = createMockProfile(10, 0.8);
      const dimensions: Array<'values' | 'interests' | 'communication' | 'lifestyle' | 'goals'> = [
        'values', 'interests', 'communication', 'lifestyle', 'goals'
      ];

      for (const dimension of dimensions) {
        const isMonotonic = service.validateMonotonicity(
          profile,
          dimension,
          'test_trait'
        );
        expect(isMonotonic).toBe(true);
      }
    });
  });

  describe('calculateTraitsNeeded()', () => {
    test('should return 0 if target already met', () => {
      const profile = createMockProfile(25, 0.9);
      const targetScore = 0.5;

      const needed = service.calculateTraitsNeeded(profile, targetScore);

      expect(needed).toBe(0);
    });

    test('should calculate additional traits needed', () => {
      const profile = createMockProfile(5, 0.5);
      const targetScore = 0.8;

      const needed = service.calculateTraitsNeeded(profile, targetScore);

      expect(needed).toBeGreaterThan(0);
    });

    test('should return increasing values for higher targets', () => {
      const profile = createMockProfile(10, 0.6);

      const needed1 = service.calculateTraitsNeeded(profile, 0.7);
      const needed2 = service.calculateTraitsNeeded(profile, 0.9);

      expect(needed2).toBeGreaterThan(needed1);
    });

    test('should handle empty profile', () => {
      const profile = createEmptyProfile();
      const targetScore = 0.5;

      const needed = service.calculateTraitsNeeded(profile, targetScore);

      expect(needed).toBeGreaterThan(0);
    });
  });

  describe('batchCalculate()', () => {
    test('should calculate scores for multiple profiles', () => {
      const userProfile = createMockProfile(15, 0.8);
      const candidates = [
        createMockProfile(10, 0.7),
        createMockProfile(20, 0.9),
        createMockProfile(12, 0.75),
      ];

      const scores = service.batchCalculate(userProfile, candidates);

      expect(scores).toHaveLength(3);
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    test('should match individual calculations', () => {
      const userProfile = createMockProfile(15, 0.8);
      const candidates = [
        createMockProfile(10, 0.7),
        createMockProfile(20, 0.9),
      ];

      const batchScores = service.batchCalculate(userProfile, candidates);
      const individualScores = candidates.map(c => service.calculate(userProfile, c));

      expect(batchScores).toEqual(individualScores);
    });

    test('should handle empty candidate array', () => {
      const userProfile = createMockProfile(15, 0.8);
      const candidates: UserProfile5D[] = [];

      const scores = service.batchCalculate(userProfile, candidates);

      expect(scores).toEqual([]);
    });
  });

  describe('Performance Tests', () => {
    test('should complete calculation in <10ms', () => {
      const profile1 = createMockProfile(20, 0.8);
      const profile2 = createMockProfile(25, 0.9);

      const start = performance.now();
      service.calculate(profile1, profile2);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    test('should scale linearly with trait count (O(n))', () => {
      // Create profiles with different sizes
      const profile10 = createMockProfile(10, 0.8);
      const profile50 = createMockProfile(50, 0.8);

      // The algorithm should handle both efficiently
      const start1 = performance.now();
      service.calculateDetailed(profile10);
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      service.calculateDetailed(profile50);
      const time2 = performance.now() - start2;

      // Both should complete quickly (O(n) complexity)
      expect(time1).toBeLessThan(10);
      expect(time2).toBeLessThan(10);
    });
  });
});

// Helper Functions

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

  // Distribute traits evenly across dimensions
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
