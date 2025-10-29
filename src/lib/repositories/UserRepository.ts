/**
 * User Repository
 * Data access layer for User model with Prisma ORM
 * 
 * Handles:
 * - User CRUD operations
 * - Profile management
 * - Authentication queries
 * - Relationship loading
 * 
 * Performance: <100ms p95 for all operations
 * Complexity: O(1) for single operations, O(n) for batch
 */

import { PrismaClient, User, Prisma } from '@prisma/client';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  location: {
    latitude: number;
    longitude: number;
    city: string;
    country: string;
  };
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  location?: {
    latitude: number;
    longitude: number;
    city: string;
    country: string;
  };
}

export interface UserWithProfile extends User {
  profile?: {
    id: string;
    bio: string | null;
    photos: string[];
    preferences: any;
    knowYouMeterScore: number;
    conversationCount: number;
  } | null;
}

export class UserRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Create a new user
   * 
   * @param input - User creation data
   * @returns Created user
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async create(input: CreateUserInput): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          location: input.location as Prisma.InputJsonValue,
        },
      });

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('Email already exists');
        }
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   * 
   * @param userId - User ID
   * @returns User or null if not found
   * 
   * Time Complexity: O(1)
   * Target Latency: <50ms
   */
  async findById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Find user by email
   * 
   * @param email - User email
   * @returns User or null if not found
   * 
   * Time Complexity: O(1) with index
   * Target Latency: <50ms
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find user with profile included
   * 
   * @param userId - User ID
   * @returns User with profile or null
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async findByIdWithProfile(userId: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });
  }

  /**
   * Update user data
   * 
   * @param userId - User ID
   * @param input - Update data
   * @returns Updated user
   * 
   * Time Complexity: O(1)
   * Target Latency: <100ms
   */
  async update(userId: string, input: UpdateUserInput): Promise<User> {
    const updateData: Prisma.UserUpdateInput = {};

    if (input.firstName) {
      updateData.firstName = input.firstName;
    }

    if (input.lastName) {
      updateData.lastName = input.lastName;
    }

    if (input.location) {
      updateData.location = input.location as Prisma.InputJsonValue;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  /**
   * Delete user (cascade deletes profile, traits, etc.)
   * 
   * @param userId - User ID
   * @returns Deleted user
   * 
   * Time Complexity: O(n) where n = related records
   * Target Latency: <200ms
   */
  async delete(userId: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Check if user exists by ID
   * 
   * @param userId - User ID
   * @returns True if exists
   * 
   * Time Complexity: O(1)
   * Target Latency: <50ms
   */
  async exists(userId: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id: userId },
    });
    return count > 0;
  }

  /**
   * Check if email is available
   * 
   * @param email - Email to check
   * @returns True if available (not taken)
   * 
   * Time Complexity: O(1) with index
   * Target Latency: <50ms
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { email },
    });
    return count === 0;
  }

  /**
   * Find users by IDs (batch operation)
   * 
   * @param userIds - Array of user IDs
   * @returns Array of users
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findByIds(userIds: string[]): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
    });
  }

  /**
   * Get user count
   * 
   * @returns Total number of users
   * 
   * Time Complexity: O(1) - PostgreSQL count optimization
   * Target Latency: <50ms
   */
  async count(): Promise<number> {
    return this.prisma.user.count();
  }

  /**
   * Find users with pagination
   * 
   * @param page - Page number (1-indexed)
   * @param pageSize - Results per page
   * @returns Array of users
   * 
   * Time Complexity: O(n)
   * Target Latency: <100ms
   */
  async findPaginated(page: number, pageSize: number): Promise<User[]> {
    const skip = (page - 1) * pageSize;

    return this.prisma.user.findMany({
      skip,
      take: pageSize,
      orderBy: {
        createdAt: 'desc',
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
