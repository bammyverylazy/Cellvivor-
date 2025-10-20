// Socket.js - Multiplayer server logic
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { Gameplay, getKeywordModel } from './models.js';

const rooms = {};
const players = {};

export function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('[Socket] Connected:', socket.id);
    console.log('[Socket] Handshake origin:', socket.handshake.headers.origin);

    socket.on('createRoom', (roomCode) => {
      if (!rooms[roomCode]) {
        rooms[roomCode] = {
          host: socket.id,
          guessers: [],
          hinters: [],
          started: false,
          score: 0
        };
        players[socket.id] = { room: roomCode, role: null, name: null };
        socket.join(roomCode);
        console.log(`[Room] Created: ${roomCode}`);
      }
    });

    socket.on('joinRoom', (roomCode) => {
      if (!rooms[roomCode]) return socket.emit('roomJoinError', 'Room does not exist.');
      if (rooms[roomCode].started) return socket.emit('roomJoinError', 'Game already started.');
      players[socket.id] = { room: roomCode, role: null, name: null };
      socket.join(roomCode);
      socket.to(roomCode).emit('playerJoined', socket.id);
      console.log(`[Room] Joined: ${roomCode}`);
    });

    socket.on('setRole', (role) => {
      const roomCode = players[socket.id]?.room;
      const room = rooms[roomCode];
      if (!room || room.started || players[socket.id].role) return;

      players[socket.id].role = role;
      if (role === 'guesser' && !room.guessers.includes(socket.id)) {
        room.guessers.push(socket.id);
      }
      if (role === 'hinter' && !room.hinters.includes(socket.id)) {
        room.hinters.push(socket.id);
      }

      io.to(roomCode).emit('roleUpdate', {
        guesser: room.guessers,
        hinter: room.hinters
      });

      console.log(`[Socket] Role set: ${role} (${socket.id})`);
    });

    socket.on('start-game', async ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room || room.started) return;

      room.started = true;
      room.score = 0;

      try {
        await Gameplay.deleteMany({ roomCode });
        const gameplay = new Gameplay({
          roomCode,
          hinter: room.hinters.map(id => ({ _id: id, name: players[id]?.name || 'Hinter' })),
          guesser: room.guessers.map(id => ({ _id: id, name: players[id]?.name || 'Guesser' })),
          mistakes: [],
          score: 0
        });
        await gameplay.save();
      } catch (err) {
        console.error('[DB] Gameplay init failed:', err);
      }

      io.to(roomCode).emit('game-started', { startTime: Date.now() });
    });

    socket.on('keyword', async ({ roomCode, keyword, hint }) => {
      // choose collection based on client origin
      const origin = socket.handshake.headers.origin;
      const Keyword = getKeywordModel(origin);
      try {
        const doc = await Keyword.findOne({ word: keyword });
        const finalHint = doc?.hint || hint;
        io.to(roomCode).emit('keyword', { keyword, hint: finalHint });
      } catch (err) {
        console.error('[Socket] keyword DB lookup failed:', err);
        io.to(roomCode).emit('keyword', { keyword, hint });
      }
    });

    socket.on('hint-used', ({ roomCode, hint }) => {
      console.log(`[Hint] From client — Room: ${roomCode}, Hint: ${hint}`); 
      io.to(roomCode).emit('show-hint', { hint });
    });

    socket.on('score-update', async ({ roomCode, result, keyword }) => {
      const room = rooms[roomCode];
      if (!room) return;

      if (!room.score) room.score = 0;
      if (result === 'TT') room.score += 2;
      else if (result === 'FT') room.score += 1;

      try {
        const gameplay = await Gameplay.findOne({ roomCode });
        if (gameplay) {
          gameplay.mistakes.push(`${result}:${keyword}`);
          gameplay.score = room.score;
          await gameplay.save();
        }
      } catch (err) {
        console.error('[Socket] Failed to update DB score:', err);
      }

      console.log(`[Socket] score-update → room: ${roomCode}, score: ${room.score}`);
      io.to(roomCode).emit('score-update', { score: room.score });
    });

    socket.on('player-quit', ({ roomCode }) => {
      const player = players[socket.id];
      const room = rooms[roomCode];
      if (!player || !room) return;

      const { role } = player;
      const name = player.name || `Player-${socket.id.slice(0, 4)}`;

      if (role && room[role + 's']) {
        room[role + 's'] = room[role + 's'].filter(id => id !== socket.id);
      }

      io.to(roomCode).emit('player-left', {
        userId: socket.id,
        role,
        name
      });

      delete players[socket.id];
      socket.leave(roomCode);
    });

    socket.on('disconnect', () => {
      const player = players[socket.id];
      if (!player) return;

      const roomCode = player.room;
      const role = player.role;
      const name = player.name || `Player-${socket.id.slice(0, 4)}`;

      if (rooms[roomCode]) {
        if (role && rooms[roomCode][role + 's']) {
          rooms[roomCode][role + 's'] = rooms[roomCode][role + 's'].filter(id => id !== socket.id);
        }
        io.to(roomCode).emit('player-left', { userId: socket.id, role, name });
      }

      delete players[socket.id];
    });
  });
}
