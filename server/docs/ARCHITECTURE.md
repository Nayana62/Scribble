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
                   │  - Phase: "announcement" (2s, only on   │
                   │    the first turn of a new cycle)       │
                   │  - Phase: "choosing" (15s, auto-picks   │
                   │    a random option on timeout)          │
                   │  - Pick Word & Clear actionLog          │
                   │  - Phase: "drawing" (80s round timer)   │
                   │  - Broadcast `roundStart` & `yourWord`  │
                   └────────────────────┬────────────────────┘
                                        │
                  All Eligible Guessed / Timeout / Drawer Left
                                        │
                           endRound(room, roomId, reason)
                                        │
                   ┌────────────────────┼────────────────────┐
                   │                   │                     │
            'allGuessed'          'timeout'       'drawerDisconnected'
                   │                   │                     │
                   └───────────────────┴─────────────────────┘
                                        │
                    Scores computed & applied to running totals
                    Emit `roundResult` (word + per-player points)
                         Show 5-second results overlay
                                        │
                   ┌────────────────────┴────────────────────┐
                   │                                         │
            CyclesCompleted >= 3                      CyclesCompleted < 3
             (or player count < 2)                            │
                   │                                         │
                   ▼                                         ▼
            State: "finished"                        Start Next Round
            - Clear active drawer, word       (Increment cyclesCompleted on wrap)
            - Emit `gameFinished` with scores          (Loop back to "in_progress")
            - Wait for `playAgain` / `leaveRoom`
```

If the player count drops below 2 while a game is `"in_progress"`, the game ends immediately via the same `finishGame` path (whoever remains is declared the winner) rather than waiting for the current round to finish. If it drops below 2 while still `"waiting"` or `"finished"`, the room just stays in that state until enough players are present.

---

## 💾 Server Data Structures & Helpers

### 1. Room Schema
Each room state object in the internal `Map` holds:
```javascript
{
  hostId: string | null,        // current host socket ID
  players: Map<socketId, { id, name, score, color, token, lastGuessAt? }>,
  joinOrder: string[],          // list of socket IDs in chronological join sequence
  drawerId: string | null,      // socket ID of active drawer
  word: string | null,          // target word (plain text)
  wordLength: number,           // target word length
  status: "waiting" | "in_progress" | "finished",
  roundPhase: "announcement" | "choosing" | "drawing" | null,
  cyclesCompleted: number,      // count of full sequential rotations completed
  announcementCycleNumber: number, // cycle number shown during the announcement overlay
  choosingOptions: string[] | null, // the 3 words currently offered — server-only, never broadcast to guessers
  usedWords: string[],          // words already locked in this game; reset on play again
  shouldResetUsedPoolOnLock: boolean, // true when the used-word pool was nearly exhausted on the last pick
  actionLog: object[],          // ordered drawing action log: { type:'stroke'|'fill'|'clear', ...payload }
                                 // used for late-joiner canvas replay; undo pops the last entry.
  correctGuesses: object[],     // per-round ordered list: { playerId, guessedAt, name }
  roundEndsAt: number | null,   // epoch-ms expiry of current drawing phase (kept for scoring even after the timer is cleared)
  // Round/choosing timer state is managed externally in game/timer.js (keyed by roomId + kind).
  // Room-deletion grace timers are managed externally in game/gracePeriod.js (keyed by roomId).
}
```

Each player record: `{ id, name, score, color, token, lastGuessAt? }` — `token` is an opaque `crypto.randomUUID()` used to re-identify the player across a reconnect; `lastGuessAt` is set on each accepted guess and used for per-player rate limiting.

### 2. State & Rotation Helpers
- **`nextDrawer(room)`** *(in `game/turnOrder.js`)*: Pure function. Finds the next drawer socket ID in sequential order.
- **`reassignHost(room)`** *(in `game/turnOrder.js`)*: Pure function. Transfers host permissions (crown icon) to the next oldest active socket ID in `joinOrder`.
- **`isFirstTurnOfCycle(room, upcomingDrawerId)`** *(in `game/turnOrder.js`)*: Pure function. True when the upcoming drawer is first in join order — gates whether the "Round N" announcement overlay plays.
- **`checkCycleCompleted(room, currentDrawerId)`** *(in `game/scoring.js`)*: Pure function. Checks if the next round wraps back to player index 0, incrementing `room.cyclesCompleted`.
- **`isGameFinished(room)`** *(in `game/scoring.js`)*: Pure function. Returns if `room.cyclesCompleted >= 3`.
- **`computeRoundScores(room, totalRoundDurationMs)`** *(in `game/scoring.js`)*: Rank-based point calculation (100+bonus/80+bonus/60+bonus/50) based on guess order and time remaining, plus drawer points (`min(100, 10 × correctGuesserCount)`). Returns a `scores` array sorted descending, including disconnected correct guessers by their captured name.
- **`assignColor(room)`** *(in `game/rooms.js`)*: Assigns the first unused color from a 12-color palette.
- **`pickWordOptions(usedWords, count = 3)`** *(in `game/words.js`)*: Returns `{ options, shouldResetUsedPool }` — `count` unique words not yet in `usedWords`; if fewer than `count` remain, signals a pool reset and picks from the full list.
- **`endRound(room, roomId, reason)`** *(inner function in `socket/index.js`)*: Consolidated round-ending logic. Cancels timers, computes and applies scores, emits `roundResult`, and sets a 5s timeout to start the next round.

---

## 📂 Modular Structure Specification

The server is decoupled into separate modules separating socket networking from core game state/rules:

1. **`server.js` (Bootstrapper)**:
   - Sets up Express, creates the HTTP server, configures Socket.IO, binds `socket/index.js`, and listens on PORT. Contains no game rules.
2. **`socket/index.js` (Event Coordinator)**:
   - Registers all `socket.on(...)` handlers.
   - Owns round/choosing/announcement orchestration (`startRound`, `startChoosingPhase`, `triggerChoosingPhase`, `lockWordAndStartDrawing`, `endRound`, `finishGame`) and departure handling (`leaveCurrentRoom`, shared by explicit `leaveRoom` and `disconnect`).
   - Coerces all untrusted payload fields via a local `asString(value, fallback)` helper before use — Socket.IO payloads have no shape guarantee.
3. **`game/rooms.js` (Room Registry)**:
   - Holds the `rooms`, `socketRoomMap`, and `tokenRoomMap` Maps.
   - Manages capacity (12 max), player allocations, colors, token generation, and raw data models.
4. **`game/turnOrder.js` (Turn Rotation Engine)**:
   - Pure functions for sequential drawing rotation, host promotion, and cycle-start detection.
5. **`game/scoring.js` (Rules Engine)**:
   - Pure functions that compute multi-guesser point deltas (`computeRoundScores`) and track game cycle progression (`checkCycleCompleted`, `isGameFinished`).
6. **`game/words.js` (Word Repository)**:
   - 240-word bank across 10 categories (animals, food, everyday objects, vehicles, nature, people, sports, places, fantasy, iconic objects) and `pickWordOptions()` for the choosing phase.
7. **`game/timer.js` (Round Timer)**:
   - Owns all per-room countdown timer state (a `Map<"roomId:kind", { handle, endsAt, paused, remainingMs }>`, kinds: `choosing` | `drawing` | `announcement`).
   - `startTimer(roomId, kind, durationSec, onExpire)` — starts/restarts a room's countdown for the given kind.
   - `clearTimer(roomId, kind)` / `clearAllTimers(roomId)` — cancels pending timeout(s).
   - `getEndsAt(roomId, kind = "drawing")` — returns the epoch-ms expiry for a room, sent to clients in `roundStart`/`choosingStarted` payloads.
   - `pauseTimer(roomId, kind)` / `resumeTimer(roomId, kind, onExpire)` — freezes and later restarts the countdown with the saved remaining duration (used across a reconnect).
   - `isTimerPaused(roomId, kind)` — returns if a timer is currently paused.
   - `startRoundTimer` / `clearRoundTimer` — thin aliases kept for the drawing-phase timer specifically; `clearRoundTimer` clears every kind unconditionally.
8. **`game/gracePeriod.js` (Grace Period)**:
   - Manages room deletion delay timers (`Map<roomId, handle>`).
   - `startGrace(roomId, durationSec, onExpire)` — registers a deletion timeout when player count hits zero.
   - `cancelGrace(roomId)` — clears the timeout when a player successfully reconnects/rejoins.
   - `hasGrace(roomId)` — returns if a grace timer is active.
9. **`game/constants.js` (Shared Constants)**:
   - `ROUND_DURATION_SEC = 80` — drawing-phase duration; will become host-configurable in a future settings feature.
   - `CHOOSING_DURATION_SEC = 15` — word-pick duration.
   - `MAX_NAME_LENGTH = 16` — hard cap on player names, enforced regardless of client `maxLength`.
   - `MAX_GUESS_LENGTH = 60` — hard cap on guess/chat text.
   - `MIN_GUESS_INTERVAL_MS = 250` — minimum time between one player's accepted guesses (per-socket, not room-wide).

---

## ⚡ Server Socket Events (Emitted to Clients)

| Event | Payload | When |
| :--- | :--- | :--- |
| `newCycleAnnouncement` | `{ cycleNumber }` | Round announcement phase begins (only on the first turn of a new cycle) |
| `choosingStarted` | `{ drawerId, drawerName, endsAt, options?, cycleNumber }` | Drawer choosing phase begins (`options` sent to the drawer only) |
| `roundStart` | `{ drawerId, drawerName, wordLength, wordHint, endsAt, cycleNumber }` | New round begins (drawing phase) |
| `roundResult` | `{ word, scores }` | A round ends (all eligible guessed, timeout, or drawer left). Shows the 5s points overlay. |
| `gameFinished` | `{ players }` | All cycles completed, or player count dropped below 2 mid-game |
| `playersUpdate` | `{ players, hostId, status, drawerId }` | Any roster change |
| `waitingForPlayers` | `{ count, min, reason? }` | Player count drops below minimum (only when no game was in progress) |
| `hostChanged` | `{ newHostId, newHostName }` | Host disconnects |
| `yourWord` | `{ word }` | Drawer only — secret word |
| `strokeBroadcast` | `{ points: [{x,y}, …], color, width }` | Guessers receive a batch of live drawing points, relayed opaquely |
| `drawAction` | `{ type: 'stroke'\|'fill'\|'clear'\|'undo', ...payload }` | Relays committed drawing actions to other clients |
| `actionReplay` | `{ actions: DrawAction[] }` | Late-joiner / rejoin canvas replay |
| `canvasCleared` | — | Canvas wipe |
| `guessResult` | `{ text?, senderId, senderName, correct, isSystemGuess?, isSelfConfirm? }` | Guess outcome. No `text` when `isSystemGuess`, to prevent word leaks to other guessers. |
| `chatMessage` | `{ text, senderId, senderName, isDrawer }` | Chat from drawer |
| `guessBlocked` | `{ text }` | Drawer tried to type the word |
| `notice` | `{ message }` | Server notice toast |
| `playerJoined` | `{ id, name }` | New player in room |
| `playerLeft` | `{ id, name }` | Player disconnected |
| `joinedRoomSuccess` | `{ roomId, isHost, color, token }` | Room join confirmed (token used for reconnects) |
| `roomNotFound` | `{ message }` | Invalid room code |
| `roomFull` | `{ message }` | Room at capacity |
| `roomClosed` | `{ reason }` | Sent to clients when the room is deleted after its grace period expires (`reason: "empty"`) |

### Client → Server events with server-side handling worth noting

| Event | Notes |
| :--- | :--- |
| `rejoin` | `{ roomId, token }` via ack. Looks up the player by token (not by old socket id), re-keys `players`/`joinOrder`/`hostId`/`drawerId`/`correctGuesses` to the new socket id, cancels any grace timer, resumes paused timers, and acks `{ success: true, token, snapshot }` or `{ error: "ROOM_NOT_FOUND" \| "PLAYER_NOT_FOUND" }`. Ignored entirely if called without an ack callback. |
| `playAgain` | Ack-based: `{ success: true }` or `{ error: "NOT_HOST" \| "INVALID_STATE" \| "NOT_IN_ROOM" }`. |
| `leaveRoom` | Ack-based: always resolves `{ success: true }` once `leaveCurrentRoom` has run. |

There is no `leaving` event. Fast departure detection is done entirely client-side: on `pagehide`, the client calls `socket.disconnect()` directly, which fires the server's ordinary `disconnect` handler immediately instead of waiting on the Socket.IO ping-timeout.

---

## 🔐 Concurrency & Memory Model

1. **Single-Threaded Node Event Loop**:
   - All state modifications to `rooms`, `socketRoomMap`, and `tokenRoomMap` occur synchronously on Node's main loop, preventing race conditions during role assignment or guess validation.

2. **Garbage Collection Pruning**:
   - When a private room's player count drops to zero, the server starts a 60-second grace timer and pauses any active drawing or choosing timers.
   - If a player rejoins via `rejoin` within the window, the grace timer is cancelled and the countdown timers are resumed with their remaining duration.
   - If the 60 seconds elapse with no rejoin, `clearAllTimers(roomId)` cancels any paused timeouts, `roomClosed` is broadcast to remaining sockets, and `rooms.delete(roomId)` executes to free memory.

3. **Socket Room Scoping**:
   - Socket.IO's native `.join(roomId)` and `.to(roomId)` primitives ensure zero cross-talk between isolated rooms.

4. **Timer Safety**:
   - `endRound` calls `clearRoundTimer` (which clears every timer kind) unconditionally before any transition logic, so a correct guess always cancels the running timeout before scheduling the next round. A stray expiry callback after a round has moved on is guarded against by re-checking `room.roundPhase` inside the callback itself.

5. **Untrusted Input**:
   - All socket payload fields are treated as untrusted: `asString(value, fallback)` coerces any non-string field before use, and user-supplied text (names, guesses) is trimmed and hard-capped server-side (`MAX_NAME_LENGTH`, `MAX_GUESS_LENGTH`) regardless of what the client's own input `maxLength` enforced.
