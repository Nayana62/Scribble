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
├── client/                      # React frontend
│   ├── src/
│   │   ├── App.tsx              # Screen router (reads state.screen only)
│   │   ├── state/
│   │   │   ├── gameReducer.ts   # GameState, Action types, pure reducer
│   │   │   └── GameContext.tsx  # GameProvider, socket listeners, rejoin/token logic, useGame()
│   │   ├── screens/             # HomeScreen, LobbyScreen, GameScreen, EndScreen
│   │   ├── app/
│   │   │   ├── components/      # Canvas, Toolbar, WordStrip, PlayerList, ChatPanel,
│   │   │   │                    # phase overlays, MobileChatInputRow, HostBadge, Timer
│   │   │   └── lib/              # flood-fill, replay-actions, use-visual-viewport
│   │   ├── socket.ts             # Socket.IO client singleton
│   │   └── types.ts              # Shared TypeScript types
│   └── docs/
├── server/                       # Node.js backend
│   ├── server.js                 # HTTP + Socket.IO bootstrap
│   ├── socket/index.js           # Event handlers (thin coordination layer)
│   ├── game/                     # rooms, turnOrder, scoring, words, timer, gracePeriod, constants
│   └── docs/
└── docs/                         # Project-level docs (this folder)
```

---

## Client Flow

```
main.tsx → App.tsx (GameProvider + screen router)
              ├── HomeScreen        name, create/join room (local UI state)
              ├── LobbyScreen       player list, start game
              ├── GameScreen        canvas + toolbar + player list + chat (single CSS grid)
              └── EndScreen         podium, scoreboard, play again
```

`GameContext.tsx` registers global `socket.on/off` listeners that dispatch actions to `gameReducer`. Screens call `useGame()` for shared state; screen-local UI state stays in `useState`.

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
  [isFirstTurnOfCycle === true]
  Phase: "announcement" (2s cycle overlay)
        │
  Phase: "choosing" (15s drawer picks word from 3 options; auto-picked on timeout)
        │
  Phase: "drawing" (80s active draw & guess timer, actionLog cleared)
        │
  Correct guess (all eligible players) / drawer leaves / timeout
        │
  roundResult (5s pause overlay; scores computed & applied)
        │
  cyclesCompleted >= 3  ──[Yes]──► status: "finished" → gameFinished
        │ [No]
        ▼
  Start Next Round
```

If players drop below 2 mid-game, the game ends immediately (whoever remains is declared the winner) rather than parking in the lobby. If players drop below 2 while still in the lobby or on the results screen, `status` goes back to `"waiting"` and clients return to the lobby.

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
  announcementCycleNumber,   // cycle number shown during the announcement overlay
  choosingOptions,           // the 3 words currently offered (server-only, never broadcast)
  usedWords,                 // words already locked in this game; reset on play again
  shouldResetUsedPoolOnLock, // true when the used-word pool was exhausted this pick
  actionLog,        // replayed for late joiners (DrawAction[])
  correctGuesses,   // per-round list of correct guessers: { playerId, guessedAt, name }
  roundEndsAt,      // epoch-ms expiry of the drawing timer (kept even after the timer is cleared, for scoring)
  // Each player record also carries a `token` (crypto.randomUUID) for reconnect identity,
  // and a `lastGuessAt` timestamp for per-player guess rate limiting.
  // Active countdown timers are tracked in game/timer.js; deletion grace timers in
  // game/gracePeriod.js — neither lives on the room object itself.
}
```

---

## Key Socket Events

### Client → Server

| Event | Purpose |
|---|---|
| `createRoom` | Create private room |
| `joinRoom` | Join by room code |
| `rejoin` | Reconnect using a saved token (ack-based) — re-associates new `socket.id` with the existing player record and returns a room-state snapshot |
| `startGame` | Host starts from lobby |
| `wordChosen` | Drawer selects a word during choosing phase |
| `drawStroke` | Live-preview stroke batch: `{ points: [{x,y}, …], color, width }` — accumulated client-side and flushed at most once per animation frame; relayed opaquely, not persisted |
| `drawAction` | Drawer commits a drawing action (stroke, fill, clear, or undo) — appended to (or popped from) the room's authoritative `actionLog` |
| `submitGuess` | Chat message or guess submission — length-capped and per-player rate-limited server-side |
| `playAgain` | Host resets scores and cycles, returns to lobby (ack-based; returns `NOT_HOST` / `INVALID_STATE` errors) |
| `leaveRoom` | Exit room (ack-based) |

There is no separate "fast leave" event: the client calls `socket.disconnect()` directly on the browser's `pagehide` event (tab close, navigation away, mobile backgrounding), which triggers the server's normal `disconnect` handler immediately instead of waiting on the Socket.IO heartbeat timeout.

### Server → Client

| Event | Purpose |
|---|---|
| `joinedRoomSuccess` | Confirmed room entry — includes `token` for reconnect identity |
| `playersUpdate` | Live roster, scores, host, drawer |
| `newCycleAnnouncement` | Phase announcement begins |
| `choosingStarted` | Choosing phase starts (word options sent to the drawer only) |
| `roundStart` | Drawing phase begins (carrying `endsAt`, `wordHint`, `cycleNumber`) |
| `yourWord` | Secret word (drawer only) |
| `strokeBroadcast` | Live-preview stroke batch relay: `{ points, color, width }` |
| `drawAction` | Relay committed drawing actions (stroke, fill, clear, undo) |
| `actionReplay` | Late-joiner / rejoin action log replay |
| `canvasCleared` | Clear drawing board |
| `chatMessage` / `guessResult` | Chat/guess log entries (guess outcomes are system-notified safely — the word is never sent to anyone but the guesser and the drawer) |
| `guessBlocked` | Drawer tried to type the secret word |
| `roundResult` | Round over; carries the word and each player's points earned this round |
| `gameFinished` | Final scores, go to end screen |
| `waitingForPlayers` | Paused — need more players |
| `roomClosed` | Room deleted (grace period expired with no reconnect); client transitions to home |
| `hostChanged` / `notice` / `playerLeft` / `playerJoined` | System notifications & toasts |

`roundEnd` and `roundTimeout` are legacy events the server no longer emits — `roundResult` replaced both. The client keeps a no-op `roundTimeout` listener purely to avoid an unhandled-event warning during a version skew.

Full event matrices with payloads are documented in `client/docs/ARCHITECTURE.md` and `server/docs/ARCHITECTURE.md`.

---

## Scoring & Game End

- **Correct Guesser Scoring**:
  - Rank-based base points: **100** for 1st, **80** for 2nd, **60** for 3rd, and **50** for 4th+.
  - Time-remaining bonus: up to **+50** for 1st, **+40** for 2nd, **+40** for 3rd, and **0** for 4th+.
  - Total Points = `base + Math.round(maxBonus * (timeRemaining / duration))`
- **Drawer Scoring**:
  - **+10 pts** per player who guesses correctly in their round (up to **100** max).
- **Game ends** after 3 full cycles (every player has drawn 3 times), or immediately if the player count drops below 2 mid-game.
- **Podium** — players grouped by score on the end screen; ties share a rank.

---

## Fair-Play Limits

Enforced server-side regardless of what a client sends (the UI's own `maxLength` attributes only constrain well-behaved clients):

| Limit | Value | Source |
|---|---|---|
| Max player name length | 16 chars | `server/game/constants.js` |
| Max guess / chat message length | 60 chars | `server/game/constants.js` |
| Guess rate limit | 1 accepted guess per 250ms, per socket | `server/game/constants.js` (`MIN_GUESS_INTERVAL_MS`) |

The rate limit is per-player, not room-wide — one player spamming guesses doesn't throttle anyone else.

---

## Reconnection & Room Cleanup

- Each player record carries an opaque `token` (`crypto.randomUUID()`), echoed back on join/rejoin and stored client-side in `sessionStorage`.
- On disconnect, a room isn't deleted immediately — a 60-second grace timer starts (`server/game/gracePeriod.js`), and any active round/choosing timer is paused.
- If the same player reconnects within the window (client auto-emits `rejoin` with the saved token on every `connect`/reconnect), the grace timer is cancelled, timers resume with their remaining time, and the server sends back a full room snapshot to resync the client.
- If the window elapses with no reconnect, the room is deleted and a `roomClosed` event is broadcast to any sockets still attached.
