/**
 * POST /api/chat/message
 * 
 * Send message to AI for trait extraction
 * 
 * Performance Target: <1500ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { GrokService } from '@/lib/services/GrokService';
import { TraitRepository } from '@/lib/repositories/TraitRepository';
import { EmbeddingService } from '@/lib/services/EmbeddingService';
import { QdrantService } from '@/lib/services/QdrantService';
import { CacheRepository } from '@/lib/repositories/CacheRepository';
import { authenticate, validateRequiredFields, handleApiError } from '@/lib/utils/middleware';
import {
  successResponse,
  HttpStatus,
} from '@/lib/utils/api-response';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = authenticate(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();

    // Validate required fields
    const validation = validateRequiredFields(body, ['message']);
    if (validation) {
      return validation;
    }

    // Extract traits from message
    const grokService = new GrokService();
    const extractionResult = await grokService.extractTraits(
      body.message,
      body.conversationHistory || []
    );

    // Store extracted traits
    if (extractionResult.traits.length > 0) {
      const traitRepo = new TraitRepository();
      
      // Batch upsert traits
      await traitRepo.batchUpsert(
        user.userId,
        extractionResult.traits.map(t => ({
          dimension: t.dimension,
          trait: t.trait,
          value: t.value,
          confidence: t.confidence,
          source: 'conversation' as const,
        }))
      );

      // Regenerate embedding if significant traits added
      if (extractionResult.traits.length >= 3) {
        await regenerateEmbedding(user.userId);
      }
    }

    // Calculate updated Know-You Meter score
    const traitRepo = new TraitRepository();
    const allTraits = await traitRepo.findByUserId(user.userId);
    const knowYouScore = calculateKnowYouMeter(allTraits);

    return NextResponse.json(
      successResponse({
        traits: extractionResult.traits,
        informationGain: extractionResult.informationGain,
        knowYouMeter: knowYouScore,
        processingTime: extractionResult.processingTime,
      }),
      { status: HttpStatus.OK }
    );
  } catch (error: any) {
    return handleApiError(error, 'Chat message error');
  }
}

/**
 * Regenerate user embedding from traits
 */
async function regenerateEmbedding(userId: string): Promise<void> {
  try {
    const traitRepo = new TraitRepository();
    const traits = await traitRepo.findByUserId(userId);

    // Group traits by dimension
    const groupedTraits = {
      values: [] as string[],
      interests: [] as string[],
      communication: [] as string[],
      lifestyle: [] as string[],
      goals: [] as string[],
    };

    for (const trait of traits) {
      if (trait.confidence > 0.5) {
        groupedTraits[trait.dimension as keyof typeof groupedTraits].push(trait.trait);
      }
    }

    // Generate new embedding
    const cacheRepo = new CacheRepository();
    const embeddingService = new EmbeddingService(cacheRepo);
    const embedding = await embeddingService.generateProfileEmbedding(groupedTraits, userId);

    // Store in Qdrant
    const qdrantService = new QdrantService();
    await qdrantService.upsertVector({
      id: userId,
      vector: embedding.embedding,
      payload: {
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to regenerate embedding:', error);
    // Don't throw - embedding regeneration is non-critical
  }
}

/**
 * Calculate Know-You Meter score (0-100)
 * 
 * Based on trait coverage and confidence across 5 dimensions
 */
function calculateKnowYouMeter(traits: any[]): number {
  const dimensions = ['values', 'interests', 'communication', 'lifestyle', 'goals'];
  const dimensionScores: Record<string, number> = {};

  // Calculate score per dimension
  for (const dimension of dimensions) {
    const dimTraits = traits.filter(t => t.dimension === dimension);
    
    if (dimTraits.length === 0) {
      dimensionScores[dimension] = 0;
      continue;
    }

    // Average confidence weighted by trait count (max 10 traits per dimension)
    const avgConfidence = dimTraits.reduce((sum, t) => sum + t.confidence, 0) / dimTraits.length;
    const coverage = Math.min(dimTraits.length / 10, 1); // Cap at 10 traits
    
    dimensionScores[dimension] = avgConfidence * coverage;
  }

  // Overall score is average across dimensions
  const overallScore = Object.values(dimensionScores).reduce((sum, score) => sum + score, 0) / dimensions.length;
  
  return Math.round(overallScore * 100);
}
