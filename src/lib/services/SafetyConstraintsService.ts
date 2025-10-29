/**
 * Safety Constraints Service
 * Component 4 of RBS Algorithm
 * 
 * Applies safety penalties for red flags, excessive distance, and age gaps.
 * Lower SC = Higher penalty = Less compatible match
 * 
 * Mathematical Foundation:
 * SC(u₁, u₂) = w_red·RedFlags + w_dist·Distance + w_age·AgeGap
 * 
 * Penalties are normalized to [0, 1] where:
 * - 0 = Maximum penalty (dealbreaker)
 * - 1 = No penalty (safe match)
 * 
 * Complexity: O(1) - constant time evaluation
 * Target Latency: <5ms per pair
 */

import type { SafetyConstraintsResult, SafetyFlag } from '../types/rbs.types';

export interface UserSafetyProfile {
  userId: string;
  age: number;
  location: { latitude: number; longitude: number };
  redFlags: string[]; // e.g., ['harassment_history', 'fake_profile']
  preferences: {
    maxDistance?: number; // km
    minAge?: number;
    maxAge?: number;
  };
}

export class SafetyConstraintsService {
  // Penalty weights (must sum to 1.0)
  private readonly RED_FLAG_WEIGHT = 0.6;
  private readonly DISTANCE_WEIGHT = 0.25;
  private readonly AGE_GAP_WEIGHT = 0.15;

  // Threshold values
  private readonly MAX_SAFE_DISTANCE = 50; // km
  private readonly MAX_SAFE_AGE_GAP = 15; // years

  // Red flag severity mapping
  private readonly RED_FLAG_SEVERITY: Record<string, number> = {
    // Critical flags (immediate disqualification)
    'harassment_history': 1.0,
    'violence_history': 1.0,
    'fake_profile': 1.0,
    'scam_attempt': 1.0,
    
    // Major flags (strong penalty)
    'multiple_reports': 0.8,
    'inappropriate_content': 0.7,
    'spam_behavior': 0.6,
    
    // Minor flags (moderate penalty)
    'incomplete_verification': 0.4,
    'suspicious_activity': 0.3,
  };

  /**
   * Calculate Safety Constraints penalty between two users
   * 
   * @param user1 - First user's safety profile
   * @param user2 - Second user's safety profile
   * @returns SC penalty in range [0, 1] (0 = max penalty, 1 = no penalty)
   * 
   * Time Complexity: O(1) - constant time
   * Space Complexity: O(1)
   */
  public calculate(user1: UserSafetyProfile, user2: UserSafetyProfile): number {
    const result = this.calculateDetailed(user1, user2);
    return result.score;
  }

  /**
   * Calculate detailed SC result with all penalties
   * 
   * @param user1 - First user's safety profile
   * @param user2 - Second user's safety profile
   * @returns Detailed SC metrics
   */
  public calculateDetailed(
    user1: UserSafetyProfile,
    user2: UserSafetyProfile
  ): SafetyConstraintsResult {
    const flags: SafetyFlag[] = [];

    // 1. Evaluate red flags
    const redFlagPenalty = this.evaluateRedFlags(user1, user2, flags);

    // 2. Calculate distance penalty
    const distancePenalty = this.calculateDistancePenalty(user1, user2, flags);

    // 3. Calculate age gap penalty
    const agePenalty = this.calculateAgeGapPenalty(user1, user2, flags);

    // 4. Weighted combination (inverted so 1 = safe, 0 = unsafe)
    const totalPenalty =
      this.RED_FLAG_WEIGHT * redFlagPenalty +
      this.DISTANCE_WEIGHT * distancePenalty +
      this.AGE_GAP_WEIGHT * agePenalty;

    // Invert to get penalty score (higher score = higher penalty)
    const score = this.clamp(totalPenalty, 0, 1);

    return {
      score,
      flags,
      distancePenalty,
      agePenalty,
    };
  }

  /**
   * Evaluate red flags for both users
   * Returns penalty [0, 1] where 1 = critical flag present
   */
  private evaluateRedFlags(
    user1: UserSafetyProfile,
    user2: UserSafetyProfile,
    flags: SafetyFlag[]
  ): number {
    let maxSeverity = 0;

    // Check user1's red flags
    for (const flag of user1.redFlags) {
      const severity = this.RED_FLAG_SEVERITY[flag] ?? 0.5;
      maxSeverity = Math.max(maxSeverity, severity);

      flags.push({
        type: 'red_flag',
        severity,
        description: `User 1 has flag: ${flag}`,
      });

      // Critical flags are immediate disqualifiers
      if (severity >= 1.0) {
        return 1.0;
      }
    }

    // Check user2's red flags
    for (const flag of user2.redFlags) {
      const severity = this.RED_FLAG_SEVERITY[flag] ?? 0.5;
      maxSeverity = Math.max(maxSeverity, severity);

      flags.push({
        type: 'red_flag',
        severity,
        description: `User 2 has flag: ${flag}`,
      });

      if (severity >= 1.0) {
        return 1.0;
      }
    }

    return maxSeverity;
  }

  /**
   * Calculate distance penalty based on geographic separation
   * Returns penalty [0, 1] where 1 = too far
   */
  private calculateDistancePenalty(
    user1: UserSafetyProfile,
    user2: UserSafetyProfile,
    flags: SafetyFlag[]
  ): number {
    const distance = this.haversineDistance(
      user1.location.latitude,
      user1.location.longitude,
      user2.location.latitude,
      user2.location.longitude
    );

    // Check user preferences
    const maxDistance = Math.min(
      user1.preferences.maxDistance ?? this.MAX_SAFE_DISTANCE,
      user2.preferences.maxDistance ?? this.MAX_SAFE_DISTANCE
    );

    if (distance > maxDistance) {
      const severity = Math.min(distance / maxDistance - 1, 1);
      flags.push({
        type: 'distance',
        severity,
        description: `Distance ${distance.toFixed(1)}km exceeds max ${maxDistance}km`,
      });
      return severity;
    }

    // Gradual penalty as distance approaches max
    const penalty = Math.min(distance / this.MAX_SAFE_DISTANCE, 1);
    return penalty;
  }

  /**
   * Calculate age gap penalty
   * Returns penalty [0, 1] where 1 = excessive gap
   */
  private calculateAgeGapPenalty(
    user1: UserSafetyProfile,
    user2: UserSafetyProfile,
    flags: SafetyFlag[]
  ): number {
    const ageGap = Math.abs(user1.age - user2.age);

    // Check user preferences
    const user1Compatible =
      (!user1.preferences.minAge || user2.age >= user1.preferences.minAge) &&
      (!user1.preferences.maxAge || user2.age <= user1.preferences.maxAge);

    const user2Compatible =
      (!user2.preferences.minAge || user1.age >= user2.preferences.minAge) &&
      (!user2.preferences.maxAge || user1.age <= user2.preferences.maxAge);

    if (!user1Compatible || !user2Compatible) {
      flags.push({
        type: 'age_gap',
        severity: 0.8,
        description: `Age preferences not met: ${user1.age} and ${user2.age}`,
      });
      return 0.8;
    }

    // Gradual penalty for large age gaps
    if (ageGap > this.MAX_SAFE_AGE_GAP) {
      const severity = Math.min((ageGap - this.MAX_SAFE_AGE_GAP) / 10, 1);
      flags.push({
        type: 'age_gap',
        severity,
        description: `Age gap ${ageGap} years exceeds safe threshold`,
      });
      return severity;
    }

    return ageGap / this.MAX_SAFE_AGE_GAP;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * 
   * @returns Distance in kilometers
   * 
   * Time Complexity: O(1)
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Clamp value to range [min, max]
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Batch calculate SC scores for multiple pairs
   * 
   * @param user - User's safety profile
   * @param candidates - Array of candidate safety profiles
   * @returns Array of SC penalty scores
   * 
   * Time Complexity: O(n) where n = candidates
   */
  public batchCalculate(
    user: UserSafetyProfile,
    candidates: UserSafetyProfile[]
  ): number[] {
    return candidates.map(candidate => this.calculate(user, candidate));
  }
}
