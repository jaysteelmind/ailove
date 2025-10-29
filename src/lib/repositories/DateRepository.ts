/**
 * Date Repository
 * Data access layer for Date model (Scheduling & Feedback)
 * 
 * Handles:
 * - Date scheduling and management
 * - Feedback collection (rating & text)
 * - Status tracking (scheduled, completed, cancelled, no_show)
 * - Date history queries
 * 
 * Performance: <100ms p95 for all operations
 * Complexity: O(1) for single operations, O(n) for batch
 */

import { PrismaClient, Date as DateModel, Prisma } from '@prisma/client';

export interface CreateDateInput {
  userId: string;
  partnerId: string;
  scheduledAt: Date;
  location: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
}

export interface UpdateDateInput {
  status?: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  scheduledAt?: Date;
  location?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
}

export interface SubmitFeedbackInput {
  feedbackRating: number; // 1-5 stars
  feedbackText?: string;
}

export class DateRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Schedule a new date
   * 
   * @param input - Date creation data
   * @returns Created date
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async create(input: CreateDateInput): Promise<DateModel> {
    return this.prisma.date.create({
      data: {
        userId: input.userId,
        partnerId: input.partnerId,
        scheduledAt: input.scheduledAt,
        location: input.location as Prisma.InputJsonValue,
        status: 'scheduled',
      },
    });
  }

  /**
   * Find date by ID
   * 
   * @param dateId - Date ID
   * @returns Date or null
   * 
   * Time Complexity: O(1)
   * Target Latency: <50ms
   */
  async findById(dateId: string): Promise<DateModel | null> {
    return this.prisma.date.findUnique({
      where: { id: dateId },
    });
  }

  /**
   * Find all dates for a user
   * 
   * @param userId - User ID
   * @returns Array of dates
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findByUserId(userId: string): Promise<DateModel[]> {
    return this.prisma.date.findMany({
      where: { userId },
      orderBy: {
        scheduledAt: 'desc',
      },
    });
  }

  /**
   * Find dates by status for a user
   * 
   * @param userId - User ID
   * @param status - Date status
   * @returns Array of dates
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findByStatus(
    userId: string,
    status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  ): Promise<DateModel[]> {
    return this.prisma.date.findMany({
      where: {
        userId,
        status,
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });
  }

  /**
   * Find upcoming dates for a user
   * 
   * @param userId - User ID
   * @returns Array of upcoming dates
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findUpcoming(userId: string): Promise<DateModel[]> {
    return this.prisma.date.findMany({
      where: {
        userId,
        status: 'scheduled',
        scheduledAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });
  }

  /**
   * Find past dates for a user
   * 
   * @param userId - User ID
   * @returns Array of past dates
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findPast(userId: string): Promise<DateModel[]> {
    return this.prisma.date.findMany({
      where: {
        userId,
        scheduledAt: {
          lt: new Date(),
        },
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });
  }

  /**
   * Find dates between two users
   * 
   * @param userId - First user ID
   * @param partnerId - Second user ID
   * @returns Array of dates
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findBetweenUsers(userId: string, partnerId: string): Promise<DateModel[]> {
    return this.prisma.date.findMany({
      where: {
        OR: [
          { userId, partnerId },
          { userId: partnerId, partnerId: userId },
        ],
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });
  }

  /**
   * Update date details
   * 
   * @param dateId - Date ID
   * @param input - Update data
   * @returns Updated date
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async update(dateId: string, input: UpdateDateInput): Promise<DateModel> {
    const updateData: Prisma.DateUpdateInput = {};

    if (input.status) {
      updateData.status = input.status;
    }

    if (input.scheduledAt) {
      updateData.scheduledAt = input.scheduledAt;
    }

    if (input.location) {
      updateData.location = input.location as Prisma.InputJsonValue;
    }

    return this.prisma.date.update({
      where: { id: dateId },
      data: updateData,
    });
  }

  /**
   * Submit feedback for a completed date
   * 
   * @param dateId - Date ID
   * @param input - Feedback data
   * @returns Updated date
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async submitFeedback(dateId: string, input: SubmitFeedbackInput): Promise<DateModel> {
    return this.prisma.date.update({
      where: { id: dateId },
      data: {
        feedbackRating: input.feedbackRating,
        feedbackText: input.feedbackText,
        status: 'completed',
      },
    });
  }

  /**
   * Mark date as completed
   * 
   * @param dateId - Date ID
   * @returns Updated date
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async markAsCompleted(dateId: string): Promise<DateModel> {
    return this.update(dateId, { status: 'completed' });
  }

  /**
   * Cancel a date
   * 
   * @param dateId - Date ID
   * @returns Updated date
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async cancel(dateId: string): Promise<DateModel> {
    return this.update(dateId, { status: 'cancelled' });
  }

  /**
   * Mark as no-show
   * 
   * @param dateId - Date ID
   * @returns Updated date
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async markAsNoShow(dateId: string): Promise<DateModel> {
    return this.update(dateId, { status: 'no_show' });
  }

  /**
   * Delete a date
   * 
   * @param dateId - Date ID
   * @returns Deleted date
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async delete(dateId: string): Promise<DateModel> {
    return this.prisma.date.delete({
      where: { id: dateId },
    });
  }

  /**
   * Count dates by status for a user
   * 
   * @param userId - User ID
   * @param status - Date status
   * @returns Date count
   * 
   * Time Complexity: O(1)
   * Target Latency: <50ms
   */
  async countByStatus(userId: string, status: string): Promise<number> {
    return this.prisma.date.count({
      where: {
        userId,
        status,
      },
    });
  }

  /**
   * Get date statistics for a user
   * 
   * @param userId - User ID
   * @returns Object with date counts by status
   * 
   * Time Complexity: O(1) per status
   * Target Latency: <100ms
   */
  async getDateStats(userId: string): Promise<{
    scheduled: number;
    completed: number;
    cancelled: number;
    no_show: number;
    total: number;
  }> {
    const [scheduled, completed, cancelled, no_show, total] = await Promise.all([
      this.countByStatus(userId, 'scheduled'),
      this.countByStatus(userId, 'completed'),
      this.countByStatus(userId, 'cancelled'),
      this.countByStatus(userId, 'no_show'),
      this.prisma.date.count({ where: { userId } }),
    ]);

    return { scheduled, completed, cancelled, no_show, total };
  }

  /**
   * Get average feedback rating for a user
   * 
   * @param userId - User ID
   * @returns Average rating [1, 5]
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async getAverageFeedbackRating(userId: string): Promise<number> {
    const result = await this.prisma.date.aggregate({
      where: {
        userId,
        feedbackRating: {
          not: null,
        },
      },
      _avg: {
        feedbackRating: true,
      },
    });

    return result._avg.feedbackRating || 0;
  }

  /**
   * Find dates with high ratings (4+ stars)
   * 
   * @param userId - User ID
   * @returns Array of successful dates
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findSuccessfulDates(userId: string): Promise<DateModel[]> {
    return this.prisma.date.findMany({
      where: {
        userId,
        feedbackRating: {
          gte: 4,
        },
      },
      orderBy: {
        feedbackRating: 'desc',
      },
    });
  }

  /**
   * Check if user has pending feedback
   * 
   * @param userId - User ID
   * @returns True if has completed dates without feedback
   * 
   * Time Complexity: O(1)
   * Target Latency: <50ms
   */
  async hasPendingFeedback(userId: string): Promise<boolean> {
    const count = await this.prisma.date.count({
      where: {
        userId,
        status: 'completed',
        feedbackRating: null,
      },
    });

    return count > 0;
  }

  /**
   * Find dates without feedback
   * 
   * @param userId - User ID
   * @returns Array of dates needing feedback
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findDatesNeedingFeedback(userId: string): Promise<DateModel[]> {
    return this.prisma.date.findMany({
      where: {
        userId,
        status: 'completed',
        feedbackRating: null,
      },
      orderBy: {
        scheduledAt: 'desc',
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
