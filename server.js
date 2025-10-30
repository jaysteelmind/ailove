import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Import WebSocket server
  const { initializeWebSocketServer } = await import('./src/lib/websocket/server.js');
  initializeWebSocketServer(httpServer);

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log('┌─────────────────────────────────────────────────┐');
      console.log('│  🚀 AI Love Backend Server                      │');
      console.log('├─────────────────────────────────────────────────┤');
      console.log(`│  📡 HTTP/API:    http://${hostname}:${port}      │`);
      console.log(`│  🔌 WebSocket:   ws://${hostname}:${port}        │`);
      console.log(`│  📊 Health:      http://${hostname}:${port}/api/health │`);
      console.log('├─────────────────────────────────────────────────┤');
      console.log('│  🗄️  PostgreSQL:  Connected                     │');
      console.log('│  🔴 Redis:        Connected                     │');
      console.log('│  🎯 Qdrant:       Connected                     │');
      console.log('│  🤖 Socket.IO:    Initialized                   │');
      console.log('└─────────────────────────────────────────────────┘');
    });
});
