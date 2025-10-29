/**
 * Information Gain Service
 * Component 3 of RBS Algorithm
 * 
 * Measures profile completeness and confidence using information theory.
 * Higher IG = More complete profiles = More reliable matching
 * 
 * Mathematical Foundation:
 * IG(u₁, u₂) = (Coverage₁ · Confidence₁ + Coverage₂ · Confidence₂) / 2
 * 
 * Where:
 * - Coverage = % of traits extracted across 5 dimensions
 * - Confidence = Average extraction confidence [0, 1]
 * - Entropy Reduction = -Σ(p·log₂(p)) bits of uncertainty reduced
 * 
 * Complexity: O(n) where n = number of traits
 * Target Latency: <10ms per pair
 */

import type { UserProfile5D, InformationGainResult } from '../types/rbs.types';

export class InformationGainService {
  // Minimum traits per dimension for "complete" profile
  private readonly MIN_TRAITS_PER_DIMENSION = 5;
  
  // Total expected traits across all dimensions
  private readonly TOTAL_EXPECTED_TRAITS = 5 * this.MIN_TRAITS_PER_DIMENSION; // 25 traits

  /**
   * Calculate Information Gain score for a user pair
   * 
   * @param profile1 - First user's 5D profile
   * @param profile2 - Second user's 5D profile
   * @returns IG score in range [0, 1]
   * 
   * Time Complexity: O(n) where n = total traits
   * Space Complexity: O(1)
   */
  public calculate(profile1: UserProfile5D, profile2: UserProfile5D): number {
    const result1 = this.calculateSingle(profile1);
    const result2 = this.calculateSingle(profile2);

    // Average the two IG scores
    return (result1.score + result2.score) / 2;
  }

  /**
   * Calculate detailed IG result for a single profile
   * 
   * @param profile - User's 5D profile
   * @returns Detailed IG metrics
   */
  public calculateDetailed(profile: UserProfile5D): InformationGainResult {
    return this.calculateSingle(profile);
  }

  /**
   * Calculate IG for a single user profile
   * 
   * @param profile - User's 5D profile
   * @returns IG result with metrics
   * 
   * Mathematical Formula:
   * IG = (Coverage · AvgConfidence) · EntropyFactor
   * 
   * Time Complexity: O(n)
   */
  private calculateSingle(profile: UserProfile5D): InformationGainResult {
    const dimensions = [
      profile.values,
      profile.interests,
      profile.communication,
      profile.lifestyle,
      profile.goals,
    ];

    let totalTraits = 0;
    let totalConfidence = 0;
    const dimensionCoverages: number[] = [];

    // Calculate coverage and confidence per dimension
    for (const dimension of dimensions) {
      const traitCount = dimension.size;
      totalTraits += traitCount;

      // Calculate average confidence for this dimension
      let dimensionConfidence = 0;
      for (const trait of dimension.values()) {
        dimensionConfidence += trait.confidence;
        totalConfidence += trait.confidence;
      }

      // Dimension coverage: min(traits/expected, 1.0)
      const coverage = Math.min(traitCount / this.MIN_TRAITS_PER_DIMENSION, 1.0);
      dimensionCoverages.push(coverage);
    }

    // Overall coverage: actual traits / expected traits
    const coverage = Math.min(totalTraits / this.TOTAL_EXPECTED_TRAITS, 1.0);

    // Average confidence across all traits
    const avgConfidence = totalTraits > 0 ? totalConfidence / totalTraits : 0;

    // Calculate entropy reduction (information gained)
    const entropyReduction = this.calculateEntropyReduction(dimensionCoverages);

    // Final IG score: weighted combination
    // Prioritize both coverage and confidence
    const score = this.clamp(
      (coverage * 0.6 + avgConfidence * 0.4) * (1 + entropyReduction * 0.1),
      0,
      1
    );

    return {
      score,
      coverage,
      avgConfidence,
      entropyReduction,
    };
  }

  /**
   * Calculate entropy reduction based on dimension coverage
   * 
   * Measures how much uncertainty is reduced by having traits
   * Higher entropy reduction = More information gained
   * 
   * Formula: H = -Σ(p·log₂(p)) where p = normalized coverage
   * 
   * @param dimensionCoverages - Coverage per dimension [0, 1]
   * @returns Entropy reduction in bits [0, ~2.32]
   */
  private calculateEntropyReduction(dimensionCoverages: number[]): number {
    // Normalize coverages to probabilities
    const total = dimensionCoverages.reduce((sum, c) => sum + c, 0);
    
    if (total === 0) return 0;

    let entropy = 0;
    for (const coverage of dimensionCoverages) {
      if (coverage > 0) {
        const p = coverage / total;
        entropy -= p * Math.log2(p);
      }
    }

    // Max entropy for 5 dimensions = log₂(5) ≈ 2.32
    const maxEntropy = Math.log2(dimensionCoverages.length);
    
    // Return normalized entropy [0, 1]
    return entropy / maxEntropy;
  }

  /**
   * Validate monotonicity property:
   * Adding traits should never decrease IG score
   * 
   * @param profile - User profile
   * @param newTrait - Trait to add
   * @returns True if IG increases or stays same
   */
  public validateMonotonicity(
    profile: UserProfile5D,
    dimension: 'values' | 'interests' | 'communication' | 'lifestyle' | 'goals',
    traitKey: string
  ): boolean {
    // Calculate IG before
    const igBefore = this.calculateSingle(profile);

    // Simulate adding a trait
    const dimensionMap = profile[dimension];
    const hadTrait = dimensionMap.has(traitKey);
    
    if (hadTrait) {
      // Already has trait, monotonicity holds
      return true;
    }

    // Add mock trait temporarily
    const mockTrait = {
      dimension,
      trait: traitKey,
      value: 0.5,
      confidence: 0.5,
      source: 'inferred' as const,
    };
    
    dimensionMap.set(traitKey, mockTrait);

    // Calculate IG after
    const igAfter = this.calculateSingle(profile);

    // Remove mock trait
    dimensionMap.delete(traitKey);

    // Verify monotonicity: IG should not decrease
    return igAfter.score >= igBefore.score;
  }

  /**
   * Calculate minimum additional traits needed to reach target IG score
   * 
   * @param profile - User profile
   * @param targetScore - Desired IG score [0, 1]
   * @returns Number of additional traits needed
   */
  public calculateTraitsNeeded(profile: UserProfile5D, targetScore: number): number {
    const current = this.calculateSingle(profile);
    
    if (current.score >= targetScore) {
      return 0;
    }

    // Estimate based on current coverage
    const currentTraits = this.countTotalTraits(profile);
    const targetCoverage = targetScore / (current.avgConfidence || 0.5);
    const targetTraits = Math.ceil(targetCoverage * this.TOTAL_EXPECTED_TRAITS);

    return Math.max(0, targetTraits - currentTraits);
  }

  /**
   * Count total traits across all dimensions
   */
  private countTotalTraits(profile: UserProfile5D): number {
    return (
      profile.values.size +
      profile.interests.size +
      profile.communication.size +
      profile.lifestyle.size +
      profile.goals.size
    );
  }

  /**
   * Clamp value to range [min, max]
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Batch calculate IG scores for multiple user pairs
   * 
   * @param userProfile - User's profile
   * @param candidateProfiles - Array of candidate profiles
   * @returns Array of IG scores
   * 
   * Time Complexity: O(n·m) where n=candidates, m=avg traits
   */
  public batchCalculate(
    userProfile: UserProfile5D,
    candidateProfiles: UserProfile5D[]
  ): number[] {
    return candidateProfiles.map(candidate => this.calculate(userProfile, candidate));
  }
}
