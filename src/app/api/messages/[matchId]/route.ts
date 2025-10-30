import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { MessageRepository } from '@/lib/repositories/MessageRepository';
import { MatchRepository } from '@/lib/repositories/MatchRepository';
import { MessagingService } from '@/lib/services/MessagingService';
import { verifyAccessToken } from '@/lib/utils/auth';

const prisma = new PrismaClient();
const messageRepo = new MessageRepository(prisma);
const matchRepo = new MatchRepository(prisma);
const messagingService = new MessagingService(messageRepo, matchRepo);

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
    const userId = decoded.userId;

    const { matchId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before') || undefined;

    const messages = await messagingService.getConversationHistory(
      matchId,
      userId,
      { limit, before }
    );

    return NextResponse.json({
      success: true,
      data: {
        messages,
        hasMore: messages.length === limit
      }
    });
  } catch (error: any) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get messages' },
      { status: 500 }
    );
  }
}
