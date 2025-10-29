/**
 * GET /api/matches/discover
 * 
 * Discover potential matches using RBS algorithm
 * 
 * Performance Target: <300ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { RBSService } from '@/lib/services/RBSService';
import { QdrantService } from '@/lib/services/QdrantService';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { MatchRepository } from '@/lib/repositories/MatchRepository';
import { authenticate, validatePagination, handleApiError } from '@/lib/utils/middleware';
import {
  successResponse,
  HttpStatus,
} from '@/lib/utils/api-response';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = authenticate(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Validate pagination
    const { searchParams } = new URL(request.url);
    const paginationResult = validatePagination(searchParams);
    if (paginationResult instanceof NextResponse) {
      return paginationResult;
    }

    const { limit } = paginationResult;

    // Get user's embedding from Qdrant
    const qdrantService = new QdrantService();
    const userVector = await qdrantService.getVector(user.userId);

    if (!userVector) {
      // User doesn't have embedding yet - need more conversation
      return NextResponse.json(
        successResponse({
          matches: [],
          message: 'Complete more conversation to enable matching',
          knowYouMeterRequired: 70,
        }),
        { status: HttpStatus.OK }
      );
    }

    // Find similar users via vector search (top 100 candidates)
    const similarUsers = await qdrantService.searchSimilar(
      userVector.vector,
      100
    );

    if (similarUsers.length === 0) {
      return NextResponse.json(
        successResponse({ matches: [] }),
        { status: HttpStatus.OK }
      );
    }

    // Calculate RBS scores for candidates
    const rbsService = new RBSService();
    const userRepo = new UserRepository();
    const matchRepo = new MatchRepository();

    const currentUser = await userRepo.findById(user.userId);
    if (!currentUser) {
      return NextResponse.json(
        successResponse({ matches: [] }),
        { status: HttpStatus.OK }
      );
    }

    const scoredMatches = [];

    for (const candidate of similarUsers.slice(0, 50)) {
      // Skip already matched users
      const existingMatch = await matchRepo.findByUserPair(
        user.userId,
        candidate.id
      );

      if (existingMatch) {
        continue;
      }

      // Get candidate user data
      const candidateUser = await userRepo.findById(candidate.id);
      if (!candidateUser) {
        continue;
      }

      // Calculate RBS score
      const rbsScore = await rbsService.calculateScore(
        user.userId,
        candidate.id
      );

      // Store match in database
      await matchRepo.create({
        userId: user.userId,
        matchedUserId: candidate.id,
        rbsScore: rbsScore.rbs,
        srScore: rbsScore.sr,
        cuScore: rbsScore.cu,
        igScore: rbsScore.ig,
        scScore: rbsScore.sc,
        status: 'pending',
      });

      scoredMatches.push({
        userId: candidate.id,
        firstName: candidateUser.firstName,
        age: calculateAge(candidateUser.dateOfBirth),
        location: candidateUser.location,
        rbsScore: rbsScore.rbs,
        compatibility: Math.round(rbsScore.rbs * 100),
      });

      // Stop when we have enough matches
      if (scoredMatches.length >= limit) {
        break;
      }
    }

    // Sort by RBS score descending
    scoredMatches.sort((a, b) => b.rbsScore - a.rbsScore);

    return NextResponse.json(
      successResponse({
        matches: scoredMatches,
        count: scoredMatches.length,
      }),
      { status: HttpStatus.OK }
    );
  } catch (error: any) {
    return handleApiError(error, 'Match discovery error');
  }
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: Date): number {
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
