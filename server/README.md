# Scribble — Server

Node.js + Socket.IO backend for the Scribble multiplayer drawing and guessing game. Manages room state, game lifecycle, turn rotation, scoring, reconnection, and real-time event broadcasting.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| HTTP | Express |
| Realtime | Socket.IO |
| Config | dotenv |

---

## Project Structure

```
server/
├── server.js              # Entry point — creates HTTP server, configures Socket.IO, boots app
├── socket/
│   └── index.js           # Registers all socket.on() handlers; delegates to game/ modules
├── game/
│   ├── rooms.js            # rooms Map, socketRoomMap, tokenRoomMap, player state, color assignment
│   ├── turnOrder.js         # nextDrawer(), reassignHost(), isFirstTurnOfCycle() — pure rotation helpers
│   ├── scoring.js           # computeRoundScores(), checkCycleCompleted(), isGameFinished()
│   ├── words.js             # Word list (240 words) + pickWordOptions()
│   ├── timer.js             # Per-room choosing/drawing countdown timers (pause/resume for reconnects)
│   ├── gracePeriod.js       # Room-deletion grace timers (60s window after last player leaves)
│   └── constants.js         # ROUND_DURATION_SEC, CHOOSING_DURATION_SEC, length caps, rate limit
├── docs/
│   └── ARCHITECTURE.md    # Room state machine, data schemas, module responsibilities
├── .env                   # Local environment variables (git-ignored)
├── .env.example           # Template — copy to .env
└── package.json
```

---

## Environment Variables

Copy `.env.example` to `.env` and set:

```env
PORT=3000                             # Port the server listens on
CLIENT_ORIGIN=http://localhost:5173   # Client URL allowed by CORS
```

On deployment, set these as environment variables in your hosting platform.

---

## Getting Started

```bash
npm install
npm run dev        # Start with nodemon (auto-restart on file changes)
node server.js     # Start directly with Node
```

Server listens on `http://localhost:3000` by default.

---

## Game Rules Implemented

- **Room capacity** — max 12 players per room
- **Minimum to start** — 2 players required
- **Turn order** — players draw in the order they joined; rotation is sequential
- **Round structure** — each turn: a ~2s "Round N" announcement (only at the start of a new cycle) → 15s choosing phase (drawer picks 1 of 3 words, auto-picked at random on timeout) → 80s drawing phase
- **Round length** — 3 full cycles (every player draws once = 1 cycle); game ends after cycle 3
- **Scoring** — correct guesser gets rank-based base points (100/80/60/50) + time-remaining bonus (up to 50/40/40/0); drawer gets +10 pts per correct guess in their round (up to 100 max)
- **One guess per round** — once a player guesses correctly they can still chat but can't guess again; a round ends early once every eligible (non-drawer, connected) player has guessed
- **Fair-play limits** — player names capped at 16 chars, guesses/chat capped at 60 chars, and guesses rate-limited to 1 accepted submission per 250ms per player — all enforced server-side regardless of what the client sends
- **Late joiners** — appended to turn order and included in ongoing cycles; full action log replayed on join
- **Host transfer** — if host disconnects, the oldest remaining player becomes host
- **Drawer disconnection** — round ends immediately (already-earned guesser points are kept), next round starts
- **Reconnection** — each player holds an opaque token; disconnecting doesn't remove them from the game immediately — a 60s grace period (room-wide) and per-round timer pause/resume let a dropped player rejoin their seat seamlessly
- **Empty room cleanup** — after the 60s grace period with no reconnect, the room is deleted from memory and a `roomClosed` event notifies any sockets still attached

---

## Socket Events Reference

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `createRoom` | `{ name }` | Creates a new private room, emits back `joinedRoomSuccess` (includes reconnect `token`) |
| `joinRoom` | `{ roomId, name }` | Joins existing room by code; validates capacity and existence |
| `rejoin` | `{ roomId, token }` (ack) | Reconnects using a saved token — re-associates the new `socket.id` with the existing player record and returns `{ success, token, snapshot }` or `{ error: "ROOM_NOT_FOUND" \| "PLAYER_NOT_FOUND" }` |
| `startGame` | — | Host-only; starts first round if ≥ 2 players |
| `wordChosen` | `{ word }` | Drawer-only; picks secret word to start drawing |
| `drawStroke` | `{ points: [{x,y}, …], color, width }` | Live-preview stroke batch, relayed to all room members except sender for real-time rendering. Not persisted — the server relays it opaquely without inspecting its shape. |
| `drawAction` | `DrawAction` (`stroke` \| `fill` \| `clear` \| `undo`) | Committed drawing action; appended to (or, for `undo`, popped from) `actionLog` |
| `submitGuess` | `{ text }` | Evaluates guess/chat; awards points, notifies players, handles drawer block. Server-side length cap (60 chars) and per-player rate limit (250ms) applied regardless of client input. |
| `playAgain` | (ack) | Host-only; resets scores and cycles, returns room to lobby. Returns `{ success: true }` or `{ error: "NOT_HOST" \| "INVALID_STATE" \| "NOT_IN_ROOM" }`. |
| `leaveRoom` | (ack) | Explicit leave; also triggered implicitly via `disconnect` (the client calls `socket.disconnect()` on `pagehide` for near-instant departure detection instead of waiting on the heartbeat timeout) |

### Server → Client

| Event | Target | Payload | Description |
|---|---|---|---|
| `joinedRoomSuccess` | Sender | `{ roomId, isHost, color, token }` | Room join confirmed |
| `roomNotFound` | Sender | `{ message }` | Invalid room code |
| `roomFull` | Sender | `{ message }` | Room at 12-player capacity |
| `playersUpdate` | Room | `{ players, hostId, status, drawerId }` | Sent on any roster or game status change |
| `newCycleAnnouncement` | Room | `{ cycleNumber }` | Round announcement overlay phase |
| `choosingStarted` | Room | `{ drawerId, drawerName, endsAt, options?, cycleNumber }` | Choosing phase begins (options sent to drawer only) |
| `roundStart` | Room | `{ drawerId, drawerName, wordLength, wordHint, endsAt, cycleNumber }` | New round begins (drawing phase) |
| `yourWord` | Drawer only | `{ word }` | Secret word delivered to drawer |
| `strokeBroadcast` | Room (excl. sender) | `{ points, color, width }` | Live-preview stroke batch relay |
| `drawAction` | Room (excl. sender) | `DrawAction` | Relay committed drawing actions |
| `actionReplay` | Sender | `{ actions: DrawAction[] }` | Late-joiner / rejoin canvas `actionLog` replay |
| `canvasCleared` | Room | — | Clear canvas signal |
| `chatMessage` | Room | `{ text, senderId, senderName, isDrawer }` | Regular chat message |
| `guessResult` | Room | `{ text?, senderId, senderName, correct, isSystemGuess?, isSelfConfirm? }` | Guess outcome (word concealed from everyone but the guesser and drawer) |
| `guessBlocked` | Drawer only | `{ text }` | Drawer attempted to type the secret word |
| `roundResult` | Room | `{ word, scores }` | Round over; carries points earned per player and the revealed word |
| `gameFinished` | Room | `{ players }` | All 3 cycles done; final scoreboard |
| `playerJoined` | Room | `{ id, name }` | Player joined mid-game notification |
| `playerLeft` | Room | `{ id, name }` | Player left mid-game notification |
| `waitingForPlayers` | Room | `{ count, min, reason? }` | Pauses game to lobby when player count drops |
| `hostChanged` | Room | `{ newHostId, newHostName }` | Notification of crown transfer |
| `roomClosed` | Room | `{ reason }` | Room deleted after the 60s grace period elapsed with no reconnect |
| `notice` | Sender | `{ message }` | System toast feedback |

---

## Module Responsibilities

| Module | Owns |
|---|---|
| `server.js` | Express + HTTP + Socket.IO bootstrap only. No game logic. |
| `socket/index.js` | Event registration and emission — room lifecycle orchestration (round/choosing/announcement flow, scoring application, disconnect/rejoin handling). |
| `game/rooms.js` | `rooms`, `socketRoomMap`, and `tokenRoomMap` state. Player creation, color assignment, room init. |
| `game/turnOrder.js` | Pure functions for drawer rotation, host reassignment, and cycle-start detection. |
| `game/scoring.js` | Pure functions that compute multi-guesser point deltas and track game cycle progression. |
| `game/words.js` | Word bank (240 words across 10 categories) and `pickWordOptions()` — 3 unique unused words per choosing phase, with automatic used-pool reset when nearly exhausted. |
| `game/timer.js` | Per-room `choosing`/`drawing` countdown timers, including pause/resume for reconnect scenarios. |
| `game/gracePeriod.js` | Room-deletion grace timers — delays cleanup 60s after the last player leaves, cancelled on reconnect. |
| `game/constants.js` | Shared tunables: `ROUND_DURATION_SEC` (80), `CHOOSING_DURATION_SEC` (15), `MAX_NAME_LENGTH` (16), `MAX_GUESS_LENGTH` (60), `MIN_GUESS_INTERVAL_MS` (250). |
