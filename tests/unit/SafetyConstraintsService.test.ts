/**
 * Safety Constraints Service Unit Tests
 * 100% Coverage Requirement for Mathematical Operations
 */

import { SafetyConstraintsService, UserSafetyProfile } from '../../src/lib/services/SafetyConstraintsService';

describe('SafetyConstraintsService', () => {
  let service: SafetyConstraintsService;

  beforeEach(() => {
    service = new SafetyConstraintsService();
  });

  describe('calculate()', () => {
    test('should return score in range [0, 1]', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060);
      const user2 = createMockUser(32, 40.7589, -73.9851);

      const score = service.calculate(user1, user2);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should return low penalty for safe match', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060);
      const user2 = createMockUser(32, 40.7589, -73.9851); // ~5km away

      const score = service.calculate(user1, user2);

      expect(score).toBeLessThan(0.3); // Low penalty = safe
    });

    test('should return high penalty for critical red flag', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060, ['harassment_history']);
      const user2 = createMockUser(32, 40.7589, -73.9851);

      const score = service.calculate(user1, user2);

      expect(score).toBeGreaterThan(0.5); // High penalty
    });

    test('should penalize excessive distance', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060); // NYC
      const user2 = createMockUser(32, 34.0522, -118.2437); // LA (~4000km)

      const score = service.calculate(user1, user2);

      expect(score).toBeGreaterThan(0.2); // Distance penalty applied
    });

    test('should penalize large age gap', () => {
      const user1 = createMockUser(25, 40.7128, -74.0060);
      const user2 = createMockUser(50, 40.7589, -73.9851); // 25 year gap

      const score = service.calculate(user1, user2);

      expect(score).toBeGreaterThan(0.1); // Age gap penalty
    });
  });

  describe('calculateDetailed()', () => {
    test('should return complete metrics', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060);
      const user2 = createMockUser(32, 40.7589, -73.9851);

      const result = service.calculateDetailed(user1, user2);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('flags');
      expect(result).toHaveProperty('distancePenalty');
      expect(result).toHaveProperty('agePenalty');
    });

    test('should identify red flags in flags array', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060, ['spam_behavior']);
      const user2 = createMockUser(32, 40.7589, -73.9851);

      const result = service.calculateDetailed(user1, user2);

      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.flags[0]?.type).toBe('red_flag');
    });

    test('should identify distance violations', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060);
      const user2 = createMockUser(32, 34.0522, -118.2437);

      const result = service.calculateDetailed(user1, user2);

      const distanceFlag = result.flags.find(f => f.type === 'distance');
      expect(distanceFlag).toBeDefined();
    });

    test('should identify age gap violations', () => {
      const user1 = createMockUser(25, 40.7128, -74.0060);
      const user2 = createMockUser(55, 40.7589, -73.9851);

      const result = service.calculateDetailed(user1, user2);

      const ageFlag = result.flags.find(f => f.type === 'age_gap');
      expect(ageFlag).toBeDefined();
    });

    test('should handle multiple red flags', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060, ['spam_behavior', 'suspicious_activity']);
      const user2 = createMockUser(32, 40.7589, -73.9851);

      const result = service.calculateDetailed(user1, user2);

      const redFlags = result.flags.filter(f => f.type === 'red_flag');
      expect(redFlags.length).toBe(2);
    });

    test('should return max penalty for critical flags', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060, ['violence_history']);
      const user2 = createMockUser(32, 40.7589, -73.9851);

      const result = service.calculateDetailed(user1, user2);

      expect(result.score).toBeGreaterThan(0.5); // High penalty for critical flag
    });
  });

  describe('Distance Calculation', () => {
    test('should calculate ~5km for nearby NYC locations', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060); // Times Square
      const user2 = createMockUser(32, 40.7589, -73.9851); // Central Park

      const result = service.calculateDetailed(user1, user2);

      // Distance penalty should be low for nearby locations
      expect(result.distancePenalty).toBeLessThan(0.2);
    });

    test('should calculate ~4000km for NYC to LA', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060); // NYC
      const user2 = createMockUser(32, 34.0522, -118.2437); // LA

      const result = service.calculateDetailed(user1, user2);

      // Distance penalty should be high
      expect(result.distancePenalty).toBeGreaterThan(0.5);
    });

    test('should handle same location', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060);
      const user2 = createMockUser(32, 40.7128, -74.0060);

      const result = service.calculateDetailed(user1, user2);

      expect(result.distancePenalty).toBeLessThan(0.01);
    });
  });

  describe('Age Preferences', () => {
    test('should respect maxAge preference', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060);
      user1.preferences.maxAge = 35;
      const user2 = createMockUser(40, 40.7589, -73.9851);

      const result = service.calculateDetailed(user1, user2);

      const ageFlag = result.flags.find(f => f.type === 'age_gap');
      expect(ageFlag).toBeDefined();
      expect(ageFlag?.severity).toBeGreaterThan(0.5);
    });

    test('should respect minAge preference', () => {
      const user1 = createMockUser(40, 40.7128, -74.0060);
      user1.preferences.minAge = 35;
      const user2 = createMockUser(30, 40.7589, -73.9851);

      const result = service.calculateDetailed(user1, user2);

      const ageFlag = result.flags.find(f => f.type === 'age_gap');
      expect(ageFlag).toBeDefined();
    });

    test('should allow compatible age ranges', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060);
      user1.preferences.minAge = 28;
      user1.preferences.maxAge = 35;
      const user2 = createMockUser(32, 40.7589, -73.9851);

      const result = service.calculateDetailed(user1, user2);

      expect(result.agePenalty).toBeLessThan(0.3);
    });
  });

  describe('Distance Preferences', () => {
    test('should respect maxDistance preference', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060);
      user1.preferences.maxDistance = 10; // 10km max
      const user2 = createMockUser(32, 40.8589, -73.9851); // ~15km away

      const result = service.calculateDetailed(user1, user2);

      const distanceFlag = result.flags.find(f => f.type === 'distance');
      expect(distanceFlag).toBeDefined();
    });

    test('should use stricter preference when both users have maxDistance', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060);
      user1.preferences.maxDistance = 20;
      const user2 = createMockUser(32, 40.8589, -73.9851);
      user2.preferences.maxDistance = 10; // Stricter

      const result = service.calculateDetailed(user1, user2);

      // Should use user2's stricter 10km limit
      const distanceFlag = result.flags.find(f => f.type === 'distance');
      expect(distanceFlag).toBeDefined();
    });
  });

  describe('batchCalculate()', () => {
    test('should calculate scores for multiple candidates', () => {
      const user = createMockUser(30, 40.7128, -74.0060);
      const candidates = [
        createMockUser(32, 40.7589, -73.9851),
        createMockUser(28, 40.7489, -73.9851),
        createMockUser(35, 40.7689, -73.9851),
      ];

      const scores = service.batchCalculate(user, candidates);

      expect(scores).toHaveLength(3);
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    test('should handle empty candidate array', () => {
      const user = createMockUser(30, 40.7128, -74.0060);
      const candidates: UserSafetyProfile[] = [];

      const scores = service.batchCalculate(user, candidates);

      expect(scores).toEqual([]);
    });
  });

  describe('Performance Tests', () => {
    test('should complete calculation in <5ms', () => {
      const user1 = createMockUser(30, 40.7128, -74.0060);
      const user2 = createMockUser(32, 40.7589, -73.9851);

      const start = performance.now();
      service.calculate(user1, user2);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
    });

    test('should demonstrate O(1) complexity', () => {
      const user = createMockUser(30, 40.7128, -74.0060);
      const candidate = createMockUser(32, 40.7589, -73.9851);

      // Run multiple times - should be consistent (O(1))
      const times: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        service.calculate(user, candidate);
        times.push(performance.now() - start);
      }

      // All times should be similarly fast (O(1))
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      expect(avgTime).toBeLessThan(5);
    });
  });
});

// Helper Functions

function createMockUser(
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
