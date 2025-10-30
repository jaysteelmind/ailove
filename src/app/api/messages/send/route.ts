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
    const userId = decoded.userId;

    const body = await request.json();
    const { matchId, content, contentType } = body;

    if (!matchId || !content) {
      return NextResponse.json(
        { success: false, error: 'matchId and content are required' },
        { status: 400 }
      );
    }

    const message = await messagingService.sendMessage({
      matchId,
      senderId: userId,
      content,
      contentType
    });

    return NextResponse.json({
      success: true,
      data: { message }
    });
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
