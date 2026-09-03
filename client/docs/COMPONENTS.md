# Component Architecture & Reference Guide

Comprehensive documentation of React components, state ownership, and UI lifecycle in `client/src`.

---

## 🧩 Component Breakdown

### 1. `App.tsx` (Root Controller)

- **Role**: Wraps the app in `<GameProvider>` and routes between screens based on `state.screen`.
- **State**: Reads only `state.screen` via `useGame()` — no shared-state props passed to children.
- **Screens rendered**: `HomeScreen` | `LobbyScreen` | `GameScreen` | `EndScreen`

---

### 2. `gameReducer.ts` + `GameContext.tsx` (Shared State)

- **Role**: Central state layer — socket events dispatch actions; screens consume via `useGame()`.
- **`useGame()` returns**: `{ state, dispatch, showNotice, leaveRoom }`
- **`GameState` fields**:
  - `screen`: `"home" | "gameLobby" | "game" | "finished"`
  - `roomId`, `isHost`, `hostId`, `players`, `myColor`
  - `drawerId`, `drawerName`, `roomStatus`: `"waiting" | "in_progress" | "finished"`
  - `word`, `wordLength`, `wordHint`, `replayActions`, `roundResult`, `noticeMsg`
  - `endsAt: number | null` — epoch ms when the current round/choosing phase expires
  - `roundPhase: "announcement" | "choosing" | "drawing" | null`
  - `choosingEndsAt: number | null`, `wordOptions: string[]` (drawer-only)
  - `isNewCycle: boolean`, `cycleNumber: number | null`
  - `correctGuessers: string[]` — player IDs who've guessed correctly this round, drives the ✅ badge in `PlayerList`

See `client/docs/ARCHITECTURE.md` for the full `Action` union and per-action state transitions.

---

### 3. `HomeScreen.tsx`

- **Role**: Name input, create room, join by code or invite link.
- **Local state**: `name` (persisted to `localStorage` as `scribble_name`), `joinCode`, `urlRoomCode`, `homeError`
- **Socket emits**: `createRoom`, `joinRoom`
- **Socket listens** (local): `roomNotFound`, `roomFull`
- Name input is capped at 16 characters (`maxLength={16}`), matching the server's `MAX_NAME_LENGTH`.

---

### 4. `LobbyScreen.tsx`

- **Role**: Room code display, player list, invite link copy, host start button.
- **Reads from context**: `roomId`, `players`, `hostId`, `isHost`, `noticeMsg`
- **Local state**: `copied`
- **Derived**: `hostPlayer` (inline find)
- **Actions**: `leaveRoom()`, `socket.emit("startGame")`
- Uses the shared `HostBadge` component to mark the host in the player list.

---

### 5. `GameScreen.tsx`

- **Role**: Renders the single `.game-grid` layout (see `client/docs/ARCHITECTURE.md` for the responsive grid mechanics) — word strip, canvas + phase overlays, player list, chat panel — plus the mobile-only chat input dock outside the grid.
- **Reads from context**: `players`, `hostId`, `drawerId`, `wordLength`, `word`, `wordHint`, `replayActions`, `endsAt`, `roundPhase`, `choosingEndsAt`, `wordOptions`, `drawerName`, `cycleNumber`, `correctGuessers`, `roundResult`
- **Local state**: `inputBarHeight` — the measured height of `MobileChatInputRow`, applied as bottom padding on `.game-grid` so the fixed mobile input bar never overlaps content.
- **Derived**: `isDrawer` (`socket.id === drawerId`), `role: "drawer" | "guesser"`, `wordChars` (`word` for the drawer, `wordHint` for everyone else, split into characters), `canDraw` (`roundPhase === "drawing"`)
- Adds/removes a `game-screen-active` class on `<html>` on mount/unmount to lock document scroll for the duration of the game screen.
- Toggles the `.game-grid--toolbar` modifier class when `isDrawer && canDraw`, which grows the canvas grid cell to make room for the embedded `Toolbar`.

---

### 6. `EndScreen.tsx`

- **Role**: Podium (top 3, ties supported), full scoreboard, play again / leave.
- **Reads from context**: `roomId`, `players`, `isHost`, `hostId`
- **Local state**: `playAgainError`
- **Derived** (`useMemo`): `hostName`, `sortedPlayers`, `firstPlace`, `secondPlace`, `thirdPlace` (grouped by score into `RankedGroup`s)
- **Actions**: `socket.emit("playAgain", ack)` — 5s client-side timeout; surfaces `NOT_HOST` / `INVALID_STATE` / generic errors inline — and `leaveRoom()`.
- Role-gated UI: the host sees a working "Play Again" button; everyone else sees a "Waiting for `{hostName}`…" status line. Both roles get a "Leave Room" button. No extra listener is needed for the live swap when host changes — `hostChanged` is handled globally in `GameContext`, which updates `state.isHost` and re-renders this screen.

---

### 7. `Canvas.tsx`

- **Role**: HTML5 `<canvas>` drawing board (600×800 backing resolution, 3:4 aspect ratio). Owns coordinate scaling, stroke/fill rendering, mouse & touch input, live-preview network batching, the local action log (undo/redo source of truth), and embeds `Toolbar` for the drawer.
- **Props**:
  ```typescript
  type Props = {
    role: "drawer" | "guesser" | null;
    /** Full ordered action log for late-joiner / reconnect replay (from shared game state). */
    replayActions?: DrawAction[];
    /** When false, drawing input is disabled (e.g. during word-choosing phase). */
    canDraw?: boolean;
  };
  ```
- **Local state**: `activeTool` (`"pencil" | "fill"`), `activeColor`, `activeWidth`, `canUndo` — none of this is shared game state; it resets with the component.
- **Key internals**:
  - `getCanvasCoords(clientX, clientY)` — bounding-rect scaling to map screen coordinates to the canvas's fixed backing resolution.
  - `drawSegment` / `drawPolyline` — low-level line rendering (`lineCap`/`lineJoin: "round"`).
  - `flushStrokeBatch` / `scheduleBatchFlush` — throttles `drawStroke` emission to at most once per animation frame; see "Live-preview stroke batching" in `client/docs/ARCHITECTURE.md`.
  - `handleUndo` / `handleClear` — mutate the local action log (`localActionLog` ref) and call `replayActions()` / `clearCanvasLocally()`, then emit `drawAction`.
  - Socket listeners: `strokeBroadcast` (live preview), `drawAction` (committed actions from the drawer), `canvasCleared`, `roundStart` (resets the local log).
- Renders `Toolbar` beneath the canvas only when `role === "drawer" && canDraw`.

---

### 8. `Toolbar.tsx`

- **Role**: Drawer-only drawing controls, rendered inside `Canvas` beneath the drawing surface. Two rows: an 11-swatch color palette, then pencil/fill tool toggle, 4 brush-size presets, undo, and clear.
- **Props**:
  ```typescript
  type Props = {
    activeColor: string;
    onColorChange: (color: string) => void;
    activeWidth: number;
    onWidthChange: (width: number) => void;
    activeTool: "pencil" | "fill";
    onToolChange: (tool: "pencil" | "fill") => void;
    canUndo: boolean;
    onUndo: () => void;
    onClear: () => void;
  };
  ```
- **Exports**: `PALETTE_COLORS` (11 `{ hex, label }` swatches), `DEFAULT_COLOR` (`#0f172a`), `DEFAULT_WIDTH` (`6`), `ActiveTool` type.
- Brush-size presets are 4 discrete steps — Thin (3px), Medium (6px), Thick (12px), Extra thick (20px) — each rendered as a dot scaled to size and filled with the active color, rather than a continuous slider (more compact, easier to hit on touch).
- Purely controlled — all state (`activeColor`, `activeWidth`, `activeTool`, `canUndo`) is owned by the parent `Canvas`.

---

### 9. `WordStrip.tsx`

- **Role**: 3-column strip above the canvas — round number (left), word blanks/letters (center), `Timer` (right).
- **Props**:
  ```typescript
  type Props = {
    wordChars: string[];
    wordLength: number;
    isDrawer: boolean;
    word: string | null;
    endsAt: number | null;
    durationSec: number;
    cycleNumber: number | null;
  };
  ```
- Word character font-size is computed inline (`min(1.5rem, 50vw / wordLength)`) so long words shrink to fit on narrow screens instead of wrapping or overflowing.
- Label reads "Draw this" for the drawer, "Guess this" for everyone else.

---

### 10. `Timer.tsx`

- **Role**: SVG circular countdown ring, reused by `WordStrip` (round timer) and `ChoosingOverlay` (choosing-phase timer). Shows remaining whole seconds numerically inside the ring.
- **Props**:
  ```typescript
  type Props = {
    endsAt: number | null;   // epoch ms from shared game state
    durationSec: number;     // total duration this countdown represents
  };
  ```
- **Behavior**:
  - Renders an empty placeholder box when `endsAt` is `null` (between rounds / lobby) — keeps layout stable rather than collapsing to zero width.
  - Maintains a local `setInterval` (100 ms tick) to compute `remaining = Math.max(0, endsAt - Date.now())`. Only `endsAt` lives in shared state; the interval and `remaining` are local.
  - Ring color transitions: green (`#22c55e`) > 50% remaining, yellow (`#eab308`) 20–50%, red (`#ef4444`) < 20%; the numeric label also switches to the ring color (with a pulse) once ≤ 10s and ≤ 20% remain.
  - Cleans up the interval on unmount and whenever `endsAt` changes.
- **Late-joiner / reconnect safe**: `endsAt` is hydrated from the server (`roundStart`/`choosingStarted` payload, or the `rejoin` snapshot), so the timer renders the correct remaining time instead of restarting from the full duration.

---

### 11. `CanvasPhaseOverlays.tsx`

- **Role**: Positioned dispatcher — decides which (if any) overlay sits on top of the canvas, based on shared game state. Rendered as a sibling of `Canvas` inside the `.game-grid__canvas` cell (which is `position: relative` to anchor the overlay's `absolute inset-0`).
- **Props**:
  ```typescript
  type Props = {
    roundPhase: RoundPhase | "announcement" | null;
    choosingEndsAt: number | null;
    cycleNumber: number | null;
    isDrawer: boolean;
    wordOptions: string[];
    drawerName: string;
    roundResult: RoundResultPayload | null;
    myId: string;
  };
  ```
- **Priority order**: `roundResult` present → `RoundResultOverlay`; else `roundPhase === "announcement"` → `RoundAnnouncementOverlay`; else `roundPhase === "choosing"` → `ChoosingOverlay` (`mode="picker"` for the drawer when `wordOptions` is non-empty, else `mode="waiting"`); else nothing.

---

### 12. `ChoosingOverlay.tsx`

- **Role**: Modal shown during the 15s word-choosing phase.
- **Props** (discriminated union on `mode`):
  ```typescript
  type Props = { visible?: boolean } & (
    | { mode: "picker"; choosingEndsAt: number; wordOptions: string[] }
    | { mode: "waiting"; choosingEndsAt: number; drawerName: string }
  );
  ```
- `mode: "picker"` (drawer) renders the 3 word options as buttons; clicking one emits `socket.emit("wordChosen", { word })`.
- `mode: "waiting"` (everyone else) shows `"{drawerName} is choosing a word…"`.
- Both show a `Timer` pinned to a local `CHOOSING_DURATION_SEC = 15` constant — must stay in sync with the server's `CHOOSING_DURATION_SEC` (`server/game/constants.js`).

---

### 13. `RoundAnnouncementOverlay.tsx`

- **Role**: Full-bleed "Round N" title card shown briefly (~2s, server-driven) at the start of each new cycle — i.e. only on the first turn of every cycle, not every round.
- **Props**: `{ cycleNumber: number; visible: boolean }`

---

### 14. `RoundResultOverlay.tsx`

- **Role**: Shown for 5 seconds at the end of every round (all guessed, timeout, or drawer disconnected). Reveals the word, then a scores list sorted descending (server-sorted) with medal icons for the top 3, a `+N`/`+0` per player, and the local player's row highlighted.
- **Props**: `{ roundResult: RoundResultPayload; myId: string }` — `myId` is the local `socket.id`, used to highlight/label "you".
- Automatically dismissed when the next `CHOOSING_STARTED` / `NEW_CYCLE_ANNOUNCEMENT` action clears `roundResult` from state — no local timer needed.

---

### 15. `PlayerList.tsx`

- **Role**: Renders the room's player list — score, color avatar, and status icons (Host badge, ✏️ for the current drawer, ✅ for players who've guessed correctly this round). Pure status icons instead of text labels.
- **Props**:
  ```typescript
  type Props = {
    players: Player[];
    hostId: string | null;
    drawerId: string | null;
    correctGuessers?: string[]; // defaults to []
  };
  ```
- Uses the shared `HostBadge` component so the host indicator matches `LobbyScreen` exactly.

---

### 16. `HostBadge.tsx`

- **Role**: Tiny shared "Host" pill component — a single source of truth so `LobbyScreen` and `PlayerList` never visually drift apart. Takes no props.

---

### 17. `ChatPanel.tsx` & `ChatLog.tsx`

- **`ChatPanel`** — Role: chat container. Renders `ChatLog` plus `GuessForm`, but only on desktop (`hidden md:block`) — on mobile, `GuessForm` is rendered separately by `MobileChatInputRow` instead, so it isn't duplicated.
  ```typescript
  type Props = { role: "drawer" | "guesser" | null; players: Player[] };
  ```
- **`ChatLog`** — Role: scrolling message log. Owns its own socket listeners and local `entries` state (not shared game state) for: `guessResult` (correct guesses render as a system "✅ {name} guessed the word!" line to everyone but the guesser, whose own confirmation shows their text), `chatMessage`, `roundStart` ("✏️ New round…"), `waitingForPlayers`, `hostChanged`, `playerJoined`, `playerLeft`. Looks up each message sender's current color from the live `players` prop so names stay color-matched even after a reconnect changes `senderId`.
  ```typescript
  type Props = { players: Player[] };
  ```
  Auto-scrolls to the bottom on every new entry.

---

### 18. `GuessForm.tsx`

- **Role**: Input for guesses/chat. Rendered by `ChatPanel` (desktop) or `MobileChatInputRow` (mobile) — never both at once for the same viewport.
- **Props**: `{ role: "drawer" | "guesser" | null }` — changes the placeholder text ("Chat..." vs "Type your guess…").
- Input is capped at 60 characters (`maxLength={60}`), matching the server's `MAX_GUESS_LENGTH`.
- Listens for `guessBlocked` and shows a 2.5s inline warning ("You can't send the answer — that gives it away!") when the drawer tries to type the secret word.
- Emits `socket.emit("submitGuess", { text })` on submit; clears the input immediately (optimistic).

---

### 19. `MobileChatInputRow.tsx`

- **Role**: Mobile-only (`md:hidden`) dock that hosts `GuessForm` outside the main `.game-grid`, positioned to track the on-screen keyboard.
- **Props**: `{ role: "drawer" | "guesser" | null; onHeightChange?: (height: number) => void }`
- Uses `useVisualViewport()`: when the Visual Viewport API is supported, renders `position: fixed` and translates itself up by the keyboard height (`transform: translateY(-offset)`); otherwise falls back to `position: sticky`.
- Reports its own rendered height to the parent via a `ResizeObserver` so `GameScreen` can pad `.game-grid`'s bottom and avoid overlap (only needed for the fixed variant — the sticky fallback participates in normal flow, so it reports `0`).

---

## 🧰 Drawing-Engine Library Modules (`app/lib/`)

These are plain functions/hooks, not components — documented here because `Canvas` and its overlays depend on them directly.

### `flood-fill.ts` — `floodFill(ctx, startX, startY, fillColor, tolerance = 40)`

Stack-based (not recursive, to avoid blowing the call stack) 4-connected flood fill with tolerance-based color matching. Compares each candidate pixel against the *seed pixel's original color* (not whatever was most recently painted), which prevents the fill leaking through anti-aliased stroke edges while still covering them. Bails out immediately if the seed pixel already matches the fill color closely.

### `replay-actions.ts` — `replayActions(ctx, actions: DrawAction[])`

Clears the canvas and replays an ordered action log (`stroke` | `fill` | `clear`) from scratch. The single source of truth for reconstructing canvas state — used identically for late-joiner/reconnect sync (server's `actionLog`) and for undo (the local log with its last entry popped). Chosen over pixel-level "undo" because raster overlap and anti-aliasing make subtraction unreliable.

### `use-visual-viewport.ts` — `useVisualViewport()`

Tracks `window.visualViewport` resize/scroll events to compute the on-screen-keyboard height (`offset`) on browsers that support it (notably iOS Safari). Returns `{ offset: number, supported: boolean }`. Used exclusively by `MobileChatInputRow` to keep the guess input visible above the keyboard.

---

## 🎨 Other UI Primitives

`src/components/ui/` (`button.tsx`, `input.tsx`) and `src/components/lib/utils.ts` are shadcn-style shared primitives scaffolded into the project. The game's screens and components are custom-styled directly with Tailwind rather than built on these — they're available for future UI work but aren't currently load-bearing for any screen described above.
