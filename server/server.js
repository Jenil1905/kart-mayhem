import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GameRoom } from './room.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

const PORT = process.env.PORT || 3000;

// Active rooms storage
const rooms = new Map(); // roomId -> GameRoom
const socketToRoom = new Map(); // socketId -> roomId

// Helper to generate 4-character uppercase room codes
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Serve dist directory if built, or client directory for dev
const distPath = path.join(rootDir, 'dist');
const clientPath = path.join(rootDir, 'client');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  app.use(express.static(clientPath));
}

// API to list room statistics
app.get('/api/status', (req, res) => {
  const roomStats = Array.from(rooms.values()).map(r => ({
    id: r.id,
    players: r.players.size,
    bots: r.bots.size,
    matchTimeLeft: Math.ceil(r.matchTimeLeft),
    state: r.state
  }));
  res.json({
    title: 'Kart Mayhem - Multiplayer Kart Combat',
    activeRooms: rooms.size,
    rooms: roomStats
  });
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  const indexPath = fs.existsSync(distPath)
    ? path.join(distPath, 'index.html')
    : path.join(clientPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Socket.IO event handling
io.on('connection', (socket) => {
  socket.on('ping_check', () => {
    socket.emit('pong_check');
  });

  socket.on('create_room', (data = {}, callback) => {
    let roomId = generateRoomCode();
    while (rooms.has(roomId)) {
      roomId = generateRoomCode();
    }

    const room = new GameRoom(roomId, io, {
      isPrivate: true,
      allowBots: false, // Custom created rooms are strictly human-only (NO BOTS/NPCs)
      targetPlayers: data.targetPlayers || 8,
      matchDuration: data.matchDuration || 180
    });
    rooms.set(roomId, room);

    socket.join(roomId);
    socketToRoom.set(socket.id, roomId);
    room.addPlayer(socket, data.profile || {});

    console.log(`[Private Room Created - No Bots] ${roomId} by ${socket.id}`);
    if (typeof callback === 'function') {
      callback({ success: true, roomId });
    }
  });

  // Join existing room
  socket.on('join_room', (data = {}, callback) => {
    const roomId = (data.roomId || '').toUpperCase().trim();
    let room = rooms.get(roomId);

    if (!room) {
      // If room doesn't exist, create it as a private room (no bots)
      room = new GameRoom(roomId, io, {
        isPrivate: true,
        allowBots: false,
        targetPlayers: data.targetPlayers || 8,
        matchDuration: data.matchDuration || 180
      });
      rooms.set(roomId, room);
    }

    socket.join(roomId);
    socketToRoom.set(socket.id, roomId);
    room.addPlayer(socket, data.profile || {});

    console.log(`[Player Joined Room] ${roomId} ID: ${socket.id}`);
    if (typeof callback === 'function') {
      callback({ success: true, roomId });
    }
  });

  // Quick Play (matchmake into open PUBLIC room with NPCs, or create new public room)
  socket.on('quick_play', (data = {}, callback) => {
    let targetRoom = null;

    // Find any public room with bots
    for (const room of rooms.values()) {
      if (!room.isPrivate && room.allowBots && room.players.size < room.targetPlayers && room.state !== 'podium') {
        targetRoom = room;
        break;
      }
    }

    if (!targetRoom) {
      const roomId = generateRoomCode();
      targetRoom = new GameRoom(roomId, io, {
        isPrivate: false,
        allowBots: true, // Only quick play has bots/NPCs
        targetPlayers: 6,
        matchDuration: 180
      });
      rooms.set(roomId, targetRoom);
    }

    socket.join(targetRoom.id);
    socketToRoom.set(socket.id, targetRoom.id);
    targetRoom.addPlayer(socket, data.profile || {});

    console.log(`[Quick Play with Bots] ${socket.id} joined room ${targetRoom.id}`);
    if (typeof callback === 'function') {
      callback({ success: true, roomId: targetRoom.id });
    }
  });

  // Client-assisted item box pickup
  socket.on('hit_item_box', (data = {}) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room && data.boxId) {
      room.handlePlayerHitBox(socket.id, data.boxId);
    }
  });

  // Player continuous input update
  socket.on('player_input', (input) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      room.handlePlayerInput(socket.id, input);
    }
  });

  // Player fires active weapon
  socket.on('fire_weapon', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      room.handlePlayerFire(socket.id);
    }
  });

  // Chat message
  socket.on('send_chat', (msg) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      const player = room.players.get(socket.id);
      const name = player ? player.name : 'Unknown';
      const cleanText = String(msg).slice(0, 80);
      io.to(roomId).emit('chat_message', {
        sender: name,
        color: player ? player.color : '#fff',
        text: cleanText,
        time: Date.now()
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socketToRoom.delete(socket.id);
      const room = rooms.get(roomId);
      if (room) {
        room.removePlayer(socket.id);

        // If no human players left, clean up after 1 minute
        if (room.players.size === 0) {
          setTimeout(() => {
            if (room.players.size === 0) {
              room.cleanup();
              rooms.delete(roomId);
              console.log(`[Room Cleaned] ${roomId}`);
            }
          }, 60000);
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🏎️  KART MAYHEM SERVER RUNNING ON PORT ${PORT} `);
  console.log(`🌐  Local URL: http://localhost:${PORT}        `);
  console.log(`===============================================`);
});
