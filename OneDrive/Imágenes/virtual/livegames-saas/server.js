const { createServer } = require('http');
const { Server } = require('socket.io');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    // Agregar headers CORS a todas las peticiones
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    handler(req, res);
  });
  
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type']
    },
    transports: ['websocket', 'polling']
  });

  // Almacenar streamers y viewers por sala
  const rooms = new Map();

  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    // Streamer se une a una sala
    socket.on('join-room', ({ roomId, isStreamer }) => {
      socket.join(roomId);
      
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { streamer: null, viewers: new Set() });
      }

      const room = rooms.get(roomId);

      if (isStreamer) {
        room.streamer = socket.id;
        console.log(`Streamer ${socket.id} se unió a sala ${roomId}`);
        
        // Notificar a todos los viewers que el streamer está listo
        socket.to(roomId).emit('streamer-ready');
      } else {
        room.viewers.add(socket.id);
        console.log(`Viewer ${socket.id} se unió a sala ${roomId}`);
        
        // Si hay streamer, notificarle que hay un nuevo viewer
        if (room.streamer) {
          io.to(room.streamer).emit('viewer-joined', { viewerId: socket.id });
        }
      }

      // Enviar conteo de viewers
      io.to(roomId).emit('viewer-count', room.viewers.size);
    });

    // Señalización WebRTC
    socket.on('offer', ({ roomId, offer, viewerId }) => {
      console.log(`Offer de streamer para viewer ${viewerId}`);
      io.to(viewerId).emit('offer', { offer, streamerId: socket.id });
    });

    socket.on('answer', ({ roomId, answer, streamerId }) => {
      console.log(`Answer de viewer para streamer ${streamerId}`);
      io.to(streamerId).emit('answer', { answer, viewerId: socket.id });
    });

    socket.on('ice-candidate', ({ roomId, candidate, targetId }) => {
      console.log(`ICE candidate para ${targetId}`);
      io.to(targetId).emit('ice-candidate', { candidate, senderId: socket.id });
    });

    // Desconexión
    socket.on('disconnect', () => {
      console.log('Cliente desconectado:', socket.id);
      
      // Limpiar de todas las salas
      rooms.forEach((room, roomId) => {
        if (room.streamer === socket.id) {
          // Streamer se desconectó, notificar a viewers
          io.to(roomId).emit('streamer-disconnected');
          room.streamer = null;
        } else if (room.viewers.has(socket.id)) {
          room.viewers.delete(socket.id);
          io.to(roomId).emit('viewer-count', room.viewers.size);
        }
      });
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> WebSocket server running`);
    });
});
