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

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { dateId, reason } = body;

    if (!dateId) {
      return NextResponse.json(
        { success: false, error: 'dateId is required' },
        { status: 400 }
      );
    }

    const date = await dateService.cancelDate(dateId, decoded.userId, reason);

    return NextResponse.json({
      success: true,
      data: { date }
    });
  } catch (error: any) {
    console.error('Cancel date error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel date' },
      { status: 500 }
    );
  }
}
