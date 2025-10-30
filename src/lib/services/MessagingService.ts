import { MessageRepository } from '../repositories/MessageRepository';
import { MatchRepository } from '../repositories/MatchRepository';
import { Message } from '@prisma/client';
import { getWebSocketServer } from '../websocket/server';

export interface SendMessageInput {
  matchId: string;
  senderId: string;
  content: string;
  contentType?: string;
}

export interface MessageWithUser extends Message {
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export class MessagingService {
  constructor(
    private messageRepo: MessageRepository,
    private matchRepo: MatchRepository
  ) {}

  async sendMessage(input: SendMessageInput): Promise<Message> {
    // 1. Verify match exists and users are mutual matches
    const match = await this.matchRepo.findById(input.matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status !== 'accepted') {
      throw new Error('Cannot send message to non-accepted match');
    }

    // 2. Verify sender is part of the match
    if (match.userId !== input.senderId && match.matchedUserId !== input.senderId) {
      throw new Error('Unauthorized to send message in this match');
    }

    // 3. Determine receiver
    const receiverId = match.userId === input.senderId 
      ? match.matchedUserId 
      : match.userId;

    // 4. Create message in database
    const message = await this.messageRepo.create({
      matchId: input.matchId,
      senderId: input.senderId,
      receiverId,
      content: input.content,
      contentType: input.contentType || 'text'
    });

    // 5. Send real-time notification via WebSocket
    try {
      const wsServer = getWebSocketServer();
      
      // Emit to match room
      wsServer.emitToMatch(input.matchId, 'message:new', {
        id: message.id,
        matchId: message.matchId,
        senderId: message.senderId,
        content: message.content,
        contentType: message.contentType,
        createdAt: message.createdAt
      });

      // Emit to receiver's personal room for notification
      wsServer.emitToUser(receiverId, 'notification:new_message', {
        matchId: input.matchId,
        messageId: message.id,
        senderId: input.senderId
      });
    } catch (error) {
      console.error('Failed to send real-time notification:', error);
      // Don't fail the request if WebSocket fails
    }

    return message;
  }

  async getConversationHistory(
    matchId: string,
    userId: string,
    options?: {
      limit?: number;
      before?: string;
    }
  ): Promise<Message[]> {
    // Verify user is part of the match
    const match = await this.matchRepo.findById(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.userId !== userId && match.matchedUserId !== userId) {
      throw new Error('Unauthorized to view this conversation');
    }

    // Get messages
    const messages = await this.messageRepo.findByMatchId(matchId, options);

    // Mark unread messages as delivered if they're for this user
    const unreadMessages = messages.filter(
      msg => msg.receiverId === userId && msg.status === 'sent'
    );

    if (unreadMessages.length > 0) {
      await Promise.all(
        unreadMessages.map(msg => this.messageRepo.markAsDelivered(msg.id))
      );
    }

    return messages;
  }

  async markMessagesAsRead(
    messageIds: string[],
    userId: string
  ): Promise<number> {
    // Verify all messages belong to this user as receiver
    const messages = await Promise.all(
      messageIds.map(id => this.messageRepo.findById(id))
    );

    const validMessageIds = messages
      .filter(msg => msg && msg.receiverId === userId)
      .map(msg => msg!.id);

    if (validMessageIds.length === 0) {
      return 0;
    }

    // Mark as read
    const count = await this.messageRepo.markMultipleAsRead(validMessageIds);

    // Notify sender via WebSocket
    try {
      const wsServer = getWebSocketServer();
      
      for (const msg of messages) {
        if (msg && msg.receiverId === userId) {
          wsServer.emitToUser(msg.senderId, 'message:read', {
            messageId: msg.id,
            matchId: msg.matchId,
            readBy: userId,
            readAt: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Failed to send read receipt:', error);
    }

    return count;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.messageRepo.getUnreadCount(userId);
  }

  async getMatchStats(matchId: string): Promise<{
    totalMessages: number;
    unreadCount: number;
    lastMessageAt: Date | null;
  }> {
    return this.messageRepo.getMessageStats(matchId);
  }

  async deleteMessage(
    messageId: string,
    userId: string
  ): Promise<void> {
    const message = await this.messageRepo.findById(messageId);
    
    if (!message) {
      throw new Error('Message not found');
    }

    // Only sender can delete their own message
    if (message.senderId !== userId) {
      throw new Error('Unauthorized to delete this message');
    }

    await this.messageRepo.deleteById(messageId);

    // Notify via WebSocket
    try {
      const wsServer = getWebSocketServer();
      wsServer.emitToMatch(message.matchId, 'message:deleted', {
        messageId: message.id,
        matchId: message.matchId
      });
    } catch (error) {
      console.error('Failed to send deletion notification:', error);
    }
  }
}
