/**
 * GET /api/chat/history
 * 
 * Get user's conversation history with AI
 * 
 * Performance Target: <100ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { TraitRepository } from '@/lib/repositories/TraitRepository';
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

    // Get user's traits (ordered by extraction time)
    const traitRepo = new TraitRepository();
    const allTraits = await traitRepo.findByUserId(user.userId);

    // Sort by extraction time (most recent first)
    const sortedTraits = allTraits.sort(
      (a, b) => new Date(b.extractedAt).getTime() - new Date(a.extractedAt).getTime()
    );

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTraits = sortedTraits.slice(startIndex, endIndex);

    // Group by extraction session (traits extracted within 1 minute of each other)
    const sessions = groupIntoSessions(paginatedTraits);

    // Calculate overall statistics
    const stats = calculateTraitStats(allTraits);

    return NextResponse.json(
      successResponse({
        sessions,
        stats,
        pagination: {
          page,
          limit,
          total: allTraits.length,
          totalPages: Math.ceil(allTraits.length / limit),
        },
      }),
      { status: HttpStatus.OK }
    );
  } catch (error: any) {
    return handleApiError(error, 'Get chat history error');
  }
}

/**
 * Group traits into conversation sessions
 */
function groupIntoSessions(traits: any[]): any[] {
  const sessions: any[] = [];
  let currentSession: any = null;

  for (const trait of traits) {
    const extractedAt = new Date(trait.extractedAt);

    if (
      !currentSession ||
      extractedAt.getTime() - new Date(currentSession.timestamp).getTime() > 60000
    ) {
      // Start new session
      currentSession = {
        timestamp: trait.extractedAt,
        traits: [],
      };
      sessions.push(currentSession);
    }

    currentSession.traits.push({
      dimension: trait.dimension,
      trait: trait.trait,
      value: trait.value,
      confidence: trait.confidence,
    });
  }

  return sessions;
}

/**
 * Calculate trait statistics
 */
function calculateTraitStats(traits: any[]): any {
  const dimensions = ['values', 'interests', 'communication', 'lifestyle', 'goals'];
  const dimensionCounts: Record<string, number> = {};
  const dimensionAvgConfidence: Record<string, number> = {};

  for (const dimension of dimensions) {
    const dimTraits = traits.filter(t => t.dimension === dimension);
    dimensionCounts[dimension] = dimTraits.length;
    
    if (dimTraits.length > 0) {
      dimensionAvgConfidence[dimension] =
        dimTraits.reduce((sum, t) => sum + t.confidence, 0) / dimTraits.length;
    } else {
      dimensionAvgConfidence[dimension] = 0;
    }
  }

  // Calculate Know-You Meter
  const knowYouScore = dimensions.reduce((sum, dim) => {
    const coverage = Math.min(dimensionCounts[dim] / 10, 1);
    return sum + dimensionAvgConfidence[dim] * coverage;
  }, 0) / dimensions.length;

  return {
    totalTraits: traits.length,
    dimensionCounts,
    dimensionAvgConfidence,
    knowYouMeter: Math.round(knowYouScore * 100),
    conversationSource: traits.filter(t => t.source === 'conversation').length,
    explicitSource: traits.filter(t => t.source === 'explicit').length,
  };
}
