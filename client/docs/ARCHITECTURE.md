# Frontend Client Architecture & Specifications

Detailed architectural documentation for the Scribble React 19 + TypeScript + Vite + Tailwind CSS client application.

---

## 🏗 Client Architecture Overview

```
                                  ┌───────────────────────────┐
                                  │      main.tsx (Root)      │
                                  └─────────────┬─────────────┘
                                                │
                                  ┌─────────────▼─────────────┐
                                  │   App.tsx (GameProvider)  │
                                  │   reads state.screen only │
                                  └─────────────┬─────────────┘
                                                │
         ┌──────────────────────────────┼──────────────────────────────┐
         │ (Home / Lobby)               │ (Game / Active Play)         │ (End Game)
         ▼                              ▼                              ▼
  ┌──────────────┐               ┌──────────────┐               ┌──────────────┐
  │  Home View   │               │  Lobby View  │               │ Game Screen  │
  │ - Name input │               │ - Player list│               │ - .game-grid │
  │ - Create     │──────────────►│ - Copy link  │──────────────►│ - Word strip │
  │ - Join Code  │               │ - Start button│              │ - Canvas     │
  └──────────────┘               └──────────────┘               │ - Player list│
                                                                │ - Chat panel │
                                                                └──────┬───────┘
                                                                       │
                                                                       ▼
                                                                ┌──────────────┐
                                                                │Finished View │
                                                                │ - Podium     │
                                                                │ - Scoreboard │
                                                                │ - Play again │
                                                                └──────────────┘
```

---

## 🎨 Responsive Layout — Single Grid (`.game-grid`)

`GameScreen` renders one CSS Grid (defined in `src/index.css`), not two parallel mobile/desktop component trees. Each panel — word strip, canvas, player list, chat — mounts exactly once and is *repositioned* between breakpoints purely via `grid-template-areas`, switched by a single `@media (min-width: 768px)` query. This matters beyond tidiness: mounting `Canvas` twice (once per layout) would register its socket listeners twice.

### Mobile (default, < 768px)

```
grid-template-columns: 1fr 1fr;
grid-template-areas:
  "word    word"
  "canvas  canvas"
  "players chat";
```

Word strip and canvas stack full-width at the top; players and chat sit side by side below.

### Desktop (≥ 768px)

```
grid-template-columns: minmax(0,1fr) <canvas-track> minmax(0,1fr);
grid-template-areas:
  "players word   chat"
  "players canvas chat";
```

Player list (left) and chat (right) each span both rows; word strip and canvas stack in the center column.

### Canvas track sizing

The canvas's row (mobile) / column (desktop) is *not* a plain flexible `1fr` track — it's sized with `min(calc(...), <vh|vw cap>)` to match the canvas's own ideal 3:4 aspect ratio (matching its 600×800 backing resolution). A plain `1fr` track gives the canvas whatever leftover shape is left over, which rarely happens to be 3:4, so the canvas ends up letterboxed inside it. Sizing the *track itself* to 3:4 means any leftover space goes to the player-list/chat panels next to it instead of being wasted as a visible gap; the `min()` ceiling is just a safety cap for extreme viewport shapes (e.g. landscape phones).

### Toolbar height (`--toolbar-h`)

The drawing toolbar (colors + tools row, see `Canvas`/`Toolbar` below) shares the canvas's grid cell, stacked underneath the drawing surface — it isn't a separate grid area. `GameScreen` adds a `.game-grid--toolbar` class when the local player is the active drawer during the drawing phase, which sets the CSS custom property `--toolbar-h` (`0px` normally, `98px` on mobile, `106px` at `≥640px`). The canvas track's height calc includes `+ var(--toolbar-h)`, so the cell grows to fit the toolbar instead of shrinking the canvas to stay 3:4 (which would reintroduce letterboxing).

### Mobile keyboard-aware chat input

`MobileChatInputRow` (rendered outside `.game-grid`, `md:hidden`) hosts the mobile guess input. It uses `useVisualViewport()` to track the on-screen keyboard height on browsers that support the Visual Viewport API: when supported, the row is `position: fixed` and translated up by the keyboard offset; otherwise it falls back to `position: sticky`. It reports its own rendered height back to `GameScreen` (via a `ResizeObserver` + `onHeightChange` callback), which pads `.game-grid`'s bottom by that amount so the fixed bar never overlaps the grid content.

`GameScreen` also adds a `game-screen-active` class to `<html>` while mounted, which locks document scroll and pins the root to `100dvh` (see `index.css`) — this keeps the whole game screen a fixed-height app shell instead of a scrollable page, letting the internal panels manage their own overflow.

---

## 🗂 State Management

Shared game state lives in `src/state/` and is consumed via the `useGame()` hook. Screens do not receive shared state as props.

```
Socket events (GameContext)
        │
        ▼ dispatch(Action)
  gameReducer(state, action)
        │
        ▼
   GameState in Context
        │
        ▼ useGame()
  Screens / derived useMemo
```

### `gameReducer.ts`

Pure reducer — one `Action` type per socket event or state transition:

| Action | Trigger |
| :--- | :--- |
| `JOINED_ROOM_SUCCESS` | `joinedRoomSuccess` |
| `PLAYERS_UPDATED` | `playersUpdate` |
| `NEW_CYCLE_ANNOUNCEMENT` | `newCycleAnnouncement` |
| `CHOOSING_STARTED` | `choosingStarted` |
| `ROUND_STARTED` | `roundStart` — carries `endsAt`, `wordHint`, `cycleNumber` |
| `ACTION_REPLAY` | `actionReplay` |
| `YOUR_WORD` | `yourWord` |
| `ROUND_RESULT` | `roundResult` |
| `CORRECT_GUESSER_ADDED` | `guessResult` (when `correct: true`) |
| `WAITING_FOR_PLAYERS` | `waitingForPlayers` |
| `HOST_CHANGED` | `hostChanged` |
| `SHOW_NOTICE` / `CLEAR_NOTICE` | `notice`, `playerLeft`, host-change toasts |
| `GAME_FINISHED` | `gameFinished` |
| `PLAY_AGAIN` | `playAgain` |
| `RESET_TO_HOME` | `leaveRoom` handler |
| `REJOIN_SUCCESS` | `rejoin` ack success (re-hydrates client state from a server-sent snapshot) |
| `ROOM_CLOSED` | `roomClosed` event (grace period expired on server) |

`GameState` fields: `screen`, `roomId`, `isHost`, `hostId`, `players`, `myColor`, `drawerId`, `drawerName`, `roomStatus`, `word`, `wordLength`, `wordHint`, `replayActions`, `roundResult`, `noticeMsg`, `endsAt: number | null`, `roundPhase: RoundPhase | null`, `choosingEndsAt: number | null`, `wordOptions: string[]`, `isNewCycle: boolean`, `cycleNumber: number | null`, `correctGuessers: string[]`.

Derived values (`isDrawer`, `role`, `wordChars`, `sortedPlayers`, podium groups) are computed with `useMemo` in the screen that needs them — not stored in the reducer.

### `GameContext.tsx`

- Wraps the app with `useReducer(gameReducer, initialGameState)`.
- Registers global socket listeners; each handler `dispatch`es the matching action.
- Keeps a `stateRef` (always-current ref to `state`) so socket handlers registered once in a `useEffect` never read stale closure state.
- Owns reconnect/token logic: saves the per-room `token` to `sessionStorage` on `joinedRoomSuccess`, and on every socket `connect` (initial connect *and* automatic reconnects) emits `rejoin` with the saved token if one exists for the current room, dispatching `REJOIN_SUCCESS` or falling back to `RESET_TO_HOME` on failure.
- Calls `socket.disconnect()` directly on the browser's `pagehide` event (not a custom socket event) so a backgrounded tab or closed window is detected server-side immediately rather than via the heartbeat timeout.
- Exports `useGame()` → `{ state, dispatch, showNotice, leaveRoom }`.

### Screen-local state (stays in `useState`)

| Screen | Local state |
| :--- | :--- |
| `HomeScreen` | `name`, `joinCode`, `urlRoomCode`, `homeError` |
| `LobbyScreen` | `copied` (invite link feedback) |
| `EndScreen` | `playAgainError` |
| `GameScreen` | `inputBarHeight` (measured from `MobileChatInputRow`, pads the grid) |

`HomeScreen` also owns socket listeners for `roomNotFound` and `roomFull` (home-only errors).

---

## ⚡ Client Socket Event Listeners

| Socket Event | Trigger Payload | Client Action / Handler |
| :--- | :--- | :--- |
| `connect` | `(none)` | `GameContext` — emits `rejoin` with `{ roomId, token }` from `sessionStorage` if a token exists for the current room. |
| `joinedRoomSuccess` | `{ roomId, isHost, color, token }` | `dispatch(JOINED_ROOM_SUCCESS)` — transitions to `"gameLobby"`, saves `token` in `sessionStorage`. |
| `roomNotFound` | `{ message }` | `HomeScreen` local error state. |
| `roomFull` | `{ message }` | `HomeScreen` local error state. |
| `roomClosed` | `{ reason }` | `dispatch(ROOM_CLOSED)` — clears the saved token, triggers a notice, transitions to home. |
| `playersUpdate` | `{ players, hostId, status, drawerId }` | `dispatch(PLAYERS_UPDATED)` — updates roster, host, drawer; sets screen to `"game"` if in progress. |
| `newCycleAnnouncement` | `{ cycleNumber }` | `dispatch(NEW_CYCLE_ANNOUNCEMENT)` — round announcement phase. |
| `choosingStarted` | `{ drawerId, drawerName, endsAt, options?, cycleNumber }` | `dispatch(CHOOSING_STARTED)` — word choice phase. |
| `roundStart` | `{ drawerId, drawerName, wordLength, wordHint, endsAt, cycleNumber }` | `dispatch(ROUND_STARTED)` — clears round state, sets `endsAt`, sets screen to `"game"`. |
| `yourWord` | `{ word }` | `dispatch(YOUR_WORD)` — secret word for drawer only. |
| `strokeBroadcast` | `{ points: [{x,y}, …], color, width }` | Handled in `Canvas.tsx` — draws the received point batch as a connected polyline (live preview for guessers). |
| `drawAction` | `{ type: 'stroke'\|'fill'\|'clear'\|'undo', ...payload }` | Handled in `Canvas.tsx` — applies the committed stroke/fill/clear/undo to the local action log and canvas. |
| `actionReplay` | `{ actions: [] }` | `dispatch(ACTION_REPLAY)` — full canvas replay, used for late joiners and after a reconnect. |
| `canvasCleared` | `(none)` | Handled in `Canvas.tsx` — clears the 2D context and local action log. |
| `guessBlocked` | `{ text }` | Handled in `GuessForm.tsx` — drawer cheat warning. |
| `chatMessage` | `{ text, senderId, senderName, isDrawer }` | Appended in `ChatLog.tsx`. |
| `guessResult` | `{ text?, senderId, senderName, correct, isSystemGuess?, isSelfConfirm? }` | Appended in `ChatLog.tsx` (green/checkmark if correct, no word text if `isSystemGuess`); also drives `CORRECT_GUESSER_ADDED` in `GameContext` for the player-list checkmark. |
| `roundResult` | `{ word, scores }` | `dispatch(ROUND_RESULT)` — triggers the 5s `RoundResultOverlay`. |
| `gameFinished` | `{ players }` | `dispatch(GAME_FINISHED)` — transitions to `"finished"`. |
| `playAgain` | `(none)` | `dispatch(PLAY_AGAIN)` — returns to `"gameLobby"`. |
| `waitingForPlayers` | `{ count, min, reason? }` | `dispatch(WAITING_FOR_PLAYERS)`; notice toast if `reason === "player_left"`. |
| `notice` | `{ message }` | `showNotice()` toast. |
| `playerJoined` | `{ id, name }` | Appended in `ChatLog.tsx`. |
| `playerLeft` | `{ id, name }` | `showNotice()` toast + `ChatLog.tsx` entry. |
| `hostChanged` | `{ newHostId, newHostName }` | `dispatch(HOST_CHANGED)` + crown transfer toast. |
| `roundTimeout` | — | No-op — kept only to avoid an unhandled-event warning; the server no longer emits this (replaced by `roundResult`). |

Emits: `rejoin` (ack) — `{ roomId, token }`, sent on `connect`; response dispatches `REJOIN_SUCCESS` or falls back to `RESET_TO_HOME`.

---

## 🏆 Podium & Ranking Rules

On the finished screen:
1. Players are sorted by final score in descending order.
2. Players are grouped by score to naturally support ties.
3. Ranking groups are assigned ordinal ranks (1st, 2nd, 3rd) consecutively:
   - Tied players share the same pedestal box side-by-side.
4. Rest of the scoreboard list is rendered below the podium from highest to lowest rank.

---

## 🔗 URL Invite Flow

When a user opens a shareable invitation link (`?room=XYZ123`):
1. `HomeScreen` reads `new URLSearchParams(window.location.search).get("room")` on mount.
2. Sets local `urlRoomCode` and `joinCode` state to the extracted code.
3. The home card renders a **dedicated invite view** showing only:
   - The invited room code (`XYZ123`).
   - Name input.
   - A single large **JOIN ROOM** button.
   - A secondary *"← Back to main menu"* escape link.
4. This hides the **Create Room** / **join by code** options entirely, reducing friction for invited users.

---

## ✏️ Drawing Engine (`Canvas.tsx` + `app/lib/`)

### Precision coordinate mapping

The canvas coordinate system uses direct bounding-rect scaling to eliminate cursor offset errors:
```typescript
const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;
return {
  x: (clientX - rect.left) * scaleX,
  y: (clientY - rect.top) * scaleY,
};
```
The `<canvas>` backing resolution is fixed at 600×800 (3:4) and displayed via `max-w-full max-h-full aspect-[3/4]`, so this scaling stays accurate at any rendered size. Both mouse (`clientX/Y`) and touch (`touch.clientX/Y`) events flow through the same normalizer, and only one finger is tracked at a time (`activeTouchId`) so an accidental second touch mid-stroke can't hijack the line.

### Live-preview stroke batching

Every `drawStroke` emit used to be one raw pointer event — commit `78ba866` replaced that with client-side batching:

1. While the pointer/finger is down, each moved-to point is pushed into `pendingBatchPoints` (in addition to being drawn locally and pushed into the full `currentStrokePoints` for the eventual committed stroke).
2. `scheduleBatchFlush()` throttles sending to **at most once per animation frame** via `requestAnimationFrame` — a pending rAF handle prevents scheduling more than one flush per frame.
3. `flushStrokeBatch()` emits `socket.emit("drawStroke", { points, color, width })` — an array of ≥2 points — then re-seeds the next batch with the last point sent, so consecutive batches connect without a visual gap.
4. On pointer/touch up, any pending rAF is cancelled and flushed immediately so the live preview never lags behind the stroke about to be committed.

Receiving clients render an incoming batch as a connected polyline (`drawPolyline`). This is a purely ephemeral, unpersisted relay — the server re-broadcasts `drawStroke` payloads opaquely without storing them. The **authoritative** stroke is sent separately, once, via `drawAction` (`{ type: "stroke", points, color, width }`) when the pointer lifts, and is what gets appended to the server's `actionLog` for late-joiner/reconnect replay.

A tap with zero drag produces a single point; `handleMouseUp`/`handleTouchEnd` duplicate it into a degenerate 2-point stroke so `lineCap: "round"` renders (and later replays) it as a visible dot instead of nothing.

### Tools: pencil, fill, undo, clear

`Toolbar` (rendered inside `Canvas`, drawer-only, hidden outside the drawing phase) exposes:
- **Pencil** — the default freehand tool described above.
- **Fill (paint bucket)** — `app/lib/flood-fill.ts`: a stack-based (non-recursive — recursion would blow the call stack on a canvas this size), tolerance-based 4-connected flood fill. Tolerance is measured against the *seed pixel's original color*, not whatever was last painted, so it doesn't leak through anti-aliased stroke edges.
- **Undo** — pops the last entry from the local action log, then calls `app/lib/replay-actions.ts` to rebuild the canvas from scratch from the remaining log. This is the only reliable approach to "undo" on a raster canvas — pixel-level subtraction of the last stroke isn't reliable given overlap and anti-aliasing.
- **Clear** — wipes the canvas and appends a `{ type: "clear" }` entry (so a subsequent undo can remove it and restore prior state).

Both undo and the late-joiner/reconnect sync path (`actionReplay`) go through the same `replayActions()` function, which clears the canvas and replays an ordered `DrawAction[]` (`stroke` | `fill` | `clear`) from scratch — guaranteeing pixel-identical results to what a live participant saw.

Brush size is one of 4 discrete presets (3 / 6 / 12 / 20 px — Thin / Medium / Thick / Extra thick) rather than a continuous slider, chosen for being both more compact and easier to hit precisely on a touchscreen. Color is one of 11 fixed palette swatches. Both are local component state in `Canvas`, not shared game state.
