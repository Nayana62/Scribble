# Scribble — Client

React + TypeScript frontend for the Scribble multiplayer drawing and guessing game.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS v4 |
| Realtime | Socket.IO Client |
| State | React Context + `useReducer` (`GameProvider` / `gameReducer`) |

---

## Project Structure

```
client/
├── src/
│   ├── main.tsx                     # React root entry point
│   ├── App.tsx                      # GameProvider wrapper + screen router
│   ├── state/
│   │   ├── gameReducer.ts           # GameState, Action union, pure reducer
│   │   └── GameContext.tsx          # GameProvider, socket listeners, useGame()
│   ├── screens/
│   │   ├── HomeScreen.tsx           # Name input, create/join room
│   │   ├── LobbyScreen.tsx          # Player list, invite link, start game
│   │   ├── GameScreen.tsx           # Canvas + player list + chat layout
│   │   └── EndScreen.tsx            # Podium, scoreboard, play again
│   ├── socket.ts                    # Single shared Socket.IO client instance
│   ├── types.ts                     # Shared TypeScript interfaces (Player, etc.)
│   ├── index.css                    # Global styles & Tailwind imports
│   └── app/components/
│       ├── canvas.tsx               # HTML5 canvas — drawing, stroke broadcast, replay for late joiners
│       ├── player-list.tsx          # Live player roster with scores, host crown, drawer badge
│       ├── chat-panel.tsx           # Chat container (wraps ChatLog + GuessForm)
│       ├── chat-log.tsx             # Message log, system events (round start/end, join/leave)
│       └── guess-form.tsx           # Guess input; blocked with feedback for the active drawer
├── docs/
│   ├── ARCHITECTURE.md              # Socket event flow, screen lifecycle, state map
│   └── COMPONENTS.md               # Per-component prop & state reference
├── .env.local                       # Local environment variables (git-ignored)
├── .env.example                     # Template — copy to .env.local
└── index.html
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and set:

```env
VITE_SERVER_URL=http://localhost:3000   # Backend Socket.IO server URL
VITE_CLIENT_URL=http://localhost:5173   # Public URL of this client (used for invite links)
```

On deployment, set these as environment variables in your hosting platform.

---

## Getting Started

```bash
npm install
npm run dev        # Dev server at http://localhost:5173
```

```bash
npm run build      # Production bundle → dist/
npm run preview    # Preview the production build locally
```

---

## Key Features

- **Screen routing** — `home` → `gameLobby` → `game` → `finished`, driven by `state.screen` from `useGame()` (no router library)
- **Shared state** — `GameProvider` + `gameReducer` hold room/game state; screens consume via `useGame()` instead of prop drilling
- **Shareable invite links** — `?room=CODE` query param auto-fills the join flow; URL is cleaned up on leave
- **Sequential drawer rotation** — players draw in join order, cycling for 3 full rounds before game ends
- **Scoring** — Rank-based + time-bonus for correct guessers (+100/80/60/50 base plus up to +50/40/40/0 time-remaining bonus); drawer gets +10 pts per correct guess in their round (up to 100 max)
- **Late-joiner canvas replay** — full action log is replayed on mount so new joiners see the current drawing
- **Join/leave notifications** — system messages in chat when a player enters or exits mid-game
- **Persistent name** — player name saved to `localStorage` and restored on next visit
- **Touch & mouse drawing** — canvas works on both desktop and mobile

---

## Socket Events (Client-side)

### Emits (Client → Server)

| Event | Payload | When |
|---|---|---|
| `createRoom` | `{ name }` | Host creates a new private room |
| `joinRoom` | `{ roomId, name }` | Player joins via room code or invite link |
| `startGame` | — | Host starts the game from lobby |
| `wordChosen` | `{ word }` | Drawer selects a word during choosing phase |
| `drawStroke` | `{ prevX, prevY, x, y, color, width }` | Drawer sends live stroke segment (mousemove) |
| `drawAction` | `DrawAction` | Drawer commits drawing action (stroke, fill, clear, undo) |
| `submitGuess` | `{ text }` | Player submits a guess or chat message |
| `playAgain` | — | Host restarts from the end screen |
| `leaveRoom` | — | Player exits the room |

### Listens (Server → Client)

| Event | Effect |
|---|---|
| `joinedRoomSuccess` | Transitions to lobby, sets room/host state |
| `roomNotFound` | Shows inline error on home screen |
| `roomFull` | Shows inline error on home screen |
| `playersUpdate` | Refreshes player list, scores, host, drawer |
| `newCycleAnnouncement` | Phase announcement begins |
| `choosingStarted` | Choosing phase starts (word options to drawer only) |
| `roundStart` | Clears canvas, resets guess state, starts drawing round |
| `yourWord` | Shows the secret word to the active drawer |
| `strokeBroadcast` | Draws received segment on canvas (guessers only) |
| `drawAction` | Relays committed drawing actions |
| `actionReplay` | Replays action log for late joiners |
| `canvasCleared` | Wipes canvas context |
| `chatMessage` | Appends message to chat log |
| `guessResult` | Appends colored guess outcome (leak-safe for others) to log |
| `guessBlocked` | Notifies drawer they can't type the answer |
| `roundResult` | Shows points earned, updated scores, and correct word (replaces `roundEnd`) |
| `gameFinished` | Transitions to end screen with final scores |
| `playerJoined` | Appends join notification to chat |
| `playerLeft` | Appends leave notification to chat |
| `hostChanged` | System crown transfer notice |
| `waitingForPlayers` | Triggers lobby wait when count drops |
| `notice` | Shows toast alert |
