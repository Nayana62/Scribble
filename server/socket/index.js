const {
  rooms,
  socketRoomMap,
  ROOM_CAPACITY,
  MIN_PLAYERS,
  PLAYER_COLORS,
  generateRoomId,
  assignColor,
  getPlayersArray,
  initRoom,
} = require("../game/rooms");

const {
  nextDrawer,
  reassignHost,
} = require("../game/turnOrder");

const {
  awardPoints,
  checkCycleCompleted,
  isGameFinished,
} = require("../game/scoring");

const {
  pickWord,
} = require("../game/words");

module.exports = function(io) {
  io.on("connection", (socket) => {
    console.log(`Connected: ${socket.id}`);

    function broadcastPlayersUpdate(roomId) {
      const room = rooms.get(roomId);
      if (!room) return;
      io.to(roomId).emit("playersUpdate", {
        players: getPlayersArray(room),
        hostId: room.hostId,
        status: room.status,
        drawerId: room.drawerId,
      });
    }

    function startRound(roomId) {
      const room = rooms.get(roomId);
      if (!room) return;

      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
        room.roundTimer = null;
      }

      if (room.players.size < MIN_PLAYERS) {
        room.status = "waiting";
        room.drawerId = null;
        room.word = null;
        room.wordLength = 0;
        room.strokeHistory = [];
        io.to(roomId).emit("canvasCleared");
        io.to(roomId).emit("waitingForPlayers", {
          count: room.players.size,
          min: MIN_PLAYERS,
        });
        broadcastPlayersUpdate(roomId);
        return;
      }

      room.status = "in_progress";
      room.strokeHistory = []; // fresh canvas each round

      // Check cycles completed before picking next drawer
      checkCycleCompleted(room, room.drawerId);

      if (isGameFinished(room)) {
        room.status = "finished";
        room.drawerId = null;
        room.word = null;
        room.wordLength = 0;
        room.strokeHistory = [];
        io.to(roomId).emit("canvasCleared");
        io.to(roomId).emit("gameFinished", {
          players: getPlayersArray(room),
        });
        broadcastPlayersUpdate(roomId);
        return;
      }

      const nextId = nextDrawer(room);
      room.drawerId = nextId;

      // Pick word
      room.word = pickWord();
      room.wordLength = room.word.length;

      const drawerPlayer = room.players.get(room.drawerId);
      const drawerName = drawerPlayer ? drawerPlayer.name : "Drawer";

      // Tell everyone the round started (word shown as dashes to guessers)
      io.to(roomId).emit("roundStart", {
        drawerId: room.drawerId,
        drawerName,
        wordLength: room.wordLength,
      });

      // Tell drawer their word privately
      io.to(room.drawerId).emit("yourWord", { word: room.word });

      // Clear canvas for everyone
      io.to(roomId).emit("canvasCleared");

      broadcastPlayersUpdate(roomId);
    }

    function leaveCurrentRoom(socket) {
      const currentRoomId = socketRoomMap.get(socket.id);
      if (!currentRoomId) return;

      socketRoomMap.delete(socket.id);
      socket.leave(currentRoomId);

      const room = rooms.get(currentRoomId);
      if (!room) return;

      const player = room.players.get(socket.id);
      const playerName = player ? player.name : "A player";
      room.players.delete(socket.id);
      // Keep joinOrder intact; nextDrawer/reassignHost skip missing players.

      // Emit player left to remaining players
      io.to(currentRoomId).emit("playerLeft", {
        id: socket.id,
        name: playerName,
      });

      // Clean up empty rooms
      if (room.players.size === 0) {
        if (room.roundTimer) clearTimeout(room.roundTimer);
        rooms.delete(currentRoomId);
        return;
      }

      // Host transfer if host left
      const wasHost = socket.id === room.hostId;
      if (wasHost) {
        reassignHost(room);
        const newHost = room.players.get(room.hostId);
        io.to(currentRoomId).emit("hostChanged", {
          newHostId: room.hostId,
          newHostName: newHost ? newHost.name : "Unknown",
        });
      }

      broadcastPlayersUpdate(currentRoomId);

      // Below-minimum check
      if (room.players.size < MIN_PLAYERS) {
        if (room.roundTimer) {
          clearTimeout(room.roundTimer);
          room.roundTimer = null;
        }
        room.status = "waiting";
        room.drawerId = null;
        room.word = null;
        room.wordLength = 0;
        room.strokeHistory = [];
        io.to(currentRoomId).emit("canvasCleared");
        io.to(currentRoomId).emit("waitingForPlayers", {
          count: room.players.size,
          min: MIN_PLAYERS,
          reason: "player_left",
        });
      } else if (socket.id === room.drawerId && room.status === "in_progress") {
        // Drawer left mid-round but enough players remain → new round
        startRound(currentRoomId);
      }
    }

    // ── Create Room ────────────────────────────────────────────────────────────
    socket.on("createRoom", ({ name }) => {
      leaveCurrentRoom(socket);

      const playerName = (name || "Player").trim() || "Player";
      const roomId = generateRoomId();
      const room = initRoom(roomId, socket.id);
      const color = PLAYER_COLORS[0]; // host always gets first color

      socket.join(roomId);
      socketRoomMap.set(socket.id, roomId);
      room.players.set(socket.id, {
        id: socket.id,
        name: playerName,
        score: 0,
        color,
      });

      socket.emit("joinedRoomSuccess", {
        roomId,
        isHost: true,
        color,
      });

      broadcastPlayersUpdate(roomId);
    });

    // ── Join Room ──────────────────────────────────────────────────────────────
    socket.on("joinRoom", ({ roomId, name }) => {
      leaveCurrentRoom(socket);

      const normalizedId = (roomId || "").trim().toUpperCase();

      if (!rooms.has(normalizedId)) {
        socket.emit("roomNotFound", {
          message: "Room not found. Double-check the code and try again.",
        });
        return;
      }

      const room = rooms.get(normalizedId);

      if (room.players.size >= ROOM_CAPACITY) {
        socket.emit("roomFull", {
          message: "This room is full (12/12 players).",
        });
        return;
      }

      const playerName = (name || "Player").trim() || "Player";
      const color = assignColor(room);

      socket.join(normalizedId);
      socketRoomMap.set(socket.id, normalizedId);

      // Append to join order only if not already in it (reconnect safety)
      if (!room.joinOrder.includes(socket.id)) {
        room.joinOrder.push(socket.id);
      }

      room.players.set(socket.id, {
        id: socket.id,
        name: playerName,
        score: 0,
        color,
      });

      const isHost = socket.id === room.hostId;

      socket.emit("joinedRoomSuccess", {
        roomId: normalizedId,
        isHost,
        color,
      });

      socket.to(normalizedId).emit("playerJoined", {
        id: socket.id,
        name: playerName,
      });

      broadcastPlayersUpdate(normalizedId);

      if (room.status === "in_progress") {
        // Late joiner: drop straight into the active round
        const drawer = room.players.get(room.drawerId);
        socket.emit("roundStart", {
          drawerId: room.drawerId,
          drawerName: drawer ? drawer.name : "Drawer",
          wordLength: room.wordLength,
        });

        // Replay stroke history so the canvas isn't blank
        if (room.strokeHistory.length > 0) {
          socket.emit("strokeReplay", { strokes: room.strokeHistory });
        }
      }
    });

    // ── Start Game (host only) ─────────────────────────────────────────────────
    socket.on("startGame", () => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      if (socket.id !== room.hostId) {
        socket.emit("notice", { message: "Only the host can start the game." });
        return;
      }

      if (room.players.size < MIN_PLAYERS) {
        socket.emit("notice", {
          message: `Need at least ${MIN_PLAYERS} players to start (${room.players.size}/${MIN_PLAYERS} connected).`,
        });
        return;
      }

      // Reset game state for a fresh game
      room.cyclesCompleted = 0;
      for (const player of room.players.values()) {
        player.score = 0;
      }

      startRound(roomId);
    });

    // ── Draw Stroke ───────────────────────────────────────────────────────────
    socket.on("drawStroke", (data) => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || socket.id !== room.drawerId) return;

      // Store for late-joiner replay
      room.strokeHistory.push(data);

      // Relay to everyone else in the room
      socket.to(roomId).emit("strokeBroadcast", data);
    });

    // ── Clear Canvas ──────────────────────────────────────────────────────────
    socket.on("clearCanvasRequest", () => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || socket.id !== room.drawerId) return;

      room.strokeHistory = []; // wipe replay history too
      io.to(roomId).emit("canvasCleared");
    });

    // ── Submit Guess / Chat ───────────────────────────────────────────────────
    socket.on("submitGuess", ({ text }) => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.status !== "in_progress") return;

      const trimmed = text.trim();
      if (!trimmed) return;

      const player = room.players.get(socket.id);
      const senderName = player ? player.name : "Player";
      const isDrawer = socket.id === room.drawerId;

      const matchesWord =
        trimmed.toLowerCase() === (room.word || "").toLowerCase();

      if (isDrawer) {
        if (matchesWord) {
          socket.emit("guessBlocked", { text: trimmed });
          return;
        }
        // Drawer can chat normally
        io.to(roomId).emit("chatMessage", {
          text: trimmed,
          senderId: socket.id,
          senderName,
          isDrawer: true,
        });
        return;
      }

      if (matchesWord) {
        awardPoints(room, socket.id);

        io.to(roomId).emit("guessResult", {
          text: trimmed,
          senderId: socket.id,
          senderName,
          correct: true,
        });

        io.to(roomId).emit("roundEnd", {
          correctWord: room.word,
          winnerId: socket.id,
          winnerName: senderName,
        });

        broadcastPlayersUpdate(roomId);

        // Auto-start next round after 2.5 s
        if (room.roundTimer) clearTimeout(room.roundTimer);
        room.roundTimer = setTimeout(() => {
          startRound(roomId);
        }, 2500);
      } else {
        io.to(roomId).emit("guessResult", {
          text: trimmed,
          senderId: socket.id,
          senderName,
          correct: false,
        });
      }
    });

    // ── Play Again ────────────────────────────────────────────────────────────
    socket.on("playAgain", () => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      room.cyclesCompleted = 0;
      room.status = "waiting";
      room.drawerId = null;
      room.word = null;
      room.wordLength = 0;
      room.strokeHistory = [];
      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
        room.roundTimer = null;
      }

      for (const p of room.players.values()) {
        p.score = 0;
      }

      io.to(roomId).emit("playAgain");
      broadcastPlayersUpdate(roomId);
    });

    // ── Leave Room ─────────────────────────────────────────────────────────────
    socket.on("leaveRoom", () => {
      leaveCurrentRoom(socket);
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`Disconnected: ${socket.id}`);
      leaveCurrentRoom(socket);
    });
  });
};
