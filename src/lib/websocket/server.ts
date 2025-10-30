import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

export interface AuthenticatedSocket {
  id: string;
  userId: string;
  email: string;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private pubClient: Redis;
  private subClient: Redis;

  constructor(httpServer: HTTPServer) {
    // Initialize Socket.IO
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });

    // Initialize Redis clients for adapter
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.pubClient = new Redis(redisUrl);
    this.subClient = this.pubClient.duplicate();

    // Set up Redis adapter for horizontal scaling
    this.io.adapter(createAdapter(this.pubClient, this.subClient));

    // Set up authentication middleware
    this.setupAuthentication();

    // Set up connection handlers
    this.setupConnectionHandlers();

    console.log('✅ WebSocket Server initialized');
  }

  private setupAuthentication() {
    this.io.use((socket: any, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        socket.userId = decoded.userId;
        socket.email = decoded.email;
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupConnectionHandlers() {
    this.io.on('connection', (socket: any) => {
      console.log(`🔌 User connected: ${socket.userId} (${socket.id})`);

      // Join user's personal room
      socket.join(`user:${socket.userId}`);

      // Handle joining match rooms
      socket.on('join:match', (matchId: string) => {
        socket.join(`match:${matchId}`);
        console.log(`👥 User ${socket.userId} joined match:${matchId}`);
      });

      // Handle leaving match rooms
      socket.on('leave:match', (matchId: string) => {
        socket.leave(`match:${matchId}`);
        console.log(`👋 User ${socket.userId} left match:${matchId}`);
      });

      // Handle messages
      socket.on('message:send', async (data: any) => {
        const { matchId, content } = data;
        
        // Emit to match room (excluding sender handled by service layer)
        this.io.to(`match:${matchId}`).emit('message:new', {
          matchId,
          content,
          senderId: socket.userId,
          timestamp: new Date().toISOString()
        });
      });

      // Handle typing indicators
      socket.on('typing:start', (data: any) => {
        const { matchId } = data;
        socket.to(`match:${matchId}`).emit('typing:user', {
          matchId,
          userId: socket.userId,
          isTyping: true
        });
      });

      socket.on('typing:stop', (data: any) => {
        const { matchId } = data;
        socket.to(`match:${matchId}`).emit('typing:user', {
          matchId,
          userId: socket.userId,
          isTyping: false
        });
      });

      // Handle read receipts
      socket.on('message:read', (data: any) => {
        const { matchId, messageId } = data;
        socket.to(`match:${matchId}`).emit('message:read', {
          matchId,
          messageId,
          readBy: socket.userId,
          readAt: new Date().toISOString()
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 User disconnected: ${socket.userId} (${socket.id})`);
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        console.error(`❌ Socket error for user ${socket.userId}:`, error);
      });
    });
  }

  // Public method to emit events from API routes
  public emitToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public emitToMatch(matchId: string, event: string, data: any) {
    this.io.to(`match:${matchId}`).emit(event, data);
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

export let wsServer: WebSocketServer | null = null;

export function initializeWebSocketServer(httpServer: HTTPServer): WebSocketServer {
  if (!wsServer) {
    wsServer = new WebSocketServer(httpServer);
  }
  return wsServer;
}

export function getWebSocketServer(): WebSocketServer {
  if (!wsServer) {
    throw new Error('WebSocket server not initialized');
  }
  return wsServer;
}
