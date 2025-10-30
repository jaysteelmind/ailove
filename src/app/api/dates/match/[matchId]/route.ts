import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { DateRepository } from '@/lib/repositories/DateRepository';
import { MatchRepository } from '@/lib/repositories/MatchRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { DateCoordinationService } from '@/lib/services/DateCoordinationService';
import { verifyAccessToken } from '@/lib/utils/auth';

const prisma = new PrismaClient();
const dateRepo = new DateRepository(prisma);
const matchRepo = new MatchRepository(prisma);
const userRepo = new UserRepository(prisma);
const dateService = new DateCoordinationService(dateRepo, matchRepo, userRepo);

export async function GET(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { matchId } = params;
    const dates = await dateService.getDatesByMatch(matchId, decoded.userId);

    return NextResponse.json({
      success: true,
      data: { dates }
    });
  } catch (error: any) {
    console.error('Get dates error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get dates' },
      { status: 500 }
    );
  }
}
