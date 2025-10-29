/**
 * Trait Repository
 * Data access layer for UserTrait model (5D Profile Storage)
 * 
 * Handles:
 * - 5D trait CRUD operations (values, interests, communication, lifestyle, goals)
 * - Confidence tracking
 * - Batch operations for efficient updates
 * - Trait aggregation by dimension
 * 
 * Performance: <100ms p95 for all operations
 * Complexity: O(1) for single operations, O(n) for batch
 */

import { PrismaClient, UserTrait, Prisma } from '@prisma/client';

export interface CreateTraitInput {
  userId: string;
  dimension: 'values' | 'interests' | 'communication' | 'lifestyle' | 'goals';
  trait: string;
  value: number;
  confidence: number;
  source: 'conversation' | 'explicit' | 'inferred';
}

export interface UpdateTraitInput {
  value?: number;
  confidence?: number;
}

export interface TraitsByDimension {
  values: UserTrait[];
  interests: UserTrait[];
  communication: UserTrait[];
  lifestyle: UserTrait[];
  goals: UserTrait[];
}

export class TraitRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Create or update a trait (upsert operation)
   * 
   * @param input - Trait data
   * @returns Created or updated trait
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async upsert(input: CreateTraitInput): Promise<UserTrait> {
    return this.prisma.userTrait.upsert({
      where: {
        userId_dimension_trait: {
          userId: input.userId,
          dimension: input.dimension,
          trait: input.trait,
        },
      },
      update: {
        value: input.value,
        confidence: input.confidence,
        source: input.source,
        extractedAt: new Date(),
      },
      create: {
        userId: input.userId,
        dimension: input.dimension,
        trait: input.trait,
        value: input.value,
        confidence: input.confidence,
        source: input.source,
      },
    });
  }

  /**
   * Batch upsert traits for efficient bulk operations
   * 
   * @param inputs - Array of trait inputs
   * @returns Array of upserted traits
   * 
   * Time Complexity: O(n)
   * Target Latency: <200ms for n=50
   */
  async batchUpsert(inputs: CreateTraitInput[]): Promise<UserTrait[]> {
    const results: UserTrait[] = [];

    // Use transaction for atomicity
    await this.prisma.$transaction(async (tx) => {
      for (const input of inputs) {
        const trait = await tx.userTrait.upsert({
          where: {
            userId_dimension_trait: {
              userId: input.userId,
              dimension: input.dimension,
              trait: input.trait,
            },
          },
          update: {
            value: input.value,
            confidence: input.confidence,
            source: input.source,
            extractedAt: new Date(),
          },
          create: {
            userId: input.userId,
            dimension: input.dimension,
            trait: input.trait,
            value: input.value,
            confidence: input.confidence,
            source: input.source,
          },
        });
        results.push(trait);
      }
    });

    return results;
  }

  /**
   * Find all traits for a user
   * 
   * @param userId - User ID
   * @returns Array of all user traits
   * 
   * Time Complexity: O(n) where n = trait count
   * Target Latency: <100ms
   */
  async findByUserId(userId: string): Promise<UserTrait[]> {
    return this.prisma.userTrait.findMany({
      where: { userId },
      orderBy: {
        extractedAt: 'desc',
      },
    });
  }

  /**
   * Find traits by dimension for a user
   * 
   * @param userId - User ID
   * @param dimension - Trait dimension
   * @returns Array of traits in that dimension
   * 
   * Time Complexity: O(n) where n = traits in dimension
   * Target Latency: <50ms
   */
  async findByDimension(
    userId: string,
    dimension: 'values' | 'interests' | 'communication' | 'lifestyle' | 'goals'
  ): Promise<UserTrait[]> {
    return this.prisma.userTrait.findMany({
      where: {
        userId,
        dimension,
      },
      orderBy: {
        confidence: 'desc',
      },
    });
  }

  /**
   * Get all traits organized by dimension (5D profile structure)
   * 
   * @param userId - User ID
   * @returns Traits organized by dimension
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findAllByDimensions(userId: string): Promise<TraitsByDimension> {
    const allTraits = await this.findByUserId(userId);

    const result: TraitsByDimension = {
      values: [],
      interests: [],
      communication: [],
      lifestyle: [],
      goals: [],
    };

    for (const trait of allTraits) {
      const dimension = trait.dimension as keyof TraitsByDimension;
      result[dimension].push(trait);
    }

    return result;
  }

  /**
   * Find specific trait
   * 
   * @param userId - User ID
   * @param dimension - Trait dimension
   * @param trait - Trait name
   * @returns Trait or null
   * 
   * Time Complexity: O(1) with composite index
   * Target Latency: <50ms
   */
  async findOne(
    userId: string,
    dimension: string,
    trait: string
  ): Promise<UserTrait | null> {
    return this.prisma.userTrait.findUnique({
      where: {
        userId_dimension_trait: {
          userId,
          dimension,
          trait,
        },
      },
    });
  }

  /**
   * Update trait confidence and value
   * 
   * @param userId - User ID
   * @param dimension - Trait dimension
   * @param trait - Trait name
   * @param input - Update data
   * @returns Updated trait
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async update(
    userId: string,
    dimension: string,
    trait: string,
    input: UpdateTraitInput
  ): Promise<UserTrait> {
    const updateData: Prisma.UserTraitUpdateInput = {};

    if (input.value !== undefined) {
      updateData.value = input.value;
    }

    if (input.confidence !== undefined) {
      updateData.confidence = input.confidence;
    }

    return this.prisma.userTrait.update({
      where: {
        userId_dimension_trait: {
          userId,
          dimension,
          trait,
        },
      },
      data: updateData,
    });
  }

  /**
   * Delete a specific trait
   * 
   * @param userId - User ID
   * @param dimension - Trait dimension
   * @param trait - Trait name
   * @returns Deleted trait
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async delete(userId: string, dimension: string, trait: string): Promise<UserTrait> {
    return this.prisma.userTrait.delete({
      where: {
        userId_dimension_trait: {
          userId,
          dimension,
          trait,
        },
      },
    });
  }

  /**
   * Delete all traits for a user
   * 
   * @param userId - User ID
   * @returns Count of deleted traits
   * 
   * Time Complexity: O(n)
   * Target Latency: <200ms
   */
  async deleteAllByUserId(userId: string): Promise<number> {
    const result = await this.prisma.userTrait.deleteMany({
      where: { userId },
    });

    return result.count;
  }

  /**
   * Count traits for a user
   * 
   * @param userId - User ID
   * @returns Total trait count
   * 
   * Time Complexity: O(1)
   * Target Latency: <50ms
   */
  async count(userId: string): Promise<number> {
    return this.prisma.userTrait.count({
      where: { userId },
    });
  }

  /**
   * Count traits by dimension for a user
   * 
   * @param userId - User ID
   * @param dimension - Trait dimension
   * @returns Trait count in dimension
   * 
   * Time Complexity: O(1)
   * Target Latency: <50ms
   */
  async countByDimension(
    userId: string,
    dimension: string
  ): Promise<number> {
    return this.prisma.userTrait.count({
      where: {
        userId,
        dimension,
      },
    });
  }

  /**
   * Get average confidence across all traits for a user
   * 
   * @param userId - User ID
   * @returns Average confidence [0, 1]
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async getAverageConfidence(userId: string): Promise<number> {
    const result = await this.prisma.userTrait.aggregate({
      where: { userId },
      _avg: {
        confidence: true,
      },
    });

    return result._avg.confidence || 0;
  }

  /**
   * Find traits with confidence above threshold
   * 
   * @param userId - User ID
   * @param minConfidence - Minimum confidence threshold
   * @returns High-confidence traits
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findHighConfidence(userId: string, minConfidence: number): Promise<UserTrait[]> {
    return this.prisma.userTrait.findMany({
      where: {
        userId,
        confidence: {
          gte: minConfidence,
        },
      },
      orderBy: {
        confidence: 'desc',
      },
    });
  }

  /**
   * Get trait count by dimension for a user
   * 
   * @param userId - User ID
   * @returns Object with counts per dimension
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async getCountsByDimension(userId: string): Promise<Record<string, number>> {
    const traits = await this.findByUserId(userId);

    const counts: Record<string, number> = {
      values: 0,
      interests: 0,
      communication: 0,
      lifestyle: 0,
      goals: 0,
    };

    for (const trait of traits) {
      counts[trait.dimension] = (counts[trait.dimension] || 0) + 1;
    }

    return counts;
  }

  /**
   * Disconnect Prisma client (cleanup)
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
