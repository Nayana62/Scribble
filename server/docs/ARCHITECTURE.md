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
                   │  - Pick Word & Clear strokeHistory      │
                   │  - Broadcast `roundStart` & `yourWord`  │
                   └────────────────────┬────────────────────┘
                                        │
                  Correct Guess / Timeout / Drawer Left
                                        │
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │            Broadcast `roundEnd`         │
                   │         (2.5 Second Delay Timer)        │
                   └────────────────────┬────────────────────┘
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
  players: Map<socketId, { id, name, score, color }>,
  joinOrder: string[],          // list of socket IDs in chronological join sequence
  drawerId: string | null,      // socket ID of active drawer
  word: string | null,          // target word (plain text)
  wordLength: number,           // target word length
  status: "waiting" | "in_progress" | "finished",
  cyclesCompleted: number,      // count of full sequential rotations completed
  strokeHistory: object[],      // array of drawings to replay for late joiners
  roundTimer: Timeout | null,
}
```

### 2. State & Rotation Helpers
- **`nextDrawer(room)`** *(in `game/turnOrder.js`)*: Pure function. Finds the next drawer socket ID in sequential order.
- **`reassignHost(room)`** *(in `game/turnOrder.js`)*: Pure function. Transfers host permissions (crown icon) to the next oldest active socket ID in `joinOrder`.
- **`checkCycleCompleted(room, currentDrawerId)`** *(in `game/scoring.js`)*: Pure function. Checks if the next round wraps back to player index 0, incrementing `room.cyclesCompleted`.
- **`isGameFinished(room)`** *(in `game/scoring.js`)*: Pure function. Returns if `room.cyclesCompleted >= 3`.
- **`awardPoints(room, guesserId)`** *(in `game/scoring.js`)*: Pure function. Increments scores (+50 guesser, +20 drawer).
- **`assignColor(room)`** *(in `game/rooms.js`)*: Cycles through a 12-color palette to assign next player color.
- **`pickWord()`** *(in `game/words.js`)*: Selects a random word.

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
   - Pure functions that process scores (+50 for guesser, +20 for drawer), track cyclesCompleted, and decide game termination.
6. **`game/words.js` (Word Repository)**:
   - Word lists and random pick queries.

---

## 🔐 Concurrency & Memory Model

1. **Single-Threaded Node Event Loop**:
   - All state modifications to `rooms` and `socketRoomMap` occur synchronously on Node's main loop, preventing race conditions during role assignment or guess validation.

2. **Garbage Collection Pruning**:
   - When a private room's player count drops to zero, `clearTimeout` is called on any scheduled round transition timers, and `rooms.delete(roomId)` executes to prevent memory leaks.

3. **Socket Room Scoping**:
   - Socket.IO's native `.join(roomId)` and `.to(roomId)` primitives ensure zero cross-talk between isolated rooms.
