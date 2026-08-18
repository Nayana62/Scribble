# System Architecture

High-level overview of how the Scribble client and server work together. For deeper detail, see `client/docs/` and `server/docs/`.

---

## Stack

| Layer | Technologies |
|---|---|
| Client | React 19, TypeScript, Vite, Tailwind CSS v4, Socket.IO Client |
| Server | Node.js, Express, Socket.IO, dotenv |

---

## Repository Layout

```text
scribble/
├── client/                  # React frontend
│   ├── src/
│   │   ├── App.tsx          # Screen router (reads state.screen only)
│   │   ├── state/
│   │   │   ├── gameReducer.ts   # GameState, Action types, pure reducer
│   │   │   └── GameContext.tsx  # GameProvider, socket listeners, useGame()
│   │   ├── screens/         # HomeScreen, LobbyScreen, GameScreen, EndScreen
│   │   ├── app/components/  # Canvas, PlayerList, ChatPanel, GuessForm
│   │   ├── socket.ts        # Socket.IO client singleton
│   │   └── types.ts         # Shared TypeScript types
│   └── docs/
├── server/                  # Node.js backend
│   ├── server.js            # HTTP + Socket.IO bootstrap
│   ├── socket/index.js      # Event handlers (thin coordination layer)
│   ├── game/                # rooms, turnOrder, scoring, words
│   └── docs/
└── docs/                    # Project-level docs (this folder)
```

---

## Client Flow

```
main.tsx → App.tsx (GameProvider + screen router)
              ├── HomeScreen        name, create/join room (local UI state)
              ├── LobbyScreen       player list, start game
              ├── GameScreen        canvas + player list + chat
              └── EndScreen         podium, scoreboard, play again

GameContext.tsx — socket.on/off listeners dispatch actions to gameReducer
Screens call useGame() for shared state; screen-local UI state stays in useState
```

Screen state: `home` → `gameLobby` → `game` → `finished`

---

## Server Room Lifecycle

```
Room created (status: "waiting")
        │
  Host starts (≥ 2 players)
        │
  status: "in_progress" — pick drawer, assign word, clear stroke history
        │
  Correct guess / drawer leaves / timeout
        │
  roundEnd (2.5s pause) → next round
        │
  cyclesCompleted >= 3
        │
  status: "finished" → gameFinished → playAgain or leaveRoom
```

If players drop below 2 mid-game, status returns to `"waiting"` and clients go back to the lobby.

---

## Room State (Server)

Each room is stored in an in-memory `Map`:

```javascript
{
  hostId, players, joinOrder,
  drawerId, word, wordLength,
  status: "waiting" | "in_progress" | "finished",
  cyclesCompleted,
  strokeHistory,   // replayed for late joiners
  roundTimer,
}
```

---

## Key Socket Events

### Client → Server

| Event | Purpose |
|---|---|
| `createRoom` | Create private room |
| `joinRoom` | Join by room code |
| `startGame` | Host starts from lobby |
| `drawStroke` | Drawer sends stroke coordinates |
| `clearCanvasRequest` | Drawer clears canvas |
| `submitGuess` | Chat message or guess |
| `playAgain` | Reset scores, return to lobby |
| `leaveRoom` | Exit room |

### Server → Client

| Event | Purpose |
|---|---|
| `joinedRoomSuccess` | Confirmed room entry |
| `playersUpdate` | Live roster, scores, host, drawer |
| `roundStart` | New round begins |
| `yourWord` | Secret word (drawer only) |
| `strokeBroadcast` / `strokeReplay` | Live strokes / late-joiner replay |
| `canvasCleared` | Clear drawing board |
| `chatMessage` / `guessResult` | Chat log entries |
| `guessBlocked` | Drawer tried to reveal word |
| `roundEnd` | Round winner announcement |
| `gameFinished` | Final scores, go to end screen |
| `waitingForPlayers` | Paused — need more players |
| `hostChanged` / `notice` / `playerLeft` | System notifications |

Full event matrices with payloads are documented in `client/docs/ARCHITECTURE.md` and `server/README.md`.

---

## Scoring & Game End

- **+50 pts** — player who guesses correctly
- **+20 pts** — drawer when someone guesses their word
- **Game ends** after 3 full cycles (every player has drawn 3 times)
- **Podium** — players grouped by score on the end screen; ties share a rank
