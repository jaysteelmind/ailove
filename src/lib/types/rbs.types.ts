/**
 * RBS Algorithm Core Types
 * Mathematical type definitions for Resonance-Based Scoring
 */

/**
 * 768-dimensional embedding vector
 * Structured as: Values(128) + Interests(256) + Communication(64) + Lifestyle(96) + Goals(80)
 */
export type EmbeddingVector = number[];

/**
 * Subspace definition for trait dimensions
 */
export interface Subspace {
  name: 'values' | 'interests' | 'communication' | 'lifestyle' | 'goals';
  start: number;
  end: number;
  weight: number;
}

/**
 * RBS Component Scores (all in range [0, 1])
 */
export interface RBSComponents {
  sr: number;  // Subspace Resonance
  cu: number;  // Causal Uplift
  ig: number;  // Information Gain
  sc: number;  // Safety Constraints
}

/**
 * Complete RBS Score Result
 */
export interface RBSScore extends RBSComponents {
  total: number;  // Final weighted score [0, 1]
  timestamp: Date;
}

/**
 * RBS Algorithm Weights
 */
export interface RBSWeights {
  alpha: number;  // SR weight (default: 0.45)
  beta: number;   // CU weight (default: 0.30)
  gamma: number;  // IG weight (default: 0.25)
  delta: number;  // SC penalty (default: 0.15)
}

/**
 * User trait with confidence tracking
 */
export interface UserTrait {
  dimension: 'values' | 'interests' | 'communication' | 'lifestyle' | 'goals';
  trait: string;
  value: number;      // [0, 1] normalized
  confidence: number; // [0, 1] extraction confidence
  source: 'conversation' | 'explicit' | 'inferred';
}

/**
 * 5D User Profile
 */
export interface UserProfile5D {
  userId: string;
  values: Map<string, UserTrait>;
  interests: Map<string, UserTrait>;
  communication: Map<string, UserTrait>;
  lifestyle: Map<string, UserTrait>;
  goals: Map<string, UserTrait>;
  embedding?: EmbeddingVector;
  knowYouMeterScore: number; // [0, 100]
}

/**
 * Causal Uplift Prediction Input
 */
export interface CausalUpliftInput {
  userId: string;
  partnerId: string;
  features: number[]; // Feature vector for T-learner
}

/**
 * Causal Uplift Prediction Result
 */
export interface CausalUpliftResult {
  treatmentEffect: number;  // τ(x) = μ₁(x) - μ₀(x)
  confidence: number;       // [0, 1]
  modelVersion: string;
}

/**
 * Information Gain Calculation
 */
export interface InformationGainResult {
  score: number;           // [0, 1]
  coverage: number;        // % of traits extracted
  avgConfidence: number;   // Mean confidence across traits
  entropyReduction: number; // Bits of uncertainty reduced
}

/**
 * Safety Constraints Evaluation
 */
export interface SafetyConstraintsResult {
  score: number;           // [0, 1] penalty
  flags: SafetyFlag[];
  distancePenalty: number;
  agePenalty: number;
}

export interface SafetyFlag {
  type: 'red_flag' | 'yellow_flag' | 'distance' | 'age_gap';
  severity: number;        // [0, 1]
  description: string;
}

/**
 * Match candidate with scores
 */
export interface MatchCandidate {
  userId: string;
  rbsScore: RBSScore;
  distance: number;        // km
  lastActive: Date;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;        // milliseconds
  complexity: string;      // e.g., "O(n log n)"
}
