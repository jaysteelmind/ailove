/**
 * AuthService - User Authentication & Session Management
 * 
 * Handles user registration, login, token refresh, and session management.
 * Integrates with UserRepository and Redis for secure authentication.
 * 
 * Security Features:
 * - bcrypt password hashing (cost factor: 12)
 * - JWT with token rotation
 * - Session tracking in Redis
 * - Rate limiting support
 * 
 * Performance Targets:
 * - Registration: <200ms
 * - Login: <200ms
 * - Token refresh: <50ms
 * - Logout: <50ms
 * 
 * Complexity:
 * - All operations: O(1) with database indexes
 */

import { UserRepository } from '../repositories/UserRepository';
import { CacheRepository } from '../repositories/CacheRepository';
import {
  hashPassword,
  verifyPassword,
  generateTokenPair,
  verifyRefreshToken,
  validatePassword,
  validateEmail,
  type TokenPair,
  type JWTPayload,
} from '../utils/auth';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  location: {
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  tokens: TokenPair;
}

/**
 * AuthService - Authentication Operations
 * 
 * Manages user authentication lifecycle from registration to logout.
 */
export class AuthService {
  private userRepo: UserRepository;
  private cacheRepo: CacheRepository;
  private readonly sessionTTL = 604800; // 7 days in seconds

  constructor(
    userRepo?: UserRepository,
    cacheRepo?: CacheRepository
  ) {
    this.userRepo = userRepo || new UserRepository();
    this.cacheRepo = cacheRepo || new CacheRepository();
  }

  /**
   * Register new user
   * 
   * Validates input, checks for existing email, hashes password,
   * creates user record, and generates authentication tokens.
   * 
   * Complexity: O(1) with email index
   * Target Latency: <200ms
   * 
   * @param input Registration data
   * @returns User data and authentication tokens
   * @throws Error if validation fails or email exists
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    // Validate email format
    if (!validateEmail(input.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    const passwordValidation = validatePassword(input.password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.error || 'Invalid password');
    }

    // Check if email already exists
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Validate age (must be 18+)
    const age = this.calculateAge(input.dateOfBirth);
    if (age < 18) {
      throw new Error('Must be 18 years or older to register');
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user
    const user = await this.userRepo.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      location: input.location,
    });

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
    });

    // Store session in Redis
    await this.storeSession(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tokens,
    };
  }

  /**
   * Login user
   * 
   * Verifies credentials and generates new authentication tokens.
   * 
   * Complexity: O(1) with email index
   * Target Latency: <200ms
   * 
   * @param input Login credentials
   * @returns User data and authentication tokens
   * @throws Error if credentials invalid
   */
  async login(input: LoginInput): Promise<AuthResult> {
    // Find user by email
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Generate new tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
    });

    // Store session
    await this.storeSession(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tokens,
    };
  }

  /**
   * Refresh access token
   * 
   * Validates refresh token and generates new token pair.
   * 
   * Complexity: O(1)
   * Target Latency: <50ms
   * 
   * @param refreshToken Current refresh token
   * @returns New token pair
   * @throws Error if refresh token invalid
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new Error('Invalid refresh token');
    }

    // Check if session exists
    const session = await this.getSession(payload.userId);
    if (!session || session !== refreshToken) {
      throw new Error('Session expired or invalid');
    }

    // Verify user still exists
    const user = await this.userRepo.findById(payload.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new token pair
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
    });

    // Update session with new refresh token
    await this.storeSession(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Logout user
   * 
   * Invalidates refresh token by removing session.
   * 
   * Complexity: O(1)
   * Target Latency: <50ms
   * 
   * @param userId User ID to logout
   */
  async logout(userId: string): Promise<void> {
    await this.deleteSession(userId);
  }

  /**
   * Store session in Redis
   * 
   * @private
   */
  private async storeSession(
    userId: string,
    refreshToken: string
  ): Promise<void> {
    const key = this.getSessionKey(userId);
    await this.cacheRepo.set(key, refreshToken, this.sessionTTL);
  }

  /**
   * Get session from Redis
   * 
   * @private
   */
  private async getSession(userId: string): Promise<string | null> {
    const key = this.getSessionKey(userId);
    const result = await this.cacheRepo.get(key);
    return result as string | null;
  }

  /**
   * Delete session from Redis
   * 
   * @private
   */
  private async deleteSession(userId: string): Promise<void> {
    const key = this.getSessionKey(userId);
    await this.cacheRepo.delete(key);
  }

  /**
   * Generate session cache key
   * 
   * @private
   */
  private getSessionKey(userId: string): string {
    return `session:${userId}`;
  }

  /**
   * Calculate age from date of birth
   * 
   * @private
   */
  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  /**
   * Validate user ID format
   * 
   * @param userId User ID to validate
   * @returns True if valid UUID format
   */
  validateUserId(userId: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(userId);
  }
}

export default AuthService;
