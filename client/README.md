# Scribble — Client

React + TypeScript frontend for the Scribble multiplayer drawing and guessing game.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS v4 |
| Icons | lucide-react |
| Fonts | `@fontsource-variable` JetBrains Mono (body/UI) + Oxanium (headings) |
| Realtime | Socket.IO Client |
| State | React Context + `useReducer` (`GameProvider` / `gameReducer`) |
| Linting | oxlint |

---

## Project Structure

```
client/
├── src/
│   ├── main.tsx                     # React root entry point
│   ├── App.tsx                      # GameProvider wrapper + screen router
│   ├── state/
│   │   ├── gameReducer.ts           # GameState, Action union, pure reducer
│   │   └── GameContext.tsx          # GameProvider, socket listeners, rejoin/token logic, useGame()
│   ├── screens/
│   │   ├── HomeScreen.tsx           # Name input, create/join room
│   │   ├── LobbyScreen.tsx          # Player list, invite link, start game
│   │   ├── GameScreen.tsx           # Single CSS-grid layout: word strip, canvas, player list, chat
│   │   └── EndScreen.tsx            # Podium, scoreboard, play again
│   ├── socket.ts                    # Single shared Socket.IO client instance
│   ├── types.ts                     # Shared TypeScript interfaces (Player, DrawAction, etc.)
│   ├── index.css                    # Global styles, Tailwind imports, .game-grid layout
│   ├── app/
│   │   ├── components/
│   │   │   ├── canvas.tsx                     # Drawing surface: input handling, stroke batching, embeds Toolbar
│   │   │   ├── toolbar.tsx                    # Color palette, pencil/fill tool, brush-size presets, undo, clear
│   │   │   ├── word-strip.tsx                 # Round number + word blanks/letters + Timer
│   │   │   ├── timer.tsx                      # Circular SVG countdown ring
│   │   │   ├── canvas-phase-overlays.tsx      # Dispatches to the right overlay for roundPhase/roundResult
│   │   │   ├── choosing-overlay.tsx           # Word-picker (drawer) / waiting (others) modal
│   │   │   ├── round-announcement-overlay.tsx # "Round N" title card
│   │   │   ├── round-result-overlay.tsx       # 5s post-round word reveal + scores list
│   │   │   ├── player-list.tsx                # Live player roster: scores, avatars, host/drawer/guessed badges
│   │   │   ├── host-badge.tsx                 # Shared "Host" pill (lobby + in-game list)
│   │   │   ├── chat-panel.tsx                 # Chat container (ChatLog + desktop GuessForm)
│   │   │   ├── chat-log.tsx                   # Message log, system events (round start/end, join/leave)
│   │   │   ├── guess-form.tsx                 # Guess/chat input; blocked with feedback for the active drawer
│   │   │   └── mobile-chat-input-row.tsx      # Mobile-only guess input dock, keyboard-aware positioning
│   │   └── lib/
│   │       ├── flood-fill.ts                  # Stack-based tolerance flood fill for the paint-bucket tool
│   │       ├── replay-actions.ts              # Rebuilds the canvas from an ordered DrawAction log (replay + undo)
│   │       └── use-visual-viewport.ts         # Tracks on-screen keyboard height via window.visualViewport
│   └── components/                  # shadcn-style shared UI primitives (button, input, utils) — not
│                                     # used by the game screens, which are custom-styled directly
├── docs/
│   ├── ARCHITECTURE.md              # State flow, drawing engine, responsive layout, socket events
│   └── COMPONENTS.md                # Per-component prop & state reference
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
npm run lint        # Run oxlint
```

---

## Key Features

- **Screen routing** — `home` → `gameLobby` → `game` → `finished`, driven by `state.screen` from `useGame()` (no router library)
- **Shared state** — `GameProvider` + `gameReducer` hold room/game state; screens consume via `useGame()` instead of prop drilling
- **Shareable invite links** — `?room=CODE` query param auto-fills the join flow; URL is cleaned up on leave
- **Sequential drawer rotation** — players draw in join order, cycling for 3 full rounds before game ends
- **Drawing tools** — pencil + fill (paint-bucket), an 11-color palette, 4 discrete brush-size presets, undo (replays the action log with the last entry popped), and clear — all in a `Toolbar` embedded in `Canvas`, shown only to the active drawer during the drawing phase
- **Live-preview stroke batching** — pointer movement is accumulated locally and flushed to the server via `drawStroke` at most once per animation frame (not once per raw event), keeping the network feed smooth without flooding the socket; the fully committed stroke is sent separately, once, via `drawAction`
- **In-round overlays** — announcement ("Round N"), choosing (word picker / waiting), and a 5-second round-result overlay (word reveal + medal-ranked scores), all layered over the canvas via `CanvasPhaseOverlays`
- **Scoring** — Rank-based + time-bonus for correct guessers (+100/80/60/50 base plus up to +50/40/40/0 time-remaining bonus); drawer gets +10 pts per correct guess in their round (up to 100 max)
- **Late-joiner canvas replay** — full action log is replayed on mount so new joiners see the current drawing
- **Reconnection** — a `token` is saved to `sessionStorage` per room and re-sent as `rejoin` on every socket `connect` (including automatic reconnects), hydrating the client from a server-sent room snapshot without a full page reload
- **Join/leave notifications** — system messages in chat when a player enters or exits mid-game
- **Persistent name** — player name saved to `localStorage` and restored on next visit
- **Touch & mouse drawing** — single-finger touch tracking (an accidental second finger doesn't hijack the stroke) and mouse both supported; a tap with no drag still renders as a visible dot
- **Mobile-aware layout** — a single responsive CSS grid (not two parallel component trees) repositions panels between mobile and desktop via one media query; on mobile, the guess input tracks the on-screen keyboard height so it's never hidden behind it

---

## Socket Events (Client-side)

### Emits (Client → Server)

| Event | Payload | When |
|---|---|---|
| `createRoom` | `{ name }` | Host creates a new private room |
| `joinRoom` | `{ roomId, name }` | Player joins via room code or invite link |
| `rejoin` | `{ roomId, token }` (ack) | Sent on every socket `connect` when a saved token exists for the current room — resyncs state after a reconnect |
| `startGame` | — | Host starts the game from lobby |
| `wordChosen` | `{ word }` | Drawer selects a word during choosing phase |
| `drawStroke` | `{ points: [{x,y}, …], color, width }` | Drawer's live-preview stroke batch, flushed at most once per animation frame |
| `drawAction` | `DrawAction` | Drawer commits a drawing action (stroke, fill, clear, or undo) |
| `submitGuess` | `{ text }` | Player submits a guess or chat message |
| `playAgain` | (ack) | Host restarts from the end screen |
| `leaveRoom` | (ack) | Player exits the room |

The client also calls `socket.disconnect()` directly (not a custom event) on the browser's `pagehide` event, so a backgrounded tab or closed window is detected by the server immediately instead of via the heartbeat timeout.

### Listens (Server → Client)

| Event | Effect |
|---|---|
| `connect` | Attempts reconnection recovery by emitting `rejoin` with `{ roomId, token }` loaded from `sessionStorage`, if any |
| `joinedRoomSuccess` | Transitions to lobby, sets room/host state, saves the reconnect `token` to `sessionStorage` |
| `roomNotFound` | Shows inline error on home screen |
| `roomFull` | Shows inline error on home screen |
| `roomClosed` | Clears the saved token, shows a notice, transitions to home |
| `playersUpdate` | Refreshes player list, scores, host, drawer |
| `newCycleAnnouncement` | Phase announcement begins |
| `choosingStarted` | Choosing phase starts (word options to drawer only) |
| `roundStart` | Clears canvas, resets guess state, starts drawing round |
| `yourWord` | Shows the secret word to the active drawer |
| `strokeBroadcast` | Draws the received live-preview point batch on canvas (guessers only) |
| `drawAction` | Relays committed drawing actions (stroke, fill, clear, undo) |
| `actionReplay` | Replays the full action log — used for late joiners and after a reconnect |
| `canvasCleared` | Wipes canvas context |
| `chatMessage` | Appends message to chat log |
| `guessResult` | Appends colored guess outcome (leak-safe for others) to log |
| `guessBlocked` | Notifies drawer they can't type the answer |
| `roundResult` | Shows the word, updated scores, and drives the 5s round-result overlay |
| `gameFinished` | Transitions to end screen with final scores |
| `playerJoined` | Appends join notification to chat |
| `playerLeft` | Appends leave notification to chat |
| `hostChanged` | System crown transfer notice |
| `waitingForPlayers` | Triggers lobby wait when count drops |
| `notice` | Shows toast alert |
