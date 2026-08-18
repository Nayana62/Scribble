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
- **Scoring** — correct guesser +50 pts, drawer +20 pts per successful guess
- **Late-joiner canvas replay** — stroke history is replayed on mount so new joiners see what was drawn
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
| `drawStroke` | `{ prevX, prevY, x, y, color, lineWidth }` | Drawer sends each stroke segment |
| `clearCanvasRequest` | — | Drawer clears the canvas |
| `submitGuess` | `{ text }` | Player submits a guess |
| `playAgain` | — | Host restarts from the end screen |
| `leaveRoom` | — | Player exits the room |

### Listens (Server → Client)

| Event | Effect |
|---|---|
| `joinedRoomSuccess` | Transitions to lobby, sets room/host state |
| `roomNotFound` | Shows inline error on home screen |
| `playersUpdate` | Refreshes player list, scores, host, drawer |
| `roundStart` | Clears canvas, resets guess state, shows new drawer |
| `yourWord` | Shows the secret word to the active drawer |
| `strokeBroadcast` | Draws received stroke on canvas (guessers only) |
| `canvasCleared` | Wipes canvas context |
| `chatMessage` | Appends message to chat log |
| `guessResult` | Appends colored correct/incorrect guess to log |
| `guessBlocked` | Notifies drawer they can't type the answer |
| `roundEnd` | Shows correct word toast and round summary |
| `gameFinished` | Transitions to end screen with final scores |
| `playerJoined` | Appends join notification to chat |
| `playerLeft` | Appends leave notification to chat |
| `notice` | Shows toast alert |
