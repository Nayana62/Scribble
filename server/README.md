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
- **Scoring** — correct guesser: +50 pts; drawer: +20 pts per correct guess in their round
- **One guess per round** — once a player guesses correctly they can still chat but can't guess again
- **Late joiners** — appended to turn order and included in ongoing cycles; stroke history replayed on join
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
| `drawStroke` | `{ prevX, prevY, x, y, color, lineWidth }` | Relayed to all room members except sender; stored in `strokeHistory` |
| `clearCanvasRequest` | — | Broadcasts `canvasCleared` to room; clears `strokeHistory` |
| `submitGuess` | `{ text }` | Evaluates guess; awards points and triggers round end on correct match |
| `playAgain` | — | Host-only; resets scores and cycles, returns room to lobby |
| `leaveRoom` | — | Explicit leave; also fired on disconnect |

### Server → Client

| Event | Target | Payload | Description |
|---|---|---|---|
| `joinedRoomSuccess` | Sender | `{ roomId, isHost, players, hostId, strokeHistory }` | Room join confirmed |
| `roomNotFound` | Sender | `{ message }` | Invalid room code |
| `roomFull` | Sender | `{ message }` | Room at 12-player capacity |
| `playersUpdate` | Room | `{ players, hostId, drawerId, status }` | Sent on any roster change |
| `roundStart` | Room | `{ drawerId, drawerName, wordLength }` | New round begins |
| `yourWord` | Drawer only | `{ word }` | Secret word delivered to drawer |
| `strokeBroadcast` | Room (excl. sender) | `{ prevX, prevY, x, y, color, lineWidth }` | Live stroke relay |
| `canvasCleared` | Room | — | Clear canvas signal |
| `chatMessage` | Room | `{ text, senderId, senderName }` | Regular chat message |
| `guessResult` | Room | `{ text, senderId, senderName, correct }` | Guess outcome broadcast |
| `guessBlocked` | Drawer only | `{ text }` | Drawer attempted to type the secret word |
| `roundEnd` | Room | `{ correctWord, scores }` | Round over; shows word and updated scores |
| `gameFinished` | Room | `{ players }` | All 3 cycles done; final sorted scoreboard |
| `playerJoined` | Room | `{ id, name }` | Player joined mid-game notification |
| `playerLeft` | Room | `{ id, name }` | Player left mid-game notification |
| `notice` | Sender | `{ message }` | System toast (e.g. already guessed, not your turn) |

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
