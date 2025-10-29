/**
 * Authentication API Tests
 * 
 * Tests all auth endpoints: register, login, refresh, logout
 * Uses mocked repositories to avoid database dependencies
 */

import { UserRepository } from '../../src/lib/repositories/UserRepository';
import { CacheRepository } from '../../src/lib/repositories/CacheRepository';
import { AuthService } from '../../src/lib/services/AuthService';
import * as authUtils from '../../src/lib/utils/auth';

// Mock repositories
jest.mock('../../src/lib/repositories/UserRepository');
jest.mock('../../src/lib/repositories/CacheRepository');

describe('Authentication API', () => {
  let authService: AuthService;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockCacheRepo: jest.Mocked<CacheRepository>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockUserRepo = new UserRepository() as jest.Mocked<UserRepository>;
    mockCacheRepo = new CacheRepository() as jest.Mocked<CacheRepository>;

    authService = new AuthService(mockUserRepo, mockCacheRepo);
  });

  describe('POST /api/auth/register', () => {
    const validRegistration = {
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      location: {
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        latitude: 37.7749,
        longitude: -122.4194,
      },
    };

    test('should register new user successfully', async () => {
      // Mock no existing user
      mockUserRepo.findByEmail.mockResolvedValue(null);

      // Mock user creation
      mockUserRepo.create.mockResolvedValue({
        id: 'user-123',
        email: validRegistration.email,
        firstName: validRegistration.firstName,
        lastName: validRegistration.lastName,
        passwordHash: 'hashed',
        dateOfBirth: validRegistration.dateOfBirth,
        gender: validRegistration.gender,
        location: validRegistration.location,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Mock cache set
      mockCacheRepo.set.mockResolvedValue(undefined);

      const result = await authService.register(validRegistration);

      expect(result.user.email).toBe(validRegistration.email);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(validRegistration.email);
      expect(mockUserRepo.create).toHaveBeenCalled();
    });

    test('should reject invalid email format', async () => {
      const invalidEmail = { ...validRegistration, email: 'invalid-email' };

      await expect(authService.register(invalidEmail)).rejects.toThrow(
        'Invalid email format'
      );
    });

    test('should reject weak password', async () => {
      const weakPassword = { ...validRegistration, password: 'weak' };

      await expect(authService.register(weakPassword)).rejects.toThrow();
    });

    test('should reject existing email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({
        id: 'existing-user',
        email: validRegistration.email,
      } as any);

      await expect(authService.register(validRegistration)).rejects.toThrow(
        'Email already registered'
      );
    });

    test('should reject underage user', async () => {
      const underageUser = {
        ...validRegistration,
        dateOfBirth: new Date('2010-01-01'), // 15 years old
      };

      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(authService.register(underageUser)).rejects.toThrow(
        'Must be 18 years or older'
      );
    });
  });

  describe('POST /api/auth/login', () => {
    const loginCredentials = {
      email: 'test@example.com',
      password: 'Test123!@#',
    };

    test('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: loginCredentials.email,
        firstName: 'Test',
        lastName: 'User',
        passwordHash: await authUtils.hashPassword(loginCredentials.password),
      };

      mockUserRepo.findByEmail.mockResolvedValue(mockUser as any);
      mockCacheRepo.set.mockResolvedValue(undefined);

      const result = await authService.login(loginCredentials);

      expect(result.user.email).toBe(loginCredentials.email);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    test('should reject invalid email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginCredentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    test('should reject invalid password', async () => {
      const mockUser = {
        id: 'user-123',
        email: loginCredentials.email,
        passwordHash: await authUtils.hashPassword('DifferentPassword123!'),
      };

      mockUserRepo.findByEmail.mockResolvedValue(mockUser as any);

      await expect(authService.login(loginCredentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('should refresh tokens successfully', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      // Generate initial tokens
      const tokens = authUtils.generateTokenPair({ userId, email });

      // Mock session exists
      mockCacheRepo.get.mockResolvedValue(tokens.refreshToken);

      // Mock user exists
      mockUserRepo.findById.mockResolvedValue({
        id: userId,
        email,
      } as any);

      // Mock session update
      mockCacheRepo.set.mockResolvedValue(undefined);

      const newTokens = await authService.refresh(tokens.refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(tokens.accessToken);
    });

    test('should reject invalid refresh token', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(authService.refresh(invalidToken)).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    test('should reject expired session', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const tokens = authUtils.generateTokenPair({ userId, email });

      // Mock session doesn't exist
      mockCacheRepo.get.mockResolvedValue(null);

      await expect(authService.refresh(tokens.refreshToken)).rejects.toThrow(
        'Session expired or invalid'
      );
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully', async () => {
      const userId = 'user-123';

      mockCacheRepo.delete.mockResolvedValue(undefined);

      await authService.logout(userId);

      expect(mockCacheRepo.delete).toHaveBeenCalledWith(`session:${userId}`);
    });
  });

  describe('Password Validation', () => {
    test('should accept strong password', () => {
      const result = authUtils.validatePassword('StrongPass123!@#');
      expect(result.valid).toBe(true);
    });

    test('should reject short password', () => {
      const result = authUtils.validatePassword('Short1!');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 8 characters');
    });

    test('should reject password without uppercase', () => {
      const result = authUtils.validatePassword('lowercase123!');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('uppercase');
    });

    test('should reject password without lowercase', () => {
      const result = authUtils.validatePassword('UPPERCASE123!');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    test('should reject password without number', () => {
      const result = authUtils.validatePassword('NoNumbers!@#');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('number');
    });

    test('should reject password without special character', () => {
      const result = authUtils.validatePassword('NoSpecial123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('special character');
    });
  });

  describe('Email Validation', () => {
    test('should accept valid emails', () => {
      expect(authUtils.validateEmail('test@example.com')).toBe(true);
      expect(authUtils.validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    test('should reject invalid emails', () => {
      expect(authUtils.validateEmail('invalid')).toBe(false);
      expect(authUtils.validateEmail('@example.com')).toBe(false);
      expect(authUtils.validateEmail('test@')).toBe(false);
      expect(authUtils.validateEmail('test@domain')).toBe(false);
    });
  });

  describe('JWT Token Operations', () => {
    test('should generate and verify access token', () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const tokens = authUtils.generateTokenPair(payload);

      const verified = authUtils.verifyAccessToken(tokens.accessToken);

      expect(verified).toBeTruthy();
      expect(verified?.userId).toBe(payload.userId);
      expect(verified?.email).toBe(payload.email);
    });

    test('should generate and verify refresh token', () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const tokens = authUtils.generateTokenPair(payload);

      const verified = authUtils.verifyRefreshToken(tokens.refreshToken);

      expect(verified).toBeTruthy();
      expect(verified?.userId).toBe(payload.userId);
    });

    test('should reject invalid token', () => {
      const verified = authUtils.verifyAccessToken('invalid.token');
      expect(verified).toBeNull();
    });

    test('should extract token from Bearer header', () => {
      const token = 'sample.jwt.token';
      const header = `Bearer ${token}`;

      const extracted = authUtils.extractToken(header);
      expect(extracted).toBe(token);
    });

    test('should return null for invalid header format', () => {
      expect(authUtils.extractToken(null)).toBeNull();
      expect(authUtils.extractToken('InvalidFormat')).toBeNull();
      expect(authUtils.extractToken('Basic token123')).toBeNull();
    });
  });
});
