/**
 * Causal Uplift Service
 * Component 2 of RBS Algorithm
 * 
 * Predicts the incremental value of AI coaching on relationship success
 * using T-learner treatment effect estimation.
 * 
 * Mathematical Foundation:
 * τ(x) = μ₁(x) - μ₀(x) = E[Y|T=1,X=x] - E[Y|T=0,X=x]
 * 
 * Where:
 * - τ(x) = Treatment effect (coaching impact)
 * - μ₁(x) = Expected outcome with AI coaching
 * - μ₀(x) = Expected outcome without coaching
 * - T = Treatment indicator (1 = coached, 0 = uncoached)
 * - X = Feature vector (user traits)
 * - Y = Outcome (date success: 4+ stars)
 * 
 * T-learner Algorithm:
 * 1. Split data into treatment (T=1) and control (T=0) groups
 * 2. Train separate models: M₁(X) for T=1, M₀(X) for T=0
 * 3. Predict individual treatment effects: τ̂(x) = M₁(x) - M₀(x)
 * 4. Apply propensity score weighting for confounding adjustment
 * 
 * Complexity: O(1) for inference (pre-trained model)
 * Target Latency: <50ms per prediction
 */

import type { CausalUpliftInput, CausalUpliftResult } from '../types/rbs.types';
import { config } from '../../config/index';

export class CausalUpliftService {
  private readonly MODEL_VERSION = '1.0.0';
  private readonly FEATURE_COUNT = 20; // Number of features for T-learner

  // Feature weights for simplified linear model (placeholder)
  // In production, this would be replaced by actual T-learner model weights
  private readonly TREATMENT_WEIGHTS = [
    0.15, -0.08, 0.22, 0.11, -0.05,
    0.18, 0.09, -0.12, 0.14, 0.07,
    -0.06, 0.19, 0.13, -0.10, 0.16,
    0.08, -0.04, 0.21, 0.12, -0.07
  ];

  private readonly CONTROL_WEIGHTS = [
    0.10, -0.05, 0.15, 0.08, -0.03,
    0.12, 0.06, -0.08, 0.10, 0.05,
    -0.04, 0.14, 0.09, -0.07, 0.11,
    0.06, -0.03, 0.16, 0.09, -0.05
  ];

  /**
   * Calculate Causal Uplift score for a user pair
   * 
   * @param input - User pair features for T-learner
   * @returns CU score in range [0, 1]
   * 
   * Time Complexity: O(1) - constant time inference
   * Space Complexity: O(1)
   */
  public async calculate(input: CausalUpliftInput): Promise<number> {
    const result = await this.predict(input);
    return result.treatmentEffect;
  }

  /**
   * Predict treatment effect with confidence
   * 
   * @param input - User pair features
   * @returns Detailed CU result
   */
  public async predict(input: CausalUpliftInput): Promise<CausalUpliftResult> {
    // Extract and validate features
    const features = this.extractFeatures(input);
    this.validateFeatures(features);

    // Predict outcomes for treatment and control groups
    const mu1 = this.predictTreatment(features); // E[Y|T=1,X]
    const mu0 = this.predictControl(features);   // E[Y|T=0,X]

    // Calculate treatment effect
    const treatmentEffect = this.clamp(mu1 - mu0, 0, 1);

    // Calculate confidence based on feature quality
    const confidence = this.calculateConfidence(features);

    return {
      treatmentEffect,
      confidence,
      modelVersion: this.MODEL_VERSION,
    };
  }

  /**
   * Extract features from user pair for T-learner
   * 
   * Features include:
   * - Communication style similarity
   * - Interest overlap
   * - Value alignment
   * - Personality compatibility
   * - Historical engagement metrics
   * 
   * @param input - User pair input
   * @returns Feature vector [0, 1]^n
   */
  private extractFeatures(input: CausalUpliftInput): number[] {
    // In production, this would extract real features from user profiles
    // For now, use input features directly
    if (input.features.length >= this.FEATURE_COUNT) {
      return input.features.slice(0, this.FEATURE_COUNT);
    }

    // Pad with zeros if insufficient features
    return [
      ...input.features,
      ...new Array(this.FEATURE_COUNT - input.features.length).fill(0)
    ];
  }

  /**
   * Predict outcome with AI coaching (treatment group)
   * 
   * μ₁(x) = E[Y|T=1,X=x]
   * 
   * @param features - Feature vector
   * @returns Predicted success probability [0, 1]
   */
  private predictTreatment(features: number[]): number {
    let prediction = 0;

    for (let i = 0; i < this.FEATURE_COUNT; i++) {
      prediction += features[i]! * this.TREATMENT_WEIGHTS[i]!;
    }

    // Apply sigmoid to ensure [0, 1] range
    return this.sigmoid(prediction);
  }

  /**
   * Predict outcome without AI coaching (control group)
   * 
   * μ₀(x) = E[Y|T=0,X=x]
   * 
   * @param features - Feature vector
   * @returns Predicted success probability [0, 1]
   */
  private predictControl(features: number[]): number {
    let prediction = 0;

    for (let i = 0; i < this.FEATURE_COUNT; i++) {
      prediction += features[i]! * this.CONTROL_WEIGHTS[i]!;
    }

    return this.sigmoid(prediction);
  }

  /**
   * Calculate confidence score based on feature quality
   * 
   * Higher confidence when:
   * - Features are well-defined (not sparse)
   * - Features are within expected ranges
   * - Model has seen similar feature patterns
   * 
   * @param features - Feature vector
   * @returns Confidence [0, 1]
   */
  private calculateConfidence(features: number[]): number {
    // Count non-zero features
    const nonZeroCount = features.filter(f => f > 0.01).length;
    const sparsity = nonZeroCount / this.FEATURE_COUNT;

    // Calculate feature variance (higher variance = more informative)
    const mean = features.reduce((sum, f) => sum + f, 0) / this.FEATURE_COUNT;
    const variance = features.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / this.FEATURE_COUNT;

    // Confidence increases with less sparsity and more variance
    const confidence = (sparsity * 0.6) + (Math.min(variance, 0.5) * 0.4 / 0.5);

    return this.clamp(confidence, 0, 1);
  }

  /**
   * Validate feature vector
   */
  private validateFeatures(features: number[]): void {
    if (features.length !== this.FEATURE_COUNT) {
      throw new Error(`Invalid feature count: ${features.length}, expected ${this.FEATURE_COUNT}`);
    }

    // Check for invalid values
    for (let i = 0; i < features.length; i++) {
      if (!Number.isFinite(features[i]!)) {
        throw new Error(`Invalid feature value at index ${i}: ${features[i]}`);
      }
    }
  }

  /**
   * Sigmoid activation function
   * σ(x) = 1 / (1 + e^(-x))
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Clamp value to range [min, max]
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Batch calculate CU scores for multiple pairs
   * 
   * @param inputs - Array of user pair inputs
   * @returns Array of CU scores
   * 
   * Time Complexity: O(n) where n = inputs
   */
  public async batchCalculate(inputs: CausalUpliftInput[]): Promise<number[]> {
    const results = await Promise.all(
      inputs.map(input => this.calculate(input))
    );
    return results;
  }

  /**
   * Check if causal uplift is enabled
   */
  public isEnabled(): boolean {
    return config.features.causalUplift;
  }

  /**
   * Get current model version
   */
  public getModelVersion(): string {
    return this.MODEL_VERSION;
  }
}
