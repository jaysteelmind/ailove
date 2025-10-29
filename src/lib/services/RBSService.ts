/**
 * RBS (Resonance-Based Scoring) Service
 * Main Orchestrator for 4-Component Matching Algorithm
 * 
 * Combines all RBS components into final compatibility score:
 * RBS(u₁, u₂) = α·SR + β·CU + γ·IG - δ·SC
 * 
 * Components:
 * 1. Subspace Resonance (SR) - Multi-dimensional compatibility
 * 2. Causal Uplift (CU) - AI coaching impact prediction
 * 3. Information Gain (IG) - Profile completeness
 * 4. Safety Constraints (SC) - Red flags and penalties
 * 
 * Weights (probability simplex constraint: α + β + γ = 1.0):
 * - α = 0.45 (SR - primary compatibility driver)
 * - β = 0.30 (CU - coaching potential)
 * - γ = 0.25 (IG - profile confidence)
 * - δ = 0.15 (SC - penalty cap)
 * 
 * Performance: <300ms p95 latency
 * Complexity: O(d·k) dominated by SR calculation
 */

import { SubspaceResonanceService } from './SubspaceResonanceService';
import { CausalUpliftService } from './CausalUpliftService';
import { InformationGainService } from './InformationGainService';
import { SafetyConstraintsService, UserSafetyProfile } from './SafetyConstraintsService';
import type { 
  EmbeddingVector, 
  UserProfile5D, 
  RBSScore, 
  RBSWeights,
  CausalUpliftInput,
  PerformanceMetrics
} from '../types/rbs.types';
import { config } from '../../config/index';

export interface RBSInput {
  user1: {
    userId: string;
    embedding: EmbeddingVector;
    profile5D: UserProfile5D;
    safetyProfile: UserSafetyProfile;
  };
  user2: {
    userId: string;
    embedding: EmbeddingVector;
    profile5D: UserProfile5D;
    safetyProfile: UserSafetyProfile;
  };
  causalFeatures?: number[]; // Optional pre-computed features for CU
}

export class RBSService {
  private readonly srService: SubspaceResonanceService;
  private readonly cuService: CausalUpliftService;
  private readonly igService: InformationGainService;
  private readonly scService: SafetyConstraintsService;
  
  private readonly weights: RBSWeights;

  constructor() {
    // Initialize all component services
    this.srService = new SubspaceResonanceService();
    this.cuService = new CausalUpliftService();
    this.igService = new InformationGainService();
    this.scService = new SafetyConstraintsService();

    // Load weights from config
    this.weights = config.rbs.weights;
    this.validateWeights();
  }

  /**
   * Calculate complete RBS score for a user pair
   * 
   * @param input - User pair data with all required components
   * @returns RBS score with component breakdown
   * 
   * Mathematical Formula:
   * RBS = α·SR + β·CU + γ·IG - δ·SC
   * 
   * Time Complexity: O(d·k) where d=768, k=5 (dominated by SR)
   * Target Latency: <300ms p95
   */
  public async calculate(input: RBSInput): Promise<RBSScore> {
    const startTime = performance.now();

    // Calculate all 4 components in parallel where possible
    const [sr, cu, ig, sc] = await Promise.all([
      // Component 1: Subspace Resonance
      this.calculateSR(input),
      
      // Component 2: Causal Uplift
      this.calculateCU(input),
      
      // Component 3: Information Gain (sync, but wrapped in Promise)
      Promise.resolve(this.calculateIG(input)),
      
      // Component 4: Safety Constraints (sync, but wrapped in Promise)
      Promise.resolve(this.calculateSC(input)),
    ]);

    // Apply RBS formula with weights
    const total = this.clamp(
      this.weights.alpha * sr +
      this.weights.beta * cu +
      this.weights.gamma * ig -
      this.weights.delta * sc,
      0,
      1
    );

    const duration = performance.now() - startTime;

    // Validate performance target
    if (duration > config.performance.rbsPipeline) {
      console.warn(`RBS calculation exceeded target: ${duration.toFixed(2)}ms > ${config.performance.rbsPipeline}ms`);
    }

    return {
      total,
      sr,
      cu,
      ig,
      sc,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate Subspace Resonance component
   */
  private async calculateSR(input: RBSInput): Promise<number> {
    return Promise.resolve(
      this.srService.calculate(input.user1.embedding, input.user2.embedding)
    );
  }

  /**
   * Calculate Causal Uplift component
   */
  private async calculateCU(input: RBSInput): Promise<number> {
    // Use pre-computed features if available, otherwise extract
    const features = input.causalFeatures || this.extractCausalFeatures(input);

    const cuInput: CausalUpliftInput = {
      userId: input.user1.userId,
      partnerId: input.user2.userId,
      features,
    };

    return this.cuService.calculate(cuInput);
  }

  /**
   * Calculate Information Gain component
   */
  private calculateIG(input: RBSInput): number {
    return this.igService.calculate(input.user1.profile5D, input.user2.profile5D);
  }

  /**
   * Calculate Safety Constraints component
   */
  private calculateSC(input: RBSInput): number {
    return this.scService.calculate(input.user1.safetyProfile, input.user2.safetyProfile);
  }

  /**
   * Extract features for causal uplift model from user profiles
   * 
   * Creates 20-dimensional feature vector from:
   * - Profile completeness metrics (4 features)
   * - Demographic alignment (6 features)
   * - Communication style similarity (5 features)
   * - Interest overlap (5 features)
   */
  private extractCausalFeatures(input: RBSInput): number[] {
    const features: number[] = [];

    // Profile completeness (4 features)
    const ig1 = this.igService.calculateDetailed(input.user1.profile5D);
    const ig2 = this.igService.calculateDetailed(input.user2.profile5D);
    features.push(
      ig1.coverage,
      ig2.coverage,
      ig1.avgConfidence,
      ig2.avgConfidence
    );

    // Demographic alignment (6 features)
    const ageGap = Math.abs(input.user1.safetyProfile.age - input.user2.safetyProfile.age);
    const ageDiff = ageGap / 50; // Normalize by max age gap
    features.push(
      ageDiff,
      input.user1.safetyProfile.age / 100, // Normalized age
      input.user2.safetyProfile.age / 100,
      input.user1.safetyProfile.redFlags.length / 5, // Normalized flag count
      input.user2.safetyProfile.redFlags.length / 5,
      ig1.entropyReduction
    );

    // Communication style similarity (5 features)
    const commEmbedding1 = input.user1.embedding.slice(384, 448); // Communication subspace
    const commEmbedding2 = input.user2.embedding.slice(384, 448);
    const commSimilarity = this.cosineSimilarity(commEmbedding1, commEmbedding2);
    features.push(
      commSimilarity,
      input.user1.profile5D.communication.size / 10, // Normalized trait count
      input.user2.profile5D.communication.size / 10,
      ig2.entropyReduction,
      (ig1.avgConfidence + ig2.avgConfidence) / 2
    );

    // Interest overlap (5 features)
    const interestEmbedding1 = input.user1.embedding.slice(128, 384); // Interest subspace
    const interestEmbedding2 = input.user2.embedding.slice(128, 384);
    const interestSimilarity = this.cosineSimilarity(interestEmbedding1, interestEmbedding2);
    features.push(
      interestSimilarity,
      input.user1.profile5D.interests.size / 20, // Normalized trait count
      input.user2.profile5D.interests.size / 20,
      (input.user1.profile5D.interests.size + input.user2.profile5D.interests.size) / 40,
      (ig1.coverage + ig2.coverage) / 2
    );

    // Ensure exactly 20 features
    return features.slice(0, 20);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < Math.min(v1.length, v2.length); i++) {
      dotProduct += v1[i]! * v2[i]!;
      mag1 += v1[i]! * v1[i]!;
      mag2 += v2[i]! * v2[i]!;
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (mag1 * mag2);
  }

  /**
   * Batch calculate RBS scores for multiple user pairs
   * 
   * @param inputs - Array of user pair inputs
   * @returns Array of RBS scores
   * 
   * Time Complexity: O(n·d·k) where n=pairs, d=768, k=5
   */
  public async batchCalculate(inputs: RBSInput[]): Promise<RBSScore[]> {
    return Promise.all(inputs.map(input => this.calculate(input)));
  }

  /**
   * Calculate RBS score for one user against multiple candidates
   * Optimized for matching scenarios
   * 
   * @param user - User data
   * @param candidates - Array of candidate user data
   * @returns Array of RBS scores
   * 
   * Time Complexity: O(n·d·k) where n=candidates
   */
  public async calculateMatches(
    user: RBSInput['user1'],
    candidates: RBSInput['user2'][]
  ): Promise<RBSScore[]> {
    const inputs: RBSInput[] = candidates.map(candidate => ({
      user1: user,
      user2: candidate,
    }));

    return this.batchCalculate(inputs);
  }

  /**
   * Get performance metrics for last calculation
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return {
      operationName: 'RBS.calculate',
      startTime: 0,
      endTime: 0,
      duration: 0,
      complexity: 'O(d·k) where d=768, k=5',
    };
  }

  /**
   * Validate RBS weights satisfy probability simplex constraint
   */
  private validateWeights(): void {
    const { alpha, beta, gamma, delta } = this.weights;

    // α + β + γ should equal 1.0
    const sum = alpha + beta + gamma;
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(`RBS weights must sum to 1.0: α=${alpha} + β=${beta} + γ=${gamma} = ${sum}`);
    }

    // δ should be in reasonable range
    if (delta < 0 || delta > 0.3) {
      throw new Error(`RBS delta penalty must be in [0, 0.3]: δ=${delta}`);
    }

    // All weights should be positive
    if (alpha <= 0 || beta <= 0 || gamma <= 0 || delta < 0) {
      throw new Error('All RBS weights must be positive');
    }
  }

  /**
   * Clamp value to range [min, max]
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Get current RBS weights
   */
  public getWeights(): RBSWeights {
    return { ...this.weights };
  }
}
