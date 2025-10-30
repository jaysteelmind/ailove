import { PrismaClient, Date as DateModel, Prisma } from '@prisma/client';

export interface CreateDateInput {
  matchId: string;
  userId: string;
  partnerId: string;
  proposedBy: string;
  scheduledAt: Date;
  location: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    placeId?: string;
  };
  proposedLocations?: any[];
  activityType?: string;
  status?: string;
}

export interface UpdateDateInput {
  status?: string;
  confirmedAt?: Date;
  location?: any;
  feedbackRating?: number;
  feedbackText?: string;
}

export class DateRepository {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreateDateInput): Promise<DateModel> {
    return this.prisma.date.create({
      data: {
        matchId: input.matchId,
        userId: input.userId,
        partnerId: input.partnerId,
        proposedBy: input.proposedBy,
        scheduledAt: input.scheduledAt,
        location: input.location as Prisma.InputJsonValue,
        proposedLocations: input.proposedLocations as Prisma.InputJsonValue,
        activityType: input.activityType,
        status: input.status || 'proposed',
      },
    });
  }

  async findById(dateId: string): Promise<DateModel | null> {
    return this.prisma.date.findUnique({
      where: { id: dateId },
    });
  }

  async findByUserId(
    userId: string,
    options?: { status?: string }
  ): Promise<DateModel[]> {
    const where: Prisma.DateWhereInput = {
      OR: [
        { userId },
        { partnerId: userId }
      ]
    };

    if (options?.status) {
      where.status = options.status;
    }

    return this.prisma.date.findMany({
      where,
      orderBy: { scheduledAt: 'desc' }
    });
  }

  async findByMatchId(matchId: string): Promise<DateModel[]> {
    return this.prisma.date.findMany({
      where: { matchId },
      orderBy: { scheduledAt: 'desc' }
    });
  }

  async update(dateId: string, data: UpdateDateInput): Promise<DateModel> {
    return this.prisma.date.update({
      where: { id: dateId },
      data: {
        status: data.status,
        confirmedAt: data.confirmedAt,
        location: data.location ? (data.location as Prisma.InputJsonValue) : undefined,
        feedbackRating: data.feedbackRating,
        feedbackText: data.feedbackText,
      },
    });
  }

  async delete(dateId: string): Promise<void> {
    await this.prisma.date.delete({
      where: { id: dateId },
    });
  }
}
