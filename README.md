# Scribble

A real-time multiplayer drawing and guessing game. One player draws a secret word on a shared canvas while everyone else tries to guess it in chat — like skribbl.io in your own private room.

---

## Features

### Rooms & Social

- Create private rooms with short room codes
- Share invite links (`?room=CODE`) — friends land directly in the join flow
- Up to 12 players per room; 2 players minimum to play
- Host starts the game; Host badge transfers automatically if host disconnects
- Player names persist in `localStorage` between visits
- Automatic reconnect — a dropped connection (backgrounded tab, brief network blip) rejoins the same room/seat via a saved token, with a 60s grace period before an empty room is cleaned up

### Drawing & Guessing

- Real-time canvas with mouse and touch drawing, batched over the network (throttled to once per animation frame) for smooth live previews without flooding the socket
- Drawing toolbar (drawer only): pencil + fill (paint-bucket) tools, an 11-color palette, 4 discrete brush-size presets, undo, and clear
- Sequential turn rotation — everyone draws in join order
- Drawer chooses a secret word from 3 options (15s to pick; auto-picked if time runs out)
- Drawer cannot type the secret word in chat (guess blocking)
- Guesses and chat messages are rate-limited and length-capped per player to keep the game fair
- Late joiners see the full drawing replayed so they're never looking at a blank canvas

### Game Flow

- Round announcement overlay at the start of each new cycle, then the drawer's choosing phase, then the live drawing round
- **3 full cycles** — each player draws 3 times before the game ends
- **Scoring** — Rank-based + time-bonus for correct guessers (+100/80/60/50 base plus up to +50/40/40/0 time-remaining bonus); drawer gets +10 pts per correct guess in their round (up to 100 max)
- 5-second round-result overlay revealing the word and every player's points earned that round
- End screen with podium (top 3, ties supported) and full scoreboard
- Play again returns everyone to the lobby with reset scores

### UI

- Four screens: Home → Lobby → Game → End
- Single responsive CSS grid layout — word strip + canvas stacked above players/chat on mobile, a 3-column players / canvas / chat layout on desktop
- Color-coded player avatars and chat names
- Live player list with host badge, drawer badge, and correct-guess checkmarks
- Chat log with guesses, system messages, and join/leave notifications
- Mobile guess input bar that tracks the on-screen keyboard so it's never hidden behind it

---

## Tech Stack

|          | Client                          | Server               |
| -------- | -------------------------------- | -------------------- |
| Runtime  | React 19 + TypeScript           | Node.js               |
| Build    | Vite + Tailwind CSS v4          | —                     |
| Realtime | Socket.IO Client                | Socket.IO + Express   |
| State    | React Context + `useReducer` (`GameProvider`) | In-memory room `Map` |
| Linting  | oxlint                          | —                     |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Two terminals (client and server run separately)

### 1. Server

```bash
cd server
cp .env.example .env        # if .env doesn't exist
npm install
npm run dev                 # http://localhost:3000
```

**`.env`**

```env
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
```

### 2. Client

```bash
cd client
cp .env.example .env.local  # if .env.local doesn't exist
npm install
npm run dev                 # http://localhost:5173
```

**`.env.local`**

```env
VITE_SERVER_URL=http://localhost:3000
VITE_CLIENT_URL=http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173), enter a name, create a room, and share the invite link with friends. Open a second tab (or use another device on the same network) to try it as a second player — you need at least 2 to start a game.

---

## Project Structure

```text
scribble/
├── client/          React frontend (Vite)
├── server/          Node.js + Socket.IO backend
└── docs/            Project-level documentation
    ├── PROJECT_CHARTER.md      Product overview & features
    ├── ARCHITECTURE.md         System architecture
    └── testing-issues-log.md   Log of bugs found in real-device testing & their fixes
```

Detailed docs per package:

- `client/docs/` — client architecture, drawing engine, responsive layout, component reference
- `server/docs/` — room state machine, module responsibilities, game rules

---

## Game Rules (Quick Reference)

| Rule                                          | Value                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Max players per room                          | 12                                                                                        |
| Min players to start                          | 2                                                                                         |
| Cycles before game ends                       | 3 (every player draws 3 times)                                                           |
| Choosing time (drawer picks a word)           | 15s                                                                                       |
| Drawing time per round                        | 80s                                                                                       |
| Points per correct guess                      | Rank-based base (100/80/60/50) + time bonus (guesser); +10 per guess (drawer, max 100)   |
| Turn order                                    | Sequential by join order                                                                  |
| Max player name length                        | 16 characters                                                                             |
| Max guess / chat message length               | 60 characters                                                                             |
| Guess rate limit                              | 1 accepted guess per 250ms per player                                                     |
| Room grace period (after last player leaves)  | 60s, before the room is deleted                                                           |

---

## Scripts

| Command          | Where     | What                       |
| ---------------- | --------- | -------------------------- |
| `npm run dev`    | `client/` | Vite dev server            |
| `npm run build`  | `client/` | Production build           |
| `npm run preview`| `client/` | Preview the production build |
| `npm run lint`   | `client/` | Run oxlint                 |
| `npm run dev`    | `server/` | Nodemon dev server         |
| `node server.js` | `server/` | Start server directly      |
