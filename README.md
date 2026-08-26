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

### Drawing & Guessing

- Real-time canvas with mouse and touch drawing
- Sequential turn rotation — everyone draws in join order
- Drawer chooses a secret word from 3 options
- Live stroke broadcast to all guessers
- Canvas clear button for the drawer
- Drawer cannot type the secret word in chat (guess blocking)
- Late joiners see stroke replay for the current round

### Game Flow

- **3 full cycles** — each player draws 3 times before the game ends
- **Scoring** — Rank-based + time-bonus for correct guessers (+100/80/60/50 base plus up to +50/40/40/0 time-remaining bonus); drawer gets +10 pts per correct guess in their round (up to 100 max)
- Round winner toast after each correct guess
- End screen with podium (top 3, ties supported) and full scoreboard
- Play again returns everyone to the lobby with reset scores

### UI

- Four screens: Home → Lobby → Game → End
- Responsive skribbl.io-style layout (stacked on mobile, 3-column on desktop)
- Color-coded player avatars and chat names
- Live player list with host badge and drawer badge
- Chat log with guesses, system messages, and join/leave notifications

---

## Tech Stack

|          | Client                          | Server               |
| -------- | ------------------------------- | -------------------- |
| Runtime  | React 19 + TypeScript           | Node.js              |
| Build    | Vite + Tailwind CSS v4          | —                    |
| Realtime | Socket.IO Client                | Socket.IO + Express  |
| State    | React Context + `useReducer` (`GameProvider`) | In-memory room `Map` |

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

Open [http://localhost:5173](http://localhost:5173), enter a name, create a room, and share the invite link with friends.

---

## Project Structure

```text
scribble/
├── client/          React frontend (Vite)
├── server/          Node.js + Socket.IO backend
└── docs/            Project-level documentation
    ├── PROJECT_CHARTER.md   Product overview & features
    └── ARCHITECTURE.md      System architecture
```

Detailed docs per package:

- `client/docs/` — client socket events, component reference, responsive layout
- `server/docs/` — room state machine, module responsibilities, game rules

---

## Game Rules (Quick Reference)

| Rule                     | Value                          |
| ------------------------ | ------------------------------ |
| Max players per room     | 12                             |
| Min players to start     | 2                              |
| Cycles before game ends  | 3 (every player draws 3 times) |
| Points per correct guess | Rank-based base (100/80/60/50) + time bonus (guesser); +10 per guess (drawer, max 100) |
| Turn order               | Sequential by join order       |

---

## Scripts

| Command          | Where     | What                  |
| ---------------- | --------- | --------------------- |
| `npm run dev`    | `client/` | Vite dev server       |
| `npm run build`  | `client/` | Production build      |
| `npm run dev`    | `server/` | Nodemon dev server    |
| `node server.js` | `server/` | Start server directly |
