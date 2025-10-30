import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AICoachingService } from '@/lib/services/AICoachingService';
import { GrokService } from '@/lib/services/GrokService';
import { MessageRepository } from '@/lib/repositories/MessageRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { DateRepository } from '@/lib/repositories/DateRepository';
import { verifyAccessToken } from '@/lib/utils/auth';

const prisma = new PrismaClient();
const grokService = new GrokService();
const messageRepo = new MessageRepository(prisma);
const userRepo = new UserRepository(prisma);
const dateRepo = new DateRepository(prisma);
const coachingService = new AICoachingService(grokService, messageRepo, userRepo, dateRepo);

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
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json(
        { success: false, error: 'matchId is required' },
        { status: 400 }
      );
    }

    const analysis = await coachingService.analyzeConversation(
      matchId,
      decoded.userId
    );

    return NextResponse.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    console.error('Analyze conversation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to analyze conversation' },
      { status: 500 }
    );
  }
}
