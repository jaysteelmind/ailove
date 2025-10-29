/**
 * Match Repository
 * Data access layer for Match model (RBS Score Storage)
 * 
 * Handles:
 * - RBS score persistence with component breakdown
 * - Match status management (pending, accepted, rejected, expired)
 * - Expiration handling
 * - Match discovery queries
 * 
 * Performance: <100ms p95 for all operations
 * Complexity: O(1) for single operations, O(n) for batch
 */

import { PrismaClient, Match, Prisma } from '@prisma/client';

export interface CreateMatchInput {
  userId: string;
  matchedUserId: string;
  rbsScore: number;
  srScore: number;
  cuScore: number;
  igScore: number;
  scScore: number;
  expiresAt: Date;
}

export interface UpdateMatchInput {
  status?: 'pending' | 'accepted' | 'rejected' | 'expired';
  viewedAt?: Date;
  respondedAt?: Date;
}

export interface MatchWithUsers extends Match {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  matchedUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export class MatchRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Create a new match with RBS scores
   * 
   * @param input - Match creation data
   * @returns Created match
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async create(input: CreateMatchInput): Promise<Match> {
    try {
      return await this.prisma.match.create({
        data: {
          userId: input.userId,
          matchedUserId: input.matchedUserId,
          rbsScore: input.rbsScore,
          srScore: input.srScore,
          cuScore: input.cuScore,
          igScore: input.igScore,
          scScore: input.scScore,
          status: 'pending',
          expiresAt: input.expiresAt,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('Match already exists');
        }
      }
      throw error;
    }
  }

  /**
   * Batch create matches for efficient bulk operations
   * 
   * @param inputs - Array of match inputs
   * @returns Array of created matches
   * 
   * Time Complexity: O(n)
   * Target Latency: <200ms for n=20
   */
  async batchCreate(inputs: CreateMatchInput[]): Promise<Match[]> {
    return this.prisma.$transaction(
      inputs.map(input =>
        this.prisma.match.create({
          data: {
            userId: input.userId,
            matchedUserId: input.matchedUserId,
            rbsScore: input.rbsScore,
            srScore: input.srScore,
            cuScore: input.cuScore,
            igScore: input.igScore,
            scScore: input.scScore,
            status: 'pending',
            expiresAt: input.expiresAt,
          },
        })
      )
    );
  }

  /**
   * Find match by ID
   * 
   * @param matchId - Match ID
   * @returns Match or null
   * 
   * Time Complexity: O(1)
   * Target Latency: <50ms
   */
  async findById(matchId: string): Promise<Match | null> {
    return this.prisma.match.findUnique({
      where: { id: matchId },
    });
  }

  /**
   * Find match between two users
   * 
   * @param userId - First user ID
   * @param matchedUserId - Second user ID
   * @returns Match or null
   * 
   * Time Complexity: O(1) with composite index
   * Target Latency: <50ms
   */
  async findByUserPair(userId: string, matchedUserId: string): Promise<Match | null> {
    return this.prisma.match.findUnique({
      where: {
        userId_matchedUserId: {
          userId,
          matchedUserId,
        },
      },
    });
  }

  /**
   * Find all matches for a user by status
   * 
   * @param userId - User ID
   * @param status - Match status filter
   * @returns Array of matches
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findByUserAndStatus(
    userId: string,
    status: 'pending' | 'accepted' | 'rejected' | 'expired'
  ): Promise<Match[]> {
    return this.prisma.match.findMany({
      where: {
        userId,
        status,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find pending matches for a user (discovery)
   * 
   * @param userId - User ID
   * @param limit - Maximum results
   * @returns Array of pending matches sorted by RBS score
   * 
   * Time Complexity: O(n log n) for sorting
   * Target Latency: <100ms
   */
  async findPendingMatches(userId: string, limit: number = 20): Promise<Match[]> {
    return this.prisma.match.findMany({
      where: {
        userId,
        status: 'pending',
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      orderBy: {
        rbsScore: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Find top matches by RBS score
   * 
   * @param userId - User ID
   * @param minScore - Minimum RBS score threshold
   * @param limit - Maximum results
   * @returns Array of high-scoring matches
   * 
   * Time Complexity: O(n log n)
   * Target Latency: <100ms
   */
  async findTopMatches(
    userId: string,
    minScore: number = 0.7,
    limit: number = 10
  ): Promise<Match[]> {
    return this.prisma.match.findMany({
      where: {
        userId,
        status: 'pending',
        rbsScore: {
          gte: minScore,
        },
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        rbsScore: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Update match status
   * 
   * @param matchId - Match ID
   * @param input - Update data
   * @returns Updated match
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async update(matchId: string, input: UpdateMatchInput): Promise<Match> {
    const updateData: Prisma.MatchUpdateInput = {};

    if (input.status) {
      updateData.status = input.status;
    }

    if (input.viewedAt) {
      updateData.viewedAt = input.viewedAt;
    }

    if (input.respondedAt) {
      updateData.respondedAt = input.respondedAt;
    }

    return this.prisma.match.update({
      where: { id: matchId },
      data: updateData,
    });
  }

  /**
   * Accept a match (mutual match)
   * 
   * @param matchId - Match ID
   * @returns Updated match
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async accept(matchId: string): Promise<Match> {
    return this.update(matchId, {
      status: 'accepted',
      respondedAt: new Date(),
    });
  }

  /**
   * Reject a match
   * 
   * @param matchId - Match ID
   * @returns Updated match
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async reject(matchId: string): Promise<Match> {
    return this.update(matchId, {
      status: 'rejected',
      respondedAt: new Date(),
    });
  }

  /**
   * Mark match as viewed
   * 
   * @param matchId - Match ID
   * @returns Updated match
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async markAsViewed(matchId: string): Promise<Match> {
    return this.update(matchId, {
      viewedAt: new Date(),
    });
  }

  /**
   * Expire old pending matches
   * 
   * @returns Count of expired matches
   * 
   * Time Complexity: O(n)
   * Target Latency: <200ms
   */
  async expireOldMatches(): Promise<number> {
    const result = await this.prisma.match.updateMany({
      where: {
        status: 'pending',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'expired',
      },
    });

    return result.count;
  }

  /**
   * Delete a match
   * 
   * @param matchId - Match ID
   * @returns Deleted match
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async delete(matchId: string): Promise<Match> {
    return this.prisma.match.delete({
      where: { id: matchId },
    });
  }

  /**
   * Count matches by status for a user
   * 
   * @param userId - User ID
   * @param status - Match status
   * @returns Match count
   * 
   * Time Complexity: O(1)
   * Target Latency: <50ms
   */
  async countByStatus(userId: string, status: string): Promise<number> {
    return this.prisma.match.count({
      where: {
        userId,
        status,
      },
    });
  }

  /**
   * Get match statistics for a user
   * 
   * @param userId - User ID
   * @returns Object with match counts by status
   * 
   * Time Complexity: O(1) per status
   * Target Latency: <100ms
   */
  async getMatchStats(userId: string): Promise<{
    pending: number;
    accepted: number;
    rejected: number;
    expired: number;
    total: number;
  }> {
    const [pending, accepted, rejected, expired, total] = await Promise.all([
      this.countByStatus(userId, 'pending'),
      this.countByStatus(userId, 'accepted'),
      this.countByStatus(userId, 'rejected'),
      this.countByStatus(userId, 'expired'),
      this.prisma.match.count({ where: { userId } }),
    ]);

    return { pending, accepted, rejected, expired, total };
  }

  /**
   * Get average RBS score for user's matches
   * 
   * @param userId - User ID
   * @returns Average RBS score
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async getAverageRbsScore(userId: string): Promise<number> {
    const result = await this.prisma.match.aggregate({
      where: { userId },
      _avg: {
        rbsScore: true,
      },
    });

    return result._avg.rbsScore || 0;
  }

  /**
   * Find mutual matches (both users matched with each other)
   * 
   * @param userId - User ID
   * @returns Array of mutual matches
   * 
   * Time Complexity: O(n)
   * Target Latency: <200ms
   */
  async findMutualMatches(userId: string): Promise<Match[]> {
    // Find matches where user accepted
    const userAccepted = await this.prisma.match.findMany({
      where: {
        userId,
        status: 'accepted',
      },
    });

    // Check if matched users also accepted
    const mutualMatchIds: string[] = [];

    for (const match of userAccepted) {
      const reverseMatch = await this.findByUserPair(match.matchedUserId, userId);
      if (reverseMatch && reverseMatch.status === 'accepted') {
        mutualMatchIds.push(match.id);
      }
    }

    return this.prisma.match.findMany({
      where: {
        id: { in: mutualMatchIds },
      },
    });
  }

  /**
   * Disconnect Prisma client (cleanup)
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
