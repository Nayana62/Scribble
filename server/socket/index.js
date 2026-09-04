const {
  rooms,
  socketRoomMap,
  tokenRoomMap,
  ROOM_CAPACITY,
  MIN_PLAYERS,
  PLAYER_COLORS,
  generateRoomId,
  generateToken,
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
  clearAllTimers,
  getEndsAt,
  pauseTimer,
  resumeTimer,
  isTimerPaused,
} = require("../game/timer");

const {
  startGrace,
  cancelGrace,
  hasGrace,
} = require("../game/gracePeriod");

const {
  ROUND_DURATION_SEC,
  CHOOSING_DURATION_SEC,
  MAX_NAME_LENGTH,
  MAX_GUESS_LENGTH,
  MIN_GUESS_INTERVAL_MS,
} = require("../game/constants");

const ROOM_GRACE_SEC = 60;

// Socket payloads are untrusted input — a client can send any JSON shape,
// so call sites must not assume a field is a string just because it's present.
function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

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

    // Shared by endRound() and the insufficient-players path in leaveCurrentRoom().
    function applyRoundScoreDeltas(room) {
      const { scores, guessScoreMap, drawerPoints } = computeRoundScores(
        room,
        ROUND_DURATION_SEC * 1000,
      );

      for (const [playerId, player] of room.players) {
        if (playerId === room.drawerId) {
          player.score += drawerPoints;
        } else if (guessScoreMap.has(playerId)) {
          player.score += guessScoreMap.get(playerId);
        }
      }

      return { scores, guessScoreMap, drawerPoints };
    }

    // Ends the round for any of: everyone guessed, the timer expired, or the
    // drawer disconnected. Clears timers, applies scores, shows the result
    // overlay for 5s, then advances to the next turn.
    function endRound(room, roomId, reason) {
      clearRoundTimer(roomId);
      room.roundPhase    = null;
      room.choosingOptions = null;

      const { scores } = applyRoundScoreDeltas(room);

      const word = room.word ?? "";

      io.to(roomId).emit("roundResult", { word, scores });
      broadcastPlayersUpdate(roomId);

      room.correctGuesses = [];
      room.roundEndsAt    = null;

      setTimeout(() => startRound(roomId), 5000);
    }

    // Ends the round early once every currently-connected non-drawer has
    // guessed correctly. Recomputed fresh each call so it stays correct as
    // players disconnect or late-join mid-round.
    function checkAllGuessed(room, roomId) {
      if (room.roundPhase !== "drawing") return;

      const eligible = [...room.players.keys()].filter(
        (id) => id !== room.drawerId,
      );

      // Only the drawer remains — let the timer run instead of ending immediately.
      if (eligible.length === 0) return;

      const allGuessed = eligible.every((id) =>
        room.correctGuesses.some((g) => g.playerId === id),
      );

      if (allGuessed) endRound(room, roomId, "allGuessed");
    }

    // Locks in a word and starts the draw round — shared by drawer pick,
    // early pick, and auto-pick on choosing timeout.
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
        }, 2000);
      } else {
        triggerChoosingPhase(roomId, room);
      }
    }

    // Drawer left during choosing — skip straight to the next turn.
    function skipChoosing(room, roomId) {
      clearTimer(roomId, "choosing");
      room.roundPhase = null;
      room.choosingOptions = null;
      room.word = null;
      room.wordLength = 0;
      startRound(roomId);
    }

    // Ends the game and shows final standings — used both when all cycles
    // complete normally and when the player count drops too low to continue.
    function finishGame(room, roomId) {
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
    }

    function startRound(roomId) {
      const room = rooms.get(roomId);
      if (!room) return;

      // A scheduled call (e.g. from an endRound() timeout) can arrive after
      // the game was already concluded by another path.
      if (room.status === "finished") return;

      if (room.players.size < MIN_PLAYERS) {
        finishGame(room, roomId);
        return;
      }

      checkCycleCompleted(room, room.drawerId);

      if (isGameFinished(room)) {
        finishGame(room, roomId);
        return;
      }

      room.status = "in_progress";
      const nextId = nextDrawer(room);
      room.drawerId = nextId;

      startChoosingPhase(roomId);
    }

    // Single departure path — called from both `disconnect` and an explicit
    // `leaveRoom`. Handles host reassignment, departure broadcasts, and grace timers.
    function leaveCurrentRoom(socket) {
      const currentRoomId = socketRoomMap.get(socket.id);
      if (!currentRoomId) return;

      socketRoomMap.delete(socket.id);
      socket.leave(currentRoomId);

      const room = rooms.get(currentRoomId);
      if (!room) return;

      const player = room.players.get(socket.id);
      const playerName = player ? player.name : "A player";

      if (player && player.token) {
        tokenRoomMap.delete(player.token);
      }

      room.players.delete(socket.id);

      io.to(currentRoomId).emit("playerLeft", {
        id: socket.id,
        name: playerName,
      });

      if (room.players.size === 0) {
        // Room is empty — start a grace period instead of deleting immediately,
        // and pause any active timer so it doesn't keep counting down unattended.
        if (room.status === "in_progress") {
          pauseTimer(currentRoomId, "drawing");
          pauseTimer(currentRoomId, "choosing");
        }

        startGrace(currentRoomId, ROOM_GRACE_SEC, () => {
          clearAllTimers(currentRoomId);
          io.to(currentRoomId).emit("roomClosed", { reason: "empty" });
          rooms.delete(currentRoomId);
          console.log(`Room ${currentRoomId} deleted after grace period (no reconnect).`);
        });
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
        if (room.status === "in_progress") {
          // Commit any points already earned this round, then end the game
          // immediately with whoever remains, instead of parking in the lobby.
          if (room.roundPhase === "drawing") {
            applyRoundScoreDeltas(room);
          }
          finishGame(room, currentRoomId);
        } else {
          clearRoundTimer(currentRoomId);
          room.status = "waiting";
          room.drawerId = null;
          room.word = null;
          room.wordLength = 0;
          room.actionLog = [];
          room.roundPhase = null;
          room.choosingOptions = null;
          room.correctGuesses = [];
          room.roundEndsAt = null;
          io.to(currentRoomId).emit("canvasCleared");
          io.to(currentRoomId).emit("waitingForPlayers", {
            count: room.players.size,
            min: MIN_PLAYERS,
            reason: "player_left",
          });
        }
      } else if (socket.id === room.drawerId && room.status === "in_progress") {
        if (room.roundPhase === "choosing" || room.roundPhase === "announcement") {
          skipChoosing(room, currentRoomId);
        } else {
          endRound(room, currentRoomId, "drawerDisconnected");
        }
      } else if (room.status === "in_progress" && room.roundPhase === "drawing") {
        checkAllGuessed(room, currentRoomId);
      }
    }

    // ── Create Room ──────────────────────────────────────────────────────────
    socket.on("createRoom", ({ name }) => {
      leaveCurrentRoom(socket);

      const playerName =
        asString(name, "Player").trim().slice(0, MAX_NAME_LENGTH) || "Player";
      const roomId = generateRoomId();
      const room = initRoom(roomId, socket.id);
      const color = PLAYER_COLORS[0];
      const token = generateToken();

      socket.join(roomId);
      socketRoomMap.set(socket.id, roomId);
      room.players.set(socket.id, {
        id: socket.id,
        name: playerName,
        score: 0,
        color,
        token,
      });
      tokenRoomMap.set(token, roomId);

      socket.emit("joinedRoomSuccess", { roomId, isHost: true, color, token });
      broadcastPlayersUpdate(roomId);
    });

    // ── Join Room ────────────────────────────────────────────────────────────
    socket.on("joinRoom", ({ roomId, name }) => {
      leaveCurrentRoom(socket);

      const normalizedId = asString(roomId).trim().toUpperCase();

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

      const playerName =
        asString(name, "Player").trim().slice(0, MAX_NAME_LENGTH) || "Player";
      const color = assignColor(room);
      const token = generateToken();

      socket.join(normalizedId);
      socketRoomMap.set(socket.id, normalizedId);

      if (!room.joinOrder.includes(socket.id)) {
        room.joinOrder.push(socket.id);
      }

      room.players.set(socket.id, { id: socket.id, name: playerName, score: 0, color, token });
      tokenRoomMap.set(token, normalizedId);

      const isHost = socket.id === room.hostId;
      socket.emit("joinedRoomSuccess", { roomId: normalizedId, isHost, color, token });
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

    // ── Rejoin (reconnect with existing token) ──────────────────────────────
    socket.on("rejoin", ({ roomId, token }, ack) => {
      if (typeof ack !== "function") return;

      const normalizedId = asString(roomId).trim().toUpperCase();
      const room = rooms.get(normalizedId);

      if (!room) {
        ack({ error: "ROOM_NOT_FOUND" });
        return;
      }

      let oldSocketId = null;
      let player = null;
      for (const [sid, p] of room.players) {
        if (p.token === token) {
          oldSocketId = sid;
          player = p;
          break;
        }
      }

      if (!player) {
        ack({ error: "PLAYER_NOT_FOUND" });
        return;
      }

      // Re-associate the player record with the new socket id everywhere it's referenced.
      const oldId = oldSocketId;
      const newId = socket.id;

      player.id = newId;

      room.players.delete(oldId);
      room.players.set(newId, player);

      const joIdx = room.joinOrder.indexOf(oldId);
      if (joIdx !== -1) room.joinOrder[joIdx] = newId;

      if (room.hostId === oldId) room.hostId = newId;
      if (room.drawerId === oldId) room.drawerId = newId;

      // Re-key any correct-guess record made under the old socket id, so the
      // reconnected player's earned points/eligibility carry over correctly.
      for (const guess of room.correctGuesses) {
        if (guess.playerId === oldId) guess.playerId = newId;
      }

      socketRoomMap.delete(oldId);
      socketRoomMap.set(newId, normalizedId);

      socket.join(normalizedId);

      if (hasGrace(normalizedId)) {
        cancelGrace(normalizedId);
        console.log(`Room ${normalizedId}: grace period cancelled — ${player.name} rejoined.`);

        if (isTimerPaused(normalizedId, "drawing")) {
          resumeTimer(normalizedId, "drawing", () => {
            const current = rooms.get(normalizedId);
            if (current) endRound(current, normalizedId, "timeout");
          });
        }
        if (isTimerPaused(normalizedId, "choosing")) {
          resumeTimer(normalizedId, "choosing", () => {
            const current = rooms.get(normalizedId);
            if (!current || current.roundPhase !== "choosing") return;
            const autoWord =
              current.choosingOptions[
                Math.floor(Math.random() * current.choosingOptions.length)
              ];
            lockWordAndStartDrawing(current, normalizedId, autoWord);
          });
        }
      }

      const wordHint = room.word
        ? room.word.split("").map(c => (c === " " ? " " : "_")).join("")
        : null;

      const snapshot = {
        players: getPlayersArray(room),
        hostId: room.hostId,
        status: room.status,
        drawerId: room.drawerId,
        roundPhase: room.roundPhase,
        wordLength: room.wordLength || null,
        wordHint,
        endsAt: getEndsAt(normalizedId, "drawing"),
        choosingEndsAt: getEndsAt(normalizedId, "choosing"),
        cycleNumber: room.cyclesCompleted + 1,
      };

      ack({ success: true, token, snapshot });

      if (room.roundPhase === "drawing" && room.actionLog.length > 0) {
        socket.emit("actionReplay", { actions: room.actionLog });
      }

      if (room.roundPhase === "drawing" && room.drawerId === newId && room.word) {
        socket.emit("yourWord", { word: room.word });
      }

      if (room.roundPhase === "choosing" && room.drawerId === newId && room.choosingOptions) {
        const drawerPlayer = room.players.get(newId);
        const drawerName = drawerPlayer ? drawerPlayer.name : "Drawer";
        socket.emit("choosingStarted", {
          drawerId: room.drawerId,
          drawerName,
          options: room.choosingOptions,
          endsAt: getEndsAt(normalizedId, "choosing"),
          cycleNumber: room.cyclesCompleted + 1,
        });
      }

      broadcastPlayersUpdate(normalizedId);
      console.log(`Rejoin: ${player.name} (${oldId} → ${newId}) in room ${normalizedId}`);
    });

    // ── Start Game (host only) ──────────────────────────────────────────────
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

    // ── Word Chosen (drawer picks during choosing phase) ────────────────────
    socket.on("wordChosen", ({ word }) => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.status !== "in_progress") return;
      if (socket.id !== room.drawerId || room.roundPhase !== "choosing") return;

      const trimmed = asString(word).trim();
      if (!trimmed) return;

      lockWordAndStartDrawing(room, roomId, trimmed);
    });

    // ── Draw Stroke (live preview batches, throttled client-side to ~1/frame) ──
    // Real-time rendering only — relayed opaquely without inspecting its shape.
    // The complete stroke is committed to the action log via `drawAction`.
    socket.on("drawStroke", (data) => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || socket.id !== room.drawerId || room.roundPhase !== "drawing") return;

      socket.to(roomId).emit("strokeBroadcast", data);
    });

    // ── Draw Action (committed actions appended to the log) ──────────────────
    socket.on("drawAction", (action) => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || socket.id !== room.drawerId || room.status !== "in_progress" || room.roundPhase !== "drawing") return;

      if (action.type === "stroke") {
        room.actionLog.push({
          type: "stroke",
          points: action.points,
          color: action.color,
          width: action.width,
        });
      } else if (action.type === "fill") {
        room.actionLog.push({
          type: "fill",
          x: action.x,
          y: action.y,
          color: action.color,
        });
      } else if (action.type === "clear") {
        // Append rather than reset — undo can pop it and replay prior state.
        room.actionLog.push({ type: "clear" });
      } else if (action.type === "undo") {
        if (room.actionLog.length > 0) {
          room.actionLog.pop();
        }
      } else {
        return;
      }

      socket.to(roomId).emit("drawAction", action);
    });

    // ── Submit Guess / Chat ──────────────────────────────────────────────────
    socket.on("submitGuess", ({ text }) => {
      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.status !== "in_progress" || room.roundPhase !== "drawing") return;

      const trimmed = asString(text).trim().slice(0, MAX_GUESS_LENGTH);
      if (!trimmed) return;

      const player = room.players.get(socket.id);

      // Per-socket rate limit — throttles this player only, not the room.
      const now = Date.now();
      if (player && now - (player.lastGuessAt ?? 0) < MIN_GUESS_INTERVAL_MS) {
        return;
      }
      if (player) player.lastGuessAt = now;

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

      const alreadyGuessed = room.correctGuesses.some(
        (g) => g.playerId === socket.id,
      );
      if (alreadyGuessed) {
        // Treat further messages from a correct guesser as plain chat.
        io.to(roomId).emit("guessResult", {
          text: trimmed,
          senderId: socket.id,
          senderName,
          correct: false,
        });
        return;
      }

      if (matchesWord) {
        room.correctGuesses.push({
          playerId: socket.id,
          guessedAt: Date.now(),
          name: senderName,
        });

        socket.emit("guessResult", {
          text: trimmed,
          senderId: socket.id,
          senderName,
          correct: true,
          isSelfConfirm: true,
        });

        // Everyone else gets a system notification with no word text, to avoid leaking it.
        socket.to(roomId).emit("guessResult", {
          senderId: socket.id,
          senderName,
          correct: true,
          isSystemGuess: true,
        });

        checkAllGuessed(room, roomId);
        return;
      }

      io.to(roomId).emit("guessResult", {
        text: trimmed,
        senderId: socket.id,
        senderName,
        correct: false,
      });
    });

    // ── Play Again ───────────────────────────────────────────────────────────
    socket.on("playAgain", (ack) => {
      const respond = typeof ack === "function" ? ack : () => {};

      const roomId = socketRoomMap.get(socket.id);
      if (!roomId) { respond({ error: "NOT_IN_ROOM" }); return; }
      const room = rooms.get(roomId);
      if (!room) { respond({ error: "NOT_IN_ROOM" }); return; }

      if (socket.id !== room.hostId) {
        respond({ error: "NOT_HOST" });
        return;
      }

      if (room.status !== "finished") {
        respond({ error: "INVALID_STATE" });
        return;
      }

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

      respond({ success: true });
      io.to(roomId).emit("playAgain");
      broadcastPlayersUpdate(roomId);
    });

    // ── Leave Room ───────────────────────────────────────────────────────────
    // Ack lets the client navigate home only once the server has confirmed
    // the departure, avoiding an optimistic-navigation race.
    socket.on("leaveRoom", (ack) => {
      leaveCurrentRoom(socket);
      if (typeof ack === "function") {
        ack({ success: true });
      }
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`Disconnected: ${socket.id}`);
      leaveCurrentRoom(socket);
    });
  });
};
