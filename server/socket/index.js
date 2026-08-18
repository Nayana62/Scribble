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
  isFirstTurnOfCycle,
} = require("../game/turnOrder");

const {
  computeRoundScores,
  checkCycleCompleted,
  isGameFinished,
} = require("../game/scoring");

const {
  pickWordOptions,
} = require("../game/words");

const {
  startTimer,
  clearTimer,
  startRoundTimer,
  clearRoundTimer,
  getEndsAt,
} = require("../game/timer");

const {
  ROUND_DURATION_SEC,
  CHOOSING_DURATION_SEC,
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
     * 1. Cancels all timers unconditionally.
     * 2. Computes multi-guesser scores from room.correctGuesses.
     * 3. Applies point deltas to each player's running total.
     * 4. Emits `roundResult` to all clients (word + sorted scores).
     * 5. After 5 seconds, advances turn order and starts the next choosing phase.
     *
     * Handles all three reasons the same way:
     *  'allGuessed'         — everyone eligible has guessed correctly
     *  'timeout'            — draw timer expired
     *  'drawerDisconnected' — drawer left (already-earned guesser points are kept)
     *
     * @param {object} room
     * @param {string} roomId
     * @param {'allGuessed'|'timeout'|'drawerDisconnected'} reason
     */
    function endRound(room, roomId, reason) {
      // Always clear all timers first — regardless of why we're ending.
      clearRoundTimer(roomId);
      room.roundPhase    = null;
      room.choosingOptions = null;

      // Compute scores before clearing correctGuesses.
      const { scores, guessScoreMap, drawerPoints } = computeRoundScores(
        room,
        ROUND_DURATION_SEC * 1000,
      );

      // Apply point deltas to running totals for players still in the room.
      for (const [playerId, player] of room.players) {
        if (playerId === room.drawerId) {
          player.score += drawerPoints;
        } else if (guessScoreMap.has(playerId)) {
          player.score += guessScoreMap.get(playerId);
        }
        // non-guessing non-drawer players earn 0 — no change
      }

      const word = room.word ?? "";

      // Emit roundResult to everyone — this drives the 5-second overlay.
      io.to(roomId).emit("roundResult", { word, scores });

      // Broadcast updated running totals.
      broadcastPlayersUpdate(roomId);

      // Clear per-round state.
      room.correctGuesses = [];
      room.roundEndsAt    = null;

      // After the overlay has had its 5 seconds, advance to the next turn.
      setTimeout(() => startRound(roomId), 5000);
    }

    /**
     * Check if every currently-eligible non-drawer player has guessed correctly.
     * If so, end the round immediately.
     *
     * "Eligible" is computed fresh each call — disconnected players are excluded,
     * late joiners are included as soon as they appear in room.players.
     *
     * @param {object} room
     * @param {string} roomId
     */
    function checkAllGuessed(room, roomId) {
      if (room.roundPhase !== "drawing") return;

      const eligible = [...room.players.keys()].filter(
        (id) => id !== room.drawerId,
      );

      // If only the drawer remains, don't trigger allGuessed — let the timer run.
      if (eligible.length === 0) return;

      const allGuessed = eligible.every((id) =>
        room.correctGuesses.some((g) => g.playerId === id),
      );

      if (allGuessed) endRound(room, roomId, "allGuessed");
    }

    /**
     * Lock in a word and start the draw round. Single path for drawer pick,
     * early pick, and auto-pick on choosing timeout.
     *
     * @param {object} room
     * @param {string} roomId
     * @param {string} word
     */
    function lockWordAndStartDrawing(room, roomId, word) {
      if (!room.choosingOptions || !room.choosingOptions.includes(word)) {
        return;
      }

      clearTimer(roomId, "choosing");

      if (room.shouldResetUsedPoolOnLock) {
        room.usedWords = [];
        room.shouldResetUsedPoolOnLock = false;
      }

      room.word = word;
      room.wordLength = word.length;
      room.usedWords.push(word);
      room.choosingOptions = null;
      room.roundPhase = "drawing";
      room.actionLog = [];
      // Reset per-round guess tracking for the new drawing phase.
      room.correctGuesses = [];

      const drawerPlayer = room.players.get(room.drawerId);
      const drawerName = drawerPlayer ? drawerPlayer.name : "Drawer";

      startRoundTimer(roomId, ROUND_DURATION_SEC, () => {
        endRound(room, roomId, "timeout");
      });

      // Snapshot endsAt now — computeRoundScores needs it even after the timer is cleared.
      room.roundEndsAt = getEndsAt(roomId, "drawing");

      const wordHint = room.word.split("").map(c => c === " " ? " " : "_").join("");

      io.to(roomId).emit("roundStart", {
        drawerId: room.drawerId,
        drawerName,
        wordLength: room.wordLength,
        wordHint,
        endsAt: room.roundEndsAt,
        cycleNumber: room.cyclesCompleted + 1,
      });

      io.to(room.drawerId).emit("yourWord", { word: room.word });
      io.to(roomId).emit("canvasCleared");
      broadcastPlayersUpdate(roomId);
    }

    function triggerChoosingPhase(roomId, room) {
      room.roundPhase = "choosing";

      const { options, shouldResetUsedPool } = pickWordOptions(room.usedWords, 3);
      room.choosingOptions = options;
      room.shouldResetUsedPoolOnLock = shouldResetUsedPool;

      const drawerPlayer = room.players.get(room.drawerId);
      const drawerName = drawerPlayer ? drawerPlayer.name : "Drawer";

      startTimer(roomId, "choosing", CHOOSING_DURATION_SEC, () => {
        const current = rooms.get(roomId);
        if (!current || current.roundPhase !== "choosing") return;
        const autoWord =
          current.choosingOptions[
            Math.floor(Math.random() * current.choosingOptions.length)
          ];
        lockWordAndStartDrawing(current, roomId, autoWord);
      });

      const choosingEndsAt = getEndsAt(roomId, "choosing");

      io.to(room.drawerId).emit("choosingStarted", {
        drawerId: room.drawerId,
        drawerName,
        options,
        endsAt: choosingEndsAt,
        cycleNumber: room.cyclesCompleted + 1,
      });

      io.to(roomId).except(room.drawerId).emit("choosingStarted", {
        drawerId: room.drawerId,
        drawerName,
        endsAt: choosingEndsAt,
        cycleNumber: room.cyclesCompleted + 1,
      });

      io.to(roomId).emit("canvasCleared");
      broadcastPlayersUpdate(roomId);
    }

    function startChoosingPhase(roomId) {
      const room = rooms.get(roomId);
      if (!room) return;

      room.status = "in_progress";
      room.actionLog = [];
      room.word = null;
      room.wordLength = 0;

      const isNewCycle = isFirstTurnOfCycle(room, room.drawerId);
      if (isNewCycle) {
        room.roundPhase = "announcement";
        room.announcementCycleNumber = room.cyclesCompleted + 1;

        io.to(roomId).emit("newCycleAnnouncement", {
          cycleNumber: room.announcementCycleNumber,
        });

        io.to(roomId).emit("canvasCleared");
        broadcastPlayersUpdate(roomId);

        const drawerIdOnAnnouncement = room.drawerId;
        setTimeout(() => {
          const current = rooms.get(roomId);
          if (
            !current ||
            current.status !== "in_progress" ||
            current.roundPhase !== "announcement" ||
            current.drawerId !== drawerIdOnAnnouncement
          ) {
            return;
          }
          triggerChoosingPhase(roomId, current);
        }, 3000);
      } else {
        triggerChoosingPhase(roomId, room);
      }
    }

    /**
     * Drawer left during choosing — skip straight to next turn's choosing phase.
     */
    function skipChoosing(room, roomId) {
      clearTimer(roomId, "choosing");
      room.roundPhase = null;
      room.choosingOptions = null;
      room.word = null;
      room.wordLength = 0;
      startRound(roomId);
    }

    function startRound(roomId) {
      const room = rooms.get(roomId);
      if (!room) return;

      if (room.players.size < MIN_PLAYERS) {
        clearRoundTimer(roomId);
        room.status = "waiting";
        room.drawerId = null;
        room.word = null;
        room.wordLength = 0;
        room.actionLog = [];
        room.roundPhase = null;
        room.choosingOptions = null;
        room.correctGuesses = [];
        room.roundEndsAt = null;
        io.to(roomId).emit("canvasCleared");
        io.to(roomId).emit("waitingForPlayers", {
          count: room.players.size,
          min: MIN_PLAYERS,
        });
        broadcastPlayersUpdate(roomId);
        return;
      }

      checkCycleCompleted(room, room.drawerId);

      if (isGameFinished(room)) {
        clearRoundTimer(roomId);
        room.status = "finished";
        room.drawerId = null;
        room.word = null;
        room.wordLength = 0;
        room.actionLog = [];
        room.roundPhase = null;
        room.choosingOptions = null;
        room.correctGuesses = [];
        room.roundEndsAt = null;
        io.to(roomId).emit("canvasCleared");
        io.to(roomId).emit("gameFinished", {
          players: getPlayersArray(room),
        });
        broadcastPlayersUpdate(roomId);
        return;
      }

      room.status = "in_progress";
      const nextId = nextDrawer(room);
      room.drawerId = nextId;

      startChoosingPhase(roomId);
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
        room.roundPhase = null;
        room.choosingOptions = null;
        io.to(currentRoomId).emit("canvasCleared");
        io.to(currentRoomId).emit("waitingForPlayers", {
          count: room.players.size,
          min: MIN_PLAYERS,
          reason: "player_left",
        });
      } else if (socket.id === room.drawerId && room.status === "in_progress") {
        if (room.roundPhase === "choosing" || room.roundPhase === "announcement") {
          skipChoosing(room, currentRoomId);
        } else {
          endRound(room, currentRoomId, "drawerDisconnected");
        }
      } else if (room.status === "in_progress" && room.roundPhase === "drawing") {
        // A non-drawer left during the drawing phase — re-evaluate eligibility.
        // If everyone still connected has already guessed, end the round now.
        checkAllGuessed(room, currentRoomId);
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
        const drawer = room.players.get(room.drawerId);
        const drawerName = drawer ? drawer.name : "Drawer";

        if (room.roundPhase === "announcement") {
          socket.emit("newCycleAnnouncement", {
            cycleNumber: room.announcementCycleNumber,
          });
        } else if (room.roundPhase === "choosing") {
          if (socket.id === room.drawerId) {
            socket.emit("choosingStarted", {
              drawerId: room.drawerId,
              drawerName,
              options: room.choosingOptions,
              endsAt: getEndsAt(normalizedId, "choosing"),
              cycleNumber: room.cyclesCompleted + 1,
            });
          } else {
            socket.emit("choosingStarted", {
              drawerId: room.drawerId,
              drawerName,
              endsAt: getEndsAt(normalizedId, "choosing"),
              cycleNumber: room.cyclesCompleted + 1,
            });
          }
        } else if (room.roundPhase === "drawing") {
          const wordHint = room.word.split("").map(c => c === " " ? " " : "_").join("");
          socket.emit("roundStart", {
            drawerId: room.drawerId,
            drawerName,
            wordLength: room.wordLength,
            wordHint,
            endsAt: getEndsAt(normalizedId, "drawing"),
            cycleNumber: room.cyclesCompleted + 1,
          });

          if (room.actionLog.length > 0) {
            socket.emit("actionReplay", { actions: room.actionLog });
          }
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
      room.usedWords = [];
      for (const player of room.players.values()) {
        player.score = 0;
      }

      startRound(roomId);
    });

    // ── Word Chosen (drawer picks during choosing phase) ───────────────────────
    socket.on("wordChosen", ({ word }) => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.status !== "in_progress") return;
      if (socket.id !== room.drawerId || room.roundPhase !== "choosing") return;

      const trimmed = (word || "").trim();
      if (!trimmed) return;

      lockWordAndStartDrawing(room, roomId, trimmed);
    });

    // ── Draw Stroke (live preview segments, emitted per-mousemove) ─────────────
    // Payload: { prevX, prevY, x, y, color, width }
    // This event is for real-time rendering on other clients only.
    // The complete stroke is committed to the action log via `drawAction`.
    socket.on("drawStroke", (data) => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || socket.id !== room.drawerId || room.roundPhase !== "drawing") return;

      // Relay the segment with color/width so guessers render it correctly.
      socket.to(roomId).emit("strokeBroadcast", data);
    });

    // ── Draw Action (committed actions appended to the log) ────────────────────
    // type: 'stroke' | 'fill' | 'clear' | 'undo'
    socket.on("drawAction", (action) => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || socket.id !== room.drawerId || room.status !== "in_progress" || room.roundPhase !== "drawing") return;

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
      if (!room || room.status !== "in_progress" || room.roundPhase !== "drawing") return;

      const trimmed = text.trim();
      if (!trimmed) return;

      const player = room.players.get(socket.id);
      const senderName = player ? player.name : "Player";
      const isDrawer = socket.id === room.drawerId;

      const matchesWord =
        trimmed.toLowerCase() === (room.word || "").toLowerCase();

      // ── A. Drawer path ──────────────────────────────────────────────────────
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

      // ── B. Already-guessed player: treat subsequent messages as normal chat ──
      const alreadyGuessed = room.correctGuesses.some(
        (g) => g.playerId === socket.id,
      );
      if (alreadyGuessed) {
        // Re-evaluation suppressed; render as a plain (incorrect-style) chat entry.
        io.to(roomId).emit("guessResult", {
          text: trimmed,
          senderId: socket.id,
          senderName,
          correct: false,
        });
        return;
      }

      // ── C. Correct guess (first time) ───────────────────────────────────────
      if (matchesWord) {
        // Record the guess with timestamp and name (name stored so it survives disconnect).
        room.correctGuesses.push({
          playerId: socket.id,
          guessedAt: Date.now(),
          name: senderName,
        });

        // To the guesser: confirm their own correct guess (they see their text + checkmark).
        socket.emit("guessResult", {
          text: trimmed,
          senderId: socket.id,
          senderName,
          correct: true,
          isSelfConfirm: true,
        });

        // To everyone else: system-style notification — NO word text to prevent leaking.
        socket.to(roomId).emit("guessResult", {
          senderId: socket.id,
          senderName,
          correct: true,
          isSystemGuess: true,
        });

        // Check whether all eligible players have now guessed; end early if so.
        checkAllGuessed(room, roomId);
        return;
      }

      // ── D. Wrong guess ──────────────────────────────────────────────────────
      io.to(roomId).emit("guessResult", {
        text: trimmed,
        senderId: socket.id,
        senderName,
        correct: false,
      });
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
      room.usedWords = [];
      room.roundPhase = null;
      room.choosingOptions = null;
      room.correctGuesses = [];
      room.roundEndsAt = null;

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
