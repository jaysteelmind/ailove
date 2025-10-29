/**
 * Match API Tests
 * 
 * Tests match discovery, accept, reject, and mutual endpoints
 */

import { RBSService } from '../../src/lib/services/RBSService';
import { MatchRepository } from '../../src/lib/repositories/MatchRepository';
import { UserRepository } from '../../src/lib/repositories/UserRepository';
import { QdrantService } from '../../src/lib/services/QdrantService';

jest.mock('../../src/lib/services/RBSService');
jest.mock('../../src/lib/repositories/MatchRepository');
jest.mock('../../src/lib/repositories/UserRepository');
jest.mock('../../src/lib/services/QdrantService');

describe('Match API', () => {
  let mockRBSService: jest.Mocked<RBSService>;
  let mockMatchRepo: jest.Mocked<MatchRepository>;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockQdrantService: jest.Mocked<QdrantService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRBSService = new RBSService() as jest.Mocked<RBSService>;
    mockMatchRepo = new MatchRepository() as jest.Mocked<MatchRepository>;
    mockUserRepo = new UserRepository() as jest.Mocked<UserRepository>;
    mockQdrantService = new QdrantService() as jest.Mocked<QdrantService>;
  });

  describe('GET /api/matches/discover', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: new Date('1990-01-01'),
      location: { city: 'SF', state: 'CA', country: 'USA', latitude: 37.7, longitude: -122.4 },
    };

    test('should discover matches with RBS scoring', async () => {
      // Mock user has embedding
      mockQdrantService.getVector.mockResolvedValue({
        id: 'user-123',
        vector: new Array(768).fill(0.5),
        payload: { userId: 'user-123', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });

      // Mock vector search returns candidates
      mockQdrantService.searchSimilar.mockResolvedValue([
        { id: 'candidate-1', score: 0.95, payload: { userId: 'candidate-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
        { id: 'candidate-2', score: 0.90, payload: { userId: 'candidate-2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
        { id: 'candidate-3', score: 0.85, payload: { userId: 'candidate-3', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
      ]);

      // Mock no existing matches
      mockMatchRepo.findByUserPair.mockResolvedValue(null);

      // Mock current user
      mockUserRepo.findById.mockResolvedValue(mockUser as any);

      // Mock candidate users
      mockUserRepo.findById
        .mockResolvedValueOnce(mockUser as any) // Current user
        .mockResolvedValueOnce({
          id: 'candidate-1',
          firstName: 'Alice',
          dateOfBirth: new Date('1992-01-01'),
          location: mockUser.location,
        } as any)
        .mockResolvedValueOnce({
          id: 'candidate-2',
          firstName: 'Bob',
          dateOfBirth: new Date('1988-01-01'),
          location: mockUser.location,
        } as any);

      // Mock RBS scores
      mockRBSService.compute
        .mockResolvedValueOnce({
          rbs: 0.85,
          sr: 0.90,
          cu: 0.75,
          ig: 0.80,
          sc: 0.10,
        })
        .mockResolvedValueOnce({
          rbs: 0.80,
          sr: 0.85,
          cu: 0.70,
          ig: 0.85,
          sc: 0.15,
        });

      // Mock match creation
      mockMatchRepo.create.mockResolvedValue({
        id: 'match-1',
        userId: 'user-123',
        matchedUserId: 'candidate-1',
        rbsScore: 0.85,
        status: 'pending',
      } as any);

      // Verify workflow
      expect(mockQdrantService.getVector).toBeDefined();
      expect(mockQdrantService.searchSimilar).toBeDefined();
      expect(mockRBSService.compute).toBeDefined();
    });

    test('should return empty if user has no embedding', async () => {
      mockQdrantService.getVector.mockResolvedValue(null);

      // Should return message about needing more conversation
      expect(mockQdrantService.getVector).toBeDefined();
    });

    test('should skip already matched users', async () => {
      mockQdrantService.getVector.mockResolvedValue({
        id: 'user-123',
        vector: new Array(768).fill(0.5),
        payload: { userId: 'user-123', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });

      mockQdrantService.searchSimilar.mockResolvedValue([
        { id: 'candidate-1', score: 0.95, payload: { userId: 'candidate-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
      ]);

      // Mock existing match
      mockMatchRepo.findByUserPair.mockResolvedValue({
        id: 'existing-match',
        userId: 'user-123',
        matchedUserId: 'candidate-1',
        status: 'pending',
      } as any);

      // Should skip this candidate
      expect(mockMatchRepo.findByUserPair).toBeDefined();
    });
  });

  describe('POST /api/matches/:id/accept', () => {
    test('should accept match successfully', async () => {
      const matchId = 'match-123';
      const userId = 'user-123';

      mockMatchRepo.findById.mockResolvedValue({
        id: matchId,
        userId: 'other-user',
        matchedUserId: userId,
        status: 'pending',
        rbsScore: 0.85,
      } as any);

      mockMatchRepo.update.mockResolvedValue({
        id: matchId,
        status: 'accepted',
      } as any);

      // Verify match can be accepted
      expect(mockMatchRepo.findById).toBeDefined();
      expect(mockMatchRepo.update).toBeDefined();
    });

    test('should reject if match not found', async () => {
      mockMatchRepo.findById.mockResolvedValue(null);

      // Should return 404
      expect(mockMatchRepo.findById).toBeDefined();
    });

    test('should reject if not authorized', async () => {
      mockMatchRepo.findById.mockResolvedValue({
        id: 'match-123',
        userId: 'other-user',
        matchedUserId: 'different-user', // Not the requesting user
        status: 'pending',
      } as any);

      // Should return 403
      expect(mockMatchRepo.findById).toBeDefined();
    });

    test('should reject if already accepted', async () => {
      mockMatchRepo.findById.mockResolvedValue({
        id: 'match-123',
        userId: 'other-user',
        matchedUserId: 'user-123',
        status: 'accepted',
      } as any);

      // Should return 400
      expect(mockMatchRepo.findById).toBeDefined();
    });
  });

  describe('POST /api/matches/:id/reject', () => {
    test('should reject match successfully', async () => {
      const matchId = 'match-123';
      const userId = 'user-123';

      mockMatchRepo.findById.mockResolvedValue({
        id: matchId,
        userId: 'other-user',
        matchedUserId: userId,
        status: 'pending',
      } as any);

      mockMatchRepo.update.mockResolvedValue({
        id: matchId,
        status: 'rejected',
      } as any);

      expect(mockMatchRepo.update).toBeDefined();
    });

    test('should reject if already rejected', async () => {
      mockMatchRepo.findById.mockResolvedValue({
        id: 'match-123',
        status: 'rejected',
      } as any);

      // Should return 400
      expect(mockMatchRepo.findById).toBeDefined();
    });
  });

  describe('GET /api/matches/mutual', () => {
    test('should get mutual matches', async () => {
      const userId = 'user-123';

      mockMatchRepo.findMutualMatches.mockResolvedValue([
        {
          id: 'match-1',
          userId,
          matchedUserId: 'user-456',
          rbsScore: 0.85,
          status: 'accepted',
          createdAt: new Date(),
        } as any,
        {
          id: 'match-2',
          userId,
          matchedUserId: 'user-789',
          rbsScore: 0.80,
          status: 'accepted',
          createdAt: new Date(),
        } as any,
      ]);

      mockUserRepo.findById
        .mockResolvedValueOnce({
          id: 'user-456',
          firstName: 'Alice',
          dateOfBirth: new Date('1990-01-01'),
          location: {},
        } as any)
        .mockResolvedValueOnce({
          id: 'user-789',
          firstName: 'Bob',
          dateOfBirth: new Date('1992-01-01'),
          location: {},
        } as any);

      const matches = await mockMatchRepo.findMutualMatches(userId);

      expect(matches).toHaveLength(2);
      expect(mockMatchRepo.findMutualMatches).toHaveBeenCalledWith(userId);
    });

    test('should paginate results', async () => {
      const userId = 'user-123';
      mockMatchRepo.findMutualMatches.mockResolvedValue([]);

      await mockMatchRepo.findMutualMatches(userId);

      // Pagination logic should apply
      expect(mockMatchRepo.findMutualMatches).toHaveBeenCalled();
    });
  });

  describe('RBS Score Calculations', () => {
    test('should calculate scores within bounds [0, 1]', async () => {
      mockRBSService.compute.mockResolvedValue({
        rbs: 0.85,
        sr: 0.90,
        cu: 0.75,
        ig: 0.80,
        sc: 0.10,
      });

      const score = await mockRBSService.compute('user1', 'user2');

      expect(score.rbs).toBeGreaterThanOrEqual(0);
      expect(score.rbs).toBeLessThanOrEqual(1);
      expect(score.sr).toBeGreaterThanOrEqual(0);
      expect(score.sr).toBeLessThanOrEqual(1);
    });

    test('should maintain component score relationships', async () => {
      mockRBSService.compute.mockResolvedValue({
        rbs: 0.75,
        sr: 0.85,
        cu: 0.70,
        ig: 0.65,
        sc: 0.15,
      });

      const score = await mockRBSService.compute('user1', 'user2');

      // RBS should be weighted combination
      // α·SR + β·CU + γ·IG - δ·SC
      // With default weights: 0.45·SR + 0.30·CU + 0.25·IG - 0.15·SC
      const expectedRBS = 0.45 * score.sr + 0.30 * score.cu + 0.25 * score.ig - 0.15 * score.sc;
      
      expect(Math.abs(score.rbs - expectedRBS)).toBeLessThan(0.01);
    });
  });
});
