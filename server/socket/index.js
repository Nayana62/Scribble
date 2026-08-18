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

const {
  startRoundTimer,
  clearRoundTimer,
  getEndsAt,
} = require("../game/timer");

const {
  ROUND_DURATION_SEC,
} = require("../game/constants");

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

    /**
     * Consolidated round-ending logic.
     *
     * Cancels the running round timer unconditionally, then transitions to the
     * next round based on the reason:
     *
     *  'allGuessed'        — caller already emitted `roundEnd` and awarded points;
     *                        wait 2.5 s then start the next round.
     *  'timeout'           — no correct guess; reveal the word via `roundTimeout`,
     *                        wait 2.5 s then start the next round.
     *  'drawerDisconnected'— drawer left; start the next round immediately.
     *
     * @param {object} room
     * @param {string} roomId
     * @param {'allGuessed'|'timeout'|'drawerDisconnected'} reason
     */
    function endRound(room, roomId, reason) {
      // Always clear the round timer first — regardless of why we're ending.
      clearRoundTimer(roomId);

      if (reason === "timeout") {
        io.to(roomId).emit("roundTimeout", { word: room.word });
        setTimeout(() => startRound(roomId), 2500);
      } else if (reason === "allGuessed") {
        setTimeout(() => startRound(roomId), 2500);
      } else if (reason === "drawerDisconnected") {
        startRound(roomId);
      }
    }

    function startRound(roomId) {
      const room = rooms.get(roomId);
      if (!room) return;

      if (room.players.size < MIN_PLAYERS) {
        room.status = "waiting";
        room.drawerId = null;
        room.word = null;
        room.wordLength = 0;
        room.actionLog = [];
        io.to(roomId).emit("canvasCleared");
        io.to(roomId).emit("waitingForPlayers", {
          count: room.players.size,
          min: MIN_PLAYERS,
        });
        broadcastPlayersUpdate(roomId);
        return;
      }

      room.status = "in_progress";
      room.actionLog = []; // fresh canvas each round

      checkCycleCompleted(room, room.drawerId);

      if (isGameFinished(room)) {
        room.status = "finished";
        room.drawerId = null;
        room.word = null;
        room.wordLength = 0;
        room.actionLog = [];
        io.to(roomId).emit("canvasCleared");
        io.to(roomId).emit("gameFinished", {
          players: getPlayersArray(room),
        });
        broadcastPlayersUpdate(roomId);
        return;
      }

      const nextId = nextDrawer(room);
      room.drawerId = nextId;

      room.word = pickWord();
      room.wordLength = room.word.length;

      const drawerPlayer = room.players.get(room.drawerId);
      const drawerName = drawerPlayer ? drawerPlayer.name : "Drawer";

      // Start the authoritative round timer before broadcasting.
      startRoundTimer(roomId, ROUND_DURATION_SEC, () => {
        endRound(room, roomId, "timeout");
      });

      io.to(roomId).emit("roundStart", {
        drawerId: room.drawerId,
        drawerName,
        wordLength: room.wordLength,
        endsAt: getEndsAt(roomId),
      });

      io.to(room.drawerId).emit("yourWord", { word: room.word });
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

      io.to(currentRoomId).emit("playerLeft", {
        id: socket.id,
        name: playerName,
      });

      if (room.players.size === 0) {
        clearRoundTimer(currentRoomId);
        rooms.delete(currentRoomId);
        return;
      }

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

      if (room.players.size < MIN_PLAYERS) {
        clearRoundTimer(currentRoomId);
        room.status = "waiting";
        room.drawerId = null;
        room.word = null;
        room.wordLength = 0;
        room.actionLog = [];
        io.to(currentRoomId).emit("canvasCleared");
        io.to(currentRoomId).emit("waitingForPlayers", {
          count: room.players.size,
          min: MIN_PLAYERS,
          reason: "player_left",
        });
      } else if (socket.id === room.drawerId && room.status === "in_progress") {
        endRound(room, currentRoomId, "drawerDisconnected");
      }
    }

    // ── Create Room ────────────────────────────────────────────────────────────
    socket.on("createRoom", ({ name }) => {
      leaveCurrentRoom(socket);

      const playerName = (name || "Player").trim() || "Player";
      const roomId = generateRoomId();
      const room = initRoom(roomId, socket.id);
      const color = PLAYER_COLORS[0];

      socket.join(roomId);
      socketRoomMap.set(socket.id, roomId);
      room.players.set(socket.id, {
        id: socket.id,
        name: playerName,
        score: 0,
        color,
      });

      socket.emit("joinedRoomSuccess", { roomId, isHost: true, color });
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
        socket.emit("roomFull", { message: "This room is full (12/12 players)." });
        return;
      }

      const playerName = (name || "Player").trim() || "Player";
      const color = assignColor(room);

      socket.join(normalizedId);
      socketRoomMap.set(socket.id, normalizedId);

      if (!room.joinOrder.includes(socket.id)) {
        room.joinOrder.push(socket.id);
      }

      room.players.set(socket.id, { id: socket.id, name: playerName, score: 0, color });

      const isHost = socket.id === room.hostId;
      socket.emit("joinedRoomSuccess", { roomId: normalizedId, isHost, color });
      socket.to(normalizedId).emit("playerJoined", { id: socket.id, name: playerName });
      broadcastPlayersUpdate(normalizedId);

      if (room.status === "in_progress") {
        // Late joiner: sync to current round state.
        const drawer = room.players.get(room.drawerId);
        socket.emit("roundStart", {
          drawerId: room.drawerId,
          drawerName: drawer ? drawer.name : "Drawer",
          wordLength: room.wordLength,
          endsAt: getEndsAt(normalizedId),
        });

        // Send the full ordered action log so the late joiner can replay exactly.
        if (room.actionLog.length > 0) {
          socket.emit("actionReplay", { actions: room.actionLog });
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

      room.cyclesCompleted = 0;
      for (const player of room.players.values()) {
        player.score = 0;
      }

      startRound(roomId);
    });

    // ── Draw Stroke (live preview segments, emitted per-mousemove) ─────────────
    // Payload: { prevX, prevY, x, y, color, width }
    // This event is for real-time rendering on other clients only.
    // The complete stroke is committed to the action log via `drawAction`.
    socket.on("drawStroke", (data) => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || socket.id !== room.drawerId) return;

      // Relay the segment with color/width so guessers render it correctly.
      socket.to(roomId).emit("strokeBroadcast", data);
    });

    // ── Draw Action (committed actions appended to the log) ────────────────────
    // type: 'stroke' | 'fill' | 'clear' | 'undo'
    socket.on("drawAction", (action) => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || socket.id !== room.drawerId || room.status !== "in_progress") return;

      if (action.type === "stroke") {
        // { type, points:[{x,y},...], color, width }
        room.actionLog.push({
          type: "stroke",
          points: action.points,
          color: action.color,
          width: action.width,
        });
      } else if (action.type === "fill") {
        // { type, x, y, color }
        room.actionLog.push({
          type: "fill",
          x: action.x,
          y: action.y,
          color: action.color,
        });
      } else if (action.type === "clear") {
        // Append a clear entry — subsequent undo can remove it and replay prior state.
        room.actionLog.push({ type: "clear" });
      } else if (action.type === "undo") {
        // Pop the most recent entry instead of appending.
        if (room.actionLog.length > 0) {
          room.actionLog.pop();
        }
      } else {
        // Unknown action type — ignore.
        return;
      }

      // Relay to all other clients in the room so their canvases stay in sync.
      socket.to(roomId).emit("drawAction", action);
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
        endRound(room, roomId, "allGuessed");
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

      clearRoundTimer(roomId);

      room.cyclesCompleted = 0;
      room.status = "waiting";
      room.drawerId = null;
      room.word = null;
      room.wordLength = 0;
      room.actionLog = [];

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
