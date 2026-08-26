# Server Architecture & State Specification

Detailed architectural specifications for the Scribble Node.js + Socket.IO server backend.

---

## 🔄 Room Lifecycle State Machine

```
                   ┌─────────────────────────────────────────┐
                   │               Room Created              │
                   └────────────────────┬────────────────────┘
                                        │
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │         State: "waiting" (Players < 2)  │
                   └────────────────────┬────────────────────┘
                                        │
                         Host click + Players >= 2
                                        │
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │       State: "in_progress" (Round 1)    │
                   │  - Pick Drawer (Sequential Rotation)    │
                   │  - Phase: "announcement" (3s, optional) │
                   │  - Phase: "choosing" (15s)              │
                   │  - Pick Word & Clear actionLog          │
                   │  - Phase: "drawing" (80s round timer)   │
                   │  - Broadcast `roundStart` & `yourWord`  │
                   └────────────────────┬────────────────────┘
                                        │
                  Correct Guess / Timeout / Drawer Left
                                        │
                           endRound(room, reason)
                                        │
                   ┌────────────────────┼────────────────────┐
                   │                   │                     │
            'allGuessed'          'timeout'       'drawerDisconnected'
                   │                   │                     │
                   └───────────────────┴─────────────────────┘
                                        │
                         Emit `roundResult` (Scores & Word)
                         Show 5-second results overlay
                                        │
                                        │
                   ┌────────────────────┴────────────────────┐
                   │                                         │
            CyclesCompleted >= 3                      CyclesCompleted < 3
                   │                                         │
                   ▼                                         ▼
            State: "finished"                        Start Next Round
            - Clear active drawer, word       (Increment cyclesCompleted on wrap)
            - Emit `gameFinished` with scores          (Loop back to "in_progress")
            - Wait for `playAgain` / `leaveRoom`
```

---

## 💾 Server Data Structures & Helpers

### 1. Room Schema
Each room state object in the internal `Map` holds:
```javascript
{
  hostId: string | null,        // current host socket ID
  players: Map<socketId, { id, name, score, color, token }>,
  joinOrder: string[],          // list of socket IDs in chronological join sequence
  drawerId: string | null,      // socket ID of active drawer
  word: string | null,          // target word (plain text)
  wordLength: number,           // target word length
  status: "waiting" | "in_progress" | "finished",
  roundPhase: "announcement" | "choosing" | "drawing" | null,
  cyclesCompleted: number,      // count of full sequential rotations completed
  announcementCycleNumber: number,
  choosingOptions: string[] | null,
  usedWords: string[],
  shouldResetUsedPoolOnLock: boolean,
  actionLog: object[],          // ordered drawing action log: { type:'stroke'|'fill'|'clear', ...payload }
                                 // used for late-joiner canvas replay; undo pops the last entry.
  correctGuesses: object[],     // per-round ordered list: { playerId, guessedAt, name }
  roundEndsAt: number | null,   // epoch-ms expiry of current drawing phase
  // Round timer state is managed externally in game/timer.js (keyed by roomId).
}
```

### 2. State & Rotation Helpers
- **`nextDrawer(room)`** *(in `game/turnOrder.js`)*: Pure function. Finds the next drawer socket ID in sequential order.
- **`reassignHost(room)`** *(in `game/turnOrder.js`)*: Pure function. Transfers host permissions (crown icon) to the next oldest active socket ID in `joinOrder`.
- **`checkCycleCompleted(room, currentDrawerId)`** *(in `game/scoring.js`)*: Pure function. Checks if the next round wraps back to player index 0, incrementing `room.cyclesCompleted`.
- **`isGameFinished(room)`** *(in `game/scoring.js`)*: Pure function. Returns if `room.cyclesCompleted >= 3`.
- **`computeRoundScores(room, duration)`** *(in `game/scoring.js`)*: Rank-based point calculation (100+bonus/80+bonus/60+bonus/50) based on guess order and time remaining, plus drawer points (max 100 based on correct guesser count).
- **`assignColor(room)`** *(in `game/rooms.js`)*: Cycles through a 12-color palette to assign next player color.
- **`pickWord()`** *(in `game/words.js`)*: Selects a random word.
- **`endRound(room, roomId, reason)`** *(inner function in `socket/index.js`)*: Consolidated round-ending logic. Cancels timers, computes and applies scores via `computeRoundScores`, emits `roundResult`, and sets a 5s timeout to start the next round.

---

## 📂 Modular Structure Specification

The server is decoupled into separate modules separating socket networking from core game state/rules:

1. **`server.js` (Bootstrapper)**:
   - Sets up Express, creates the HTTP server, configures Socket.IO, binds `socket/index.js`, and listens on PORT. Contains no game rules.
2. **`socket/index.js` (Event Coordinator)**:
   - Registers all `socket.on(...)` handlers.
   - Thin delegation layer: receives events, performs state queries/actions, and broadcasts/emits results to relevant sockets.
3. **`game/rooms.js` (Room Registry)**:
   - Holds the `rooms` and `socketRoomMap` Maps.
   - Manages capacity (12 max), player allocations, colors, and raw data models.
4. **`game/turnOrder.js` (Turn Rotation Engine)**:
   - Houses pure functions to calculate sequential drawing rotation and host promotion queue based on connection timestamps.
5. **`game/scoring.js` (Rules Engine)**:
   - Contains pure functions that compute multi-guesser point deltas `computeRoundScores` and track game cycle progression `checkCycleCompleted`.
6. **`game/words.js` (Word Repository)**:
   - Word lists and random pick queries.
7. **`game/timer.js` (Round Timer)**:
   - Owns all per-room countdown timer state (a `Map<roomId, { handle, endsAt, paused, remainingMs } >`).
   - `startRoundTimer(roomId, durationSec, onExpire)` — starts/restarts a room's countdown.
   - `clearRoundTimer(roomId)` — cancels any pending timeout; called unconditionally by `endRound`.
   - `getEndsAt(roomId)` — returns the epoch-ms expiry for a room, sent to clients in `roundStart` payloads.
   - `pauseTimer(roomId, kind)` — freezes the remaining countdown time.
   - `resumeTimer(roomId, kind, onExpire)` — restarts the countdown with the saved remaining duration.
   - `isTimerPaused(roomId, kind)` — returns if a timer is currently paused.
8. **`game/gracePeriod.js` (Grace Period)**:
   - Manages room deletion delay timers (`Map<roomId, handle>`).
   - `startGrace(roomId, durationSec, onExpire)` — registers a deletion timeout when player count hits zero.
   - `cancelGrace(roomId)` — clears the timeout when a player successfully reconnects/rejoins.
   - `hasGrace(roomId)` — returns if a grace timer is active.
9. **`game/constants.js` (Shared Constants)**:
   - `ROUND_DURATION_SEC = 80` — the single source of truth for round duration; will become host-configurable in a future settings feature.

---

## ⚡ Server Socket Events (Emitted to Clients)

| Event | Payload | When |
| :--- | :--- | :--- |
| `newCycleAnnouncement` | `{ cycleNumber }` | Round announcement phase begins |
| `choosingStarted` | `{ drawerId, drawerName, endsAt, options?, cycleNumber }` | Drawer choosing phase begins |
| `roundStart` | `{ drawerId, drawerName, wordLength, wordHint, endsAt, cycleNumber }` | New round begins (drawing phase) |
| `roundResult` | `{ word, scores }` | A round ends (timeout, all guessed, drawer left). Shows the 5s points overlay. |
| `gameFinished` | `{ players }` | All cycles completed |
| `playersUpdate` | `{ players, hostId, status, drawerId }` | Any roster change |
| `waitingForPlayers` | `{ count, min, reason? }` | Player count drops below minimum |
| `hostChanged` | `{ newHostId, newHostName }` | Host disconnects |
| `yourWord` | `{ word }` | Drawer only — secret word |
| `strokeBroadcast` | `{ prevX, prevY, x, y, color, width }` | Guessers receive live drawing segments |
| `drawAction` | `{ type: 'stroke'\|'fill'\|'clear'\|'undo', ...payload }` | Relays drawing actions to other clients |
| `actionReplay` | `{ actions: DrawAction[] }` | Late-joiner canvas replay |
| `canvasCleared` | — | Canvas wipe |
| `guessResult` | `{ text?, senderId, senderName, correct, isSystemGuess?, isSelfConfirm? }` | Guess outcome. Contains no text if `isSystemGuess` to prevent word leaks. |
| `chatMessage` | `{ text, senderId, senderName, isDrawer }` | Chat from drawer |
| `guessBlocked` | `{ text }` | Drawer tried to type the word |
| `notice` | `{ message }` | Server notice toast |
| `playerJoined` | `{ id, name }` | New player in room |
| `playerLeft` | `{ id, name }` | Player disconnected |
| `joinedRoomSuccess` | `{ roomId, isHost, color, token }` | Room join confirmed (token used for reconnects) |
| `roomNotFound` | `{ message }` | Invalid room code |
| `roomFull` | `{ message }` | Room at capacity |
| `playAgain` | — | Host restarted the game (now ack-based with host/state error responses) |
| `roomClosed` | `{ reason }` | Sent to clients when room is deleted after grace period expires |
| `rejoin` (received) | `{ roomId, token }` | Handled via ack; updates socket mapping/room lists and returns room state snapshot |
| `leaving` (received)| — | Fast disconnect debounce signal sent by client on `pagehide` |

---

## 🔐 Concurrency & Memory Model

1. **Single-Threaded Node Event Loop**:
   - All state modifications to `rooms` and `socketRoomMap` occur synchronously on Node's main loop, preventing race conditions during role assignment or guess validation.

2. **Garbage Collection Pruning**:
   - When a private room's player count drops to zero, the server starts a 60-second grace timer and pauses any active drawing or choosing timers.
   - If a player rejoins via `rejoin` within the window, the grace timer is cancelled and the countdown timers are resumed.
   - If the 60 seconds elapse with no rejoin, `clearAllTimers(roomId)` cancels any paused timeouts, `roomClosed` is broadcast to remaining sockets, and `rooms.delete(roomId)` executes to free memory.

3. **Socket Room Scoping**:
   - Socket.IO's native `.join(roomId)` and `.to(roomId)` primitives ensure zero cross-talk between isolated rooms.

4. **Timer Safety**:
   - `endRound` calls `clearRoundTimer` unconditionally before any transition logic, so a correct guess always cancels the running timeout before scheduling the next round. A stray `roundTimeout` event after a round has moved on is impossible.
