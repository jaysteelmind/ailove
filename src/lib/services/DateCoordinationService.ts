import { DateRepository } from '../repositories/DateRepository';
import { MatchRepository } from '../repositories/MatchRepository';
import { UserRepository } from '../repositories/UserRepository';
import { Date as DateModel } from '@prisma/client';

export interface ProposeDateInput {
  matchId: string;
  proposedBy: string;
  scheduledAt: Date;
  proposedLocations: LocationOption[];
  activityType?: string;
}

export interface LocationOption {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}

export interface DateFeedbackInput {
  dateId: string;
  userId: string;
  rating: number; // 1-5
  feedbackText?: string;
}

export class DateCoordinationService {
  constructor(
    private dateRepo: DateRepository,
    private matchRepo: MatchRepository,
    private userRepo: UserRepository
  ) {}

  /**
   * Propose a date with location options
   */
  async proposeDate(input: ProposeDateInput): Promise<DateModel> {
    // 1. Verify match exists and is mutual
    const match = await this.matchRepo.findById(input.matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status !== 'accepted') {
      throw new Error('Can only schedule dates with accepted matches');
    }

    // 2. Verify proposer is part of the match
    if (match.userId !== input.proposedBy && match.matchedUserId !== input.proposedBy) {
      throw new Error('Unauthorized to propose date for this match');
    }

    // 3. Determine partner
    const partnerId = match.userId === input.proposedBy 
      ? match.matchedUserId 
      : match.userId;

    // 4. Select primary location (first option or calculate best)
    const primaryLocation = input.proposedLocations[0] || {
      name: 'Location TBD',
      address: 'To be determined',
      latitude: 0,
      longitude: 0
    };

    // 5. Create date proposal
    const date = await this.dateRepo.create({
      matchId: input.matchId,
      userId: input.proposedBy,
      partnerId: partnerId,
      proposedBy: input.proposedBy,
      scheduledAt: input.scheduledAt,
      location: primaryLocation,
      proposedLocations: input.proposedLocations,
      activityType: input.activityType || 'general',
      status: 'proposed'
    });

    return date;
  }

  /**
   * Confirm a proposed date
   */
  async confirmDate(
    dateId: string,
    userId: string,
    selectedLocation?: LocationOption
  ): Promise<DateModel> {
    const date = await this.dateRepo.findById(dateId);
    if (!date) {
      throw new Error('Date not found');
    }

    // Verify user is the partner (not the proposer)
    if (date.partnerId !== userId) {
      throw new Error('Only the invited partner can confirm the date');
    }

    if (date.status !== 'proposed') {
      throw new Error('Date is not in proposed status');
    }

    // Update location if partner selects different option
    const finalLocation = selectedLocation || date.location;

    return this.dateRepo.update(dateId, {
      status: 'confirmed',
      confirmedAt: new Date(),
      location: finalLocation
    });
  }

  /**
   * Cancel a date
   */
  async cancelDate(
    dateId: string,
    userId: string,
    reason?: string
  ): Promise<DateModel> {
    const date = await this.dateRepo.findById(dateId);
    if (!date) {
      throw new Error('Date not found');
    }

    // Either party can cancel
    if (date.userId !== userId && date.partnerId !== userId) {
      throw new Error('Unauthorized to cancel this date');
    }

    return this.dateRepo.update(dateId, {
      status: 'cancelled'
    });
  }

  /**
   * Mark date as completed
   */
  async completeDate(dateId: string): Promise<DateModel> {
    const date = await this.dateRepo.findById(dateId);
    if (!date) {
      throw new Error('Date not found');
    }

    if (date.status !== 'confirmed') {
      throw new Error('Only confirmed dates can be marked as completed');
    }

    return this.dateRepo.update(dateId, {
      status: 'completed'
    });
  }

  /**
   * Submit feedback after date
   */
  async submitFeedback(input: DateFeedbackInput): Promise<DateModel> {
    const date = await this.dateRepo.findById(input.dateId);
    if (!date) {
      throw new Error('Date not found');
    }

    // Verify user participated in the date
    if (date.userId !== input.userId && date.partnerId !== input.userId) {
      throw new Error('Unauthorized to provide feedback for this date');
    }

    if (date.status !== 'completed') {
      throw new Error('Can only provide feedback for completed dates');
    }

    // Validate rating
    if (input.rating < 1 || input.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    return this.dateRepo.update(input.dateId, {
      feedbackRating: input.rating,
      feedbackText: input.feedbackText
    });
  }

  /**
   * Get dates for a match
   */
  async getDatesByMatch(matchId: string, userId: string): Promise<DateModel[]> {
    // Verify user is part of the match
    const match = await this.matchRepo.findById(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.userId !== userId && match.matchedUserId !== userId) {
      throw new Error('Unauthorized to view dates for this match');
    }

    return this.dateRepo.findByMatchId(matchId);
  }

  /**
   * Get dates for a user
   */
  async getUserDates(
    userId: string,
    status?: string
  ): Promise<DateModel[]> {
    return this.dateRepo.findByUserId(userId, { status });
  }

  /**
   * Suggest midpoint location between two users
   */
  async suggestMidpointLocation(
    matchId: string
  ): Promise<{ latitude: number; longitude: number }> {
    const match = await this.matchRepo.findById(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    const [user1, user2] = await Promise.all([
      this.userRepo.findById(match.userId),
      this.userRepo.findById(match.matchedUserId)
    ]);

    if (!user1 || !user2) {
      throw new Error('User not found');
    }

    // Extract locations from JSON
    const loc1 = user1.location as any;
    const loc2 = user2.location as any;

    // Calculate midpoint
    const midpoint = {
      latitude: (loc1.latitude + loc2.latitude) / 2,
      longitude: (loc1.longitude + loc2.longitude) / 2
    };

    return midpoint;
  }
}
