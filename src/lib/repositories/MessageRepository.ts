import { PrismaClient, Message, Prisma } from '@prisma/client';

export class MessageRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    matchId: string;
    senderId: string;
    receiverId: string;
    content: string;
    contentType?: string;
  }): Promise<Message> {
    return this.prisma.message.create({
      data: {
        matchId: data.matchId,
        senderId: data.senderId,
        receiverId: data.receiverId,
        content: data.content,
        contentType: data.contentType || 'text',
        status: 'sent'
      }
    });
  }

  async findById(id: string): Promise<Message | null> {
    return this.prisma.message.findUnique({
      where: { id }
    });
  }

  async findByMatchId(
    matchId: string,
    options?: {
      limit?: number;
      before?: string; // message ID for pagination
    }
  ): Promise<Message[]> {
    const where: Prisma.MessageWhereInput = { matchId };
    
    if (options?.before) {
      where.id = { lt: options.before };
    }

    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50
    });
  }

  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      unreadOnly?: boolean;
    }
  ): Promise<Message[]> {
    const where: Prisma.MessageWhereInput = {
      OR: [
        { senderId: userId },
        { receiverId: userId }
      ]
    };

    if (options?.unreadOnly) {
      where.receiverId = userId;
      where.status = { not: 'read' };
    }

    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50
    });
  }

  async markAsDelivered(messageId: string): Promise<Message> {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { status: 'delivered' }
    });
  }

  async markAsRead(messageId: string): Promise<Message> {
    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'read',
        readAt: new Date()
      }
    });
  }

  async markMultipleAsRead(messageIds: string[]): Promise<number> {
    const result = await this.prisma.message.updateMany({
      where: { id: { in: messageIds } },
      data: {
        status: 'read',
        readAt: new Date()
      }
    });
    return result.count;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.message.count({
      where: {
        receiverId: userId,
        status: { not: 'read' }
      }
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.message.delete({
      where: { id }
    });
  }

  async getMessageStats(matchId: string): Promise<{
    totalMessages: number;
    unreadCount: number;
    lastMessageAt: Date | null;
  }> {
    const [totalMessages, messages] = await Promise.all([
      this.prisma.message.count({ where: { matchId } }),
      this.prisma.message.findMany({
        where: { matchId },
        orderBy: { createdAt: 'desc' },
        take: 1
      })
    ]);

    const unreadCount = await this.prisma.message.count({
      where: {
        matchId,
        status: { not: 'read' }
      }
    });

    return {
      totalMessages,
      unreadCount,
      lastMessageAt: messages[0]?.createdAt || null
    };
  }
}
