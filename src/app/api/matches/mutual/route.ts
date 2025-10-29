/**
 * GET /api/matches/mutual
 * 
 * Get list of mutual matches (both users accepted)
 * 
 * Performance Target: <100ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { MatchRepository } from '@/lib/repositories/MatchRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
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

    const { page, limit } = paginationResult;

    // Get mutual matches
    const matchRepo = new MatchRepository();
    const userRepo = new UserRepository();

    const matches = await matchRepo.findMutualMatches(user.userId);

    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedMatches = matches.slice(startIndex, endIndex);

    // Enrich with user data
    const enrichedMatches = await Promise.all(
      paginatedMatches.map(async (match) => {
        const matchedUser = await userRepo.findById(match.matchedUserId);
        
        if (!matchedUser) {
          return null;
        }

        return {
          matchId: match.id,
          user: {
            id: matchedUser.id,
            firstName: matchedUser.firstName,
            age: calculateAge(matchedUser.dateOfBirth),
            location: matchedUser.location,
          },
          rbsScore: match.rbsScore,
          compatibility: Math.round(match.rbsScore * 100),
          matchedAt: match.createdAt,
        };
      })
    );

    // Filter out null results
    const validMatches = enrichedMatches.filter(m => m !== null);

    return NextResponse.json(
      successResponse({
        matches: validMatches,
        pagination: {
          page,
          limit,
          total: matches.length,
          totalPages: Math.ceil(matches.length / limit),
        },
      }),
      { status: HttpStatus.OK }
    );
  } catch (error: any) {
    return handleApiError(error, 'Get mutual matches error');
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
