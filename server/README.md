# Scribble — Server

Node.js + Socket.IO backend for the Scribble multiplayer drawing and guessing game. Manages room state, game lifecycle, turn rotation, scoring, and real-time event broadcasting.

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
│   ├── rooms.js           # rooms Map, socketRoomMap, player state, color assignment
│   ├── turnOrder.js       # nextDrawer(), reassignHost() — pure rotation helpers
│   ├── scoring.js         # awardPoints(), checkCycleCompleted(), isGameFinished()
│   └── words.js           # Word list + pickWord()
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
- **Round length** — 3 full cycles (every player draws once = 1 cycle); game ends after cycle 3
- **Scoring** — correct guesser gets rank-based base points (100/80/60/50) + time-remaining bonus (up to 50/40/40/0); drawer gets +10 pts per correct guess in their round (up to 100 max)
- **One guess per round** — once a player guesses correctly they can still chat but can't guess again
- **Late joiners** — appended to turn order and included in ongoing cycles; action log replayed on join
- **Host transfer** — if host disconnects, oldest remaining player becomes host
- **Drawer disconnection** — round ends immediately, next round starts
- **Empty room cleanup** — room is deleted from memory when last player leaves

---

## Socket Events Reference

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `createRoom` | `{ name }` | Creates a new private room, emits back `joinedRoomSuccess` |
| `joinRoom` | `{ roomId, name }` | Joins existing room by code; validates capacity and existence |
| `startGame` | — | Host-only; starts first round if ≥ 2 players |
| `wordChosen` | `{ word }` | Drawer-only; picks secret word to start drawing |
| `drawStroke` | `{ prevX, prevY, x, y, color, width }` | Relayed to all room members except sender for live rendering |
| `drawAction` | `DrawAction` | Committed drawing action (stroke, fill, clear, undo); appended to `actionLog` |
| `submitGuess` | `{ text }` | Evaluates guess/chat; awards points, notifies players, and handles drawer block |
| `playAgain` | — | Host-only; resets scores and cycles, returns room to lobby |
| `leaveRoom` | — | Explicit leave; also fired on disconnect |

### Server → Client

| Event | Target | Payload | Description |
|---|---|---|---|
| `joinedRoomSuccess` | Sender | `{ roomId, isHost, color }` | Room join confirmed |
| `roomNotFound` | Sender | `{ message }` | Invalid room code |
| `roomFull` | Sender | `{ message }` | Room at 12-player capacity |
| `playersUpdate` | Room | `{ players, hostId, status, drawerId }` | Sent on any roster or game status change |
| `newCycleAnnouncement` | Room | `{ cycleNumber }` | Round announcement overlay phase |
| `choosingStarted` | Room | `{ drawerId, drawerName, endsAt, options?, cycleNumber }` | Choosing phase begins (options sent to drawer only) |
| `roundStart` | Room | `{ drawerId, drawerName, wordLength, wordHint, endsAt, cycleNumber }` | New round begins (drawing phase) |
| `yourWord` | Drawer only | `{ word }` | Secret word delivered to drawer |
| `strokeBroadcast` | Room (excl. sender) | `{ prevX, prevY, x, y, color, width }` | Live stroke segment relay |
| `drawAction` | Room (excl. sender) | `DrawAction` | Relay committed drawing actions |
| `actionReplay` | Sender | `{ actions: DrawAction[] }` | Late-joiner canvas actionLog replay |
| `canvasCleared` | Room | — | Clear canvas signal |
| `chatMessage` | Room | `{ text, senderId, senderName, isDrawer }` | Regular chat message |
| `guessResult` | Room | `{ text?, senderId, senderName, correct, isSystemGuess?, isSelfConfirm? }` | Guess outcome (safely styled, word concealed for others) |
| `guessBlocked` | Drawer only | `{ text }` | Drawer attempted to type the secret word |
| `roundResult` | Room | `{ word, scores }` | Round over; carries points earned and updated scores (replaces `roundEnd`) |
| `gameFinished` | Room | `{ players }` | All 3 cycles done; final scoreboard |
| `playerJoined` | Room | `{ id, name }` | Player joined mid-game notification |
| `playerLeft` | Room | `{ id, name }` | Player left mid-game notification |
| `waitingForPlayers` | Room | `{ count, min, reason? }` | Pauses game to lobby when player count drops |
| `hostChanged` | Room | `{ newHostId, newHostName }` | Notification of crown transfer |
| `notice` | Sender | `{ message }` | System toast feedback |

---

## Module Responsibilities

| Module | Owns |
|---|---|
| `server.js` | Express + HTTP + Socket.IO bootstrap only. No game logic. |
| `socket/index.js` | Event registration and emission. Thin coordination layer — no state mutation. |
| `game/rooms.js` | `rooms` and `socketRoomMap` state. Player creation, color assignment, room init/cleanup. |
| `game/turnOrder.js` | Pure functions for drawer rotation and host reassignment. |
| `game/scoring.js` | Pure functions for point allocation, cycle counting, and game-over detection. |
| `game/words.js` | Word bank and random word selection. |
