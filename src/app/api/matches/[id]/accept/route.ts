/**
 * POST /api/matches/:id/accept
 * 
 * Accept a match invitation
 * 
 * Performance Target: <100ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { MatchRepository } from '@/lib/repositories/MatchRepository';
import { authenticate, handleApiError } from '@/lib/utils/middleware';
import {
  successResponse,
  errorResponse,
  ErrorCodes,
  HttpStatus,
} from '@/lib/utils/api-response';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authenticate user
    const authResult = authenticate(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const matchId = context.params.id;

    // Get match
    const matchRepo = new MatchRepository();
    const match = await matchRepo.findById(matchId);

    if (!match) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Match not found'),
        { status: HttpStatus.NOT_FOUND }
      );
    }

    // Verify user is part of this match
    if (match.matchedUserId !== user.userId) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.UNAUTHORIZED,
          'Not authorized to accept this match'
        ),
        { status: HttpStatus.FORBIDDEN }
      );
    }

    // Check if already accepted or rejected
    if (match.status === 'accepted') {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.INVALID_INPUT,
          'Match already accepted'
        ),
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    if (match.status === 'rejected') {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.INVALID_INPUT,
          'Match was rejected'
        ),
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    // Update match status
    const updatedMatch = await matchRepo.update(matchId, {
      status: 'accepted',
    });

    return NextResponse.json(
      successResponse({
        match: updatedMatch,
        message: 'Match accepted successfully',
      }),
      { status: HttpStatus.OK }
    );
  } catch (error: any) {
    return handleApiError(error, 'Accept match error');
  }
}
