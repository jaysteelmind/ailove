/**
 * User Repository Integration Tests
 * Tests database operations with Prisma
 */

import { UserRepository, CreateUserInput, UpdateUserInput } from '../../src/lib/repositories/UserRepository';
import { PrismaClient } from '@prisma/client';

describe('UserRepository Integration Tests', () => {
  let repository: UserRepository;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Use a test database or in-memory SQLite for testing
    prisma = new PrismaClient();
    repository = new UserRepository(prisma);
  });

  afterAll(async () => {
    await repository.disconnect();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.user.deleteMany();
  });

  describe('create()', () => {
    test('should create a new user', async () => {
      const input: CreateUserInput = {
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          city: 'New York',
          country: 'USA',
        },
      };

      const user = await repository.create(input);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(input.email);
      expect(user.firstName).toBe(input.firstName);
      expect(user.lastName).toBe(input.lastName);
      expect(user.gender).toBe(input.gender);
    });

    test('should throw error for duplicate email', async () => {
      const input: CreateUserInput = {
        email: 'duplicate@example.com',
        passwordHash: 'hashed_password',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          city: 'New York',
          country: 'USA',
        },
      };

      await repository.create(input);

      await expect(repository.create(input)).rejects.toThrow('Email already exists');
    });

    test('should store location as JSON', async () => {
      const input: CreateUserInput = {
        email: 'json@example.com',
        passwordHash: 'hashed_password',
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: new Date('1992-05-15'),
        gender: 'female',
        location: {
          latitude: 34.0522,
          longitude: -118.2437,
          city: 'Los Angeles',
          country: 'USA',
        },
      };

      const user = await repository.create(input);
      const retrieved = await repository.findById(user.id);

      expect(retrieved?.location).toEqual(input.location);
    });
  });

  describe('findById()', () => {
    test('should find user by ID', async () => {
      const input: CreateUserInput = {
        email: 'findme@example.com',
        passwordHash: 'hashed_password',
        firstName: 'Find',
        lastName: 'Me',
        dateOfBirth: new Date('1988-08-08'),
        gender: 'male',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          city: 'New York',
          country: 'USA',
        },
      };

      const created = await repository.create(input);
      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe(input.email);
    });

    test('should return null for non-existent ID', async () => {
      const found = await repository.findById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('findByEmail()', () => {
    test('should find user by email', async () => {
      const input: CreateUserInput = {
        email: 'unique@example.com',
        passwordHash: 'hashed_password',
        firstName: 'Unique',
        lastName: 'User',
        dateOfBirth: new Date('1995-03-20'),
        gender: 'female',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          city: 'New York',
          country: 'USA',
        },
      };

      await repository.create(input);
      const found = await repository.findByEmail(input.email);

      expect(found).not.toBeNull();
      expect(found?.email).toBe(input.email);
    });

    test('should return null for non-existent email', async () => {
      const found = await repository.findByEmail('nonexistent@example.com');

      expect(found).toBeNull();
    });
  });

  describe('update()', () => {
    test('should update user data', async () => {
      const input: CreateUserInput = {
        email: 'update@example.com',
        passwordHash: 'hashed_password',
        firstName: 'Old',
        lastName: 'Name',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          city: 'New York',
          country: 'USA',
        },
      };

      const created = await repository.create(input);

      const updateInput: UpdateUserInput = {
        firstName: 'New',
        lastName: 'Name',
      };

      const updated = await repository.update(created.id, updateInput);

      expect(updated.firstName).toBe('New');
      expect(updated.lastName).toBe('Name');
      expect(updated.email).toBe(input.email); // Unchanged
    });

    test('should update location', async () => {
      const input: CreateUserInput = {
        email: 'location@example.com',
        passwordHash: 'hashed_password',
        firstName: 'Location',
        lastName: 'Test',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          city: 'New York',
          country: 'USA',
        },
      };

      const created = await repository.create(input);

      const newLocation = {
        latitude: 34.0522,
        longitude: -118.2437,
        city: 'Los Angeles',
        country: 'USA',
      };

      const updated = await repository.update(created.id, { location: newLocation });

      expect(updated.location).toEqual(newLocation);
    });
  });

  describe('delete()', () => {
    test('should delete user', async () => {
      const input: CreateUserInput = {
        email: 'delete@example.com',
        passwordHash: 'hashed_password',
        firstName: 'Delete',
        lastName: 'Me',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          city: 'New York',
          country: 'USA',
        },
      };

      const created = await repository.create(input);
      await repository.delete(created.id);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('exists()', () => {
    test('should return true for existing user', async () => {
      const input: CreateUserInput = {
        email: 'exists@example.com',
        passwordHash: 'hashed_password',
        firstName: 'Exists',
        lastName: 'User',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          city: 'New York',
          country: 'USA',
        },
      };

      const created = await repository.create(input);
      const exists = await repository.exists(created.id);

      expect(exists).toBe(true);
    });

    test('should return false for non-existent user', async () => {
      const exists = await repository.exists('non-existent-id');

      expect(exists).toBe(false);
    });
  });

  describe('isEmailAvailable()', () => {
    test('should return true for available email', async () => {
      const available = await repository.isEmailAvailable('available@example.com');

      expect(available).toBe(true);
    });

    test('should return false for taken email', async () => {
      const input: CreateUserInput = {
        email: 'taken@example.com',
        passwordHash: 'hashed_password',
        firstName: 'Taken',
        lastName: 'Email',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          city: 'New York',
          country: 'USA',
        },
      };

      await repository.create(input);
      const available = await repository.isEmailAvailable('taken@example.com');

      expect(available).toBe(false);
    });
  });

  describe('findByIds()', () => {
    test('should find multiple users by IDs', async () => {
      const user1 = await repository.create({
        email: 'user1@example.com',
        passwordHash: 'hash1',
        firstName: 'User',
        lastName: 'One',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        location: { latitude: 40.7128, longitude: -74.0060, city: 'NYC', country: 'USA' },
      });

      const user2 = await repository.create({
        email: 'user2@example.com',
        passwordHash: 'hash2',
        firstName: 'User',
        lastName: 'Two',
        dateOfBirth: new Date('1991-02-02'),
        gender: 'female',
        location: { latitude: 34.0522, longitude: -118.2437, city: 'LA', country: 'USA' },
      });

      const users = await repository.findByIds([user1.id, user2.id]);

      expect(users).toHaveLength(2);
      expect(users.map(u => u.id)).toContain(user1.id);
      expect(users.map(u => u.id)).toContain(user2.id);
    });

    test('should handle empty array', async () => {
      const users = await repository.findByIds([]);

      expect(users).toHaveLength(0);
    });
  });

  describe('count()', () => {
    test('should return correct user count', async () => {
      expect(await repository.count()).toBe(0);

      await repository.create({
        email: 'count1@example.com',
        passwordHash: 'hash',
        firstName: 'Count',
        lastName: 'One',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        location: { latitude: 40.7128, longitude: -74.0060, city: 'NYC', country: 'USA' },
      });

      expect(await repository.count()).toBe(1);

      await repository.create({
        email: 'count2@example.com',
        passwordHash: 'hash',
        firstName: 'Count',
        lastName: 'Two',
        dateOfBirth: new Date('1991-02-02'),
        gender: 'female',
        location: { latitude: 34.0522, longitude: -118.2437, city: 'LA', country: 'USA' },
      });

      expect(await repository.count()).toBe(2);
    });
  });

  describe('findPaginated()', () => {
    test('should paginate users correctly', async () => {
      // Create 5 users
      for (let i = 1; i <= 5; i++) {
        await repository.create({
          email: `page${i}@example.com`,
          passwordHash: 'hash',
          firstName: 'Page',
          lastName: `${i}`,
          dateOfBirth: new Date('1990-01-01'),
          gender: 'male',
          location: { latitude: 40.7128, longitude: -74.0060, city: 'NYC', country: 'USA' },
        });
      }

      const page1 = await repository.findPaginated(1, 2);
      const page2 = await repository.findPaginated(2, 2);
      const page3 = await repository.findPaginated(3, 2);

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page3).toHaveLength(1);
    });
  });
});
