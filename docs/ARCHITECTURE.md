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
  status: "in_progress" (new round / cycle start)
        │
  [isNewCycle === true]
  Phase: "announcement" (3s cycle overlay)
        │
  Phase: "choosing" (15s drawer picks word from 3 options)
        │
  Phase: "drawing" (80s active draw & guess timer, actionLog cleared)
        │
  Correct guess / drawer leaves / timeout
        │
  roundResult (5s pause overlay)
        │
  cyclesCompleted >= 3  ──[Yes]──► status: "finished" → gameFinished
        │ [No]
        ▼
  Start Next Round
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
  roundPhase: "announcement" | "choosing" | "drawing" | null,
  cyclesCompleted,
  actionLog,       // replayed for late joiners (DrawAction[])
  correctGuesses,  // per-round list of correct guessers
  roundEndsAt,     // epoch-ms expiry of draw timer
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
| `wordChosen` | Drawer selects a word during choosing phase |
| `drawStroke` | Drawer broadcasts live coordinate segment |
| `drawAction` | Drawer commits drawing action (stroke, fill, clear, or undo) |
| `submitGuess` | Chat message or guess submission |
| `playAgain` | Host resets scores and cycles, returns to lobby |
| `leaveRoom` | Exit room |

### Server → Client

| Event | Purpose |
|---|---|
| `joinedRoomSuccess` | Confirmed room entry |
| `playersUpdate` | Live roster, scores, host, drawer |
| `newCycleAnnouncement` | Phase announcement begins |
| `choosingStarted` | Choosing phase starts (word options to drawer only) |
| `roundStart` | Drawing phase begins (carrying `endsAt`, hints) |
| `yourWord` | Secret word (drawer only) |
| `strokeBroadcast` | Live mousemove segment broadcast |
| `drawAction` | Relay drawing actions (stroke, fill, clear, undo) |
| `actionReplay` | Late-joiner action log replay |
| `canvasCleared` | Clear drawing board |
| `chatMessage` / `guessResult` | Chat/guess log entries (guess outcomes are system-notified safely) |
| `guessBlocked` | Drawer tried to reveal word |
| `roundResult` | Round over; carries points earned and word (replaces `roundEnd`) |
| `gameFinished` | Final scores, go to end screen |
| `waitingForPlayers` | Paused — need more players |
| `hostChanged` / `notice` / `playerLeft` / `playerJoined` | System notifications & toasts |

Full event matrices with payloads are documented in `client/docs/ARCHITECTURE.md` and `server/docs/ARCHITECTURE.md`.

---

## Scoring & Game End

- **Correct Guesser Scoring**:
  - Rank-based base points: **100** for 1st, **80** for 2nd, **60** for 3rd, and **50** for 4th+.
  - Time-remaining bonus: up to **+50** for 1st, **+40** for 2nd, **+40** for 3rd, and **0** for 4th+.
  - Total Points = `base + Math.round(maxBonus * (timeRemaining / duration))`
- **Drawer Scoring**:
  - **+10 pts** per player who guesses correctly in their round (up to **100** max).
- **Game ends** after 3 full cycles (every player has drawn 3 times).
- **Podium** — players grouped by score on the end screen; ties share a rank.
