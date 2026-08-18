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
  │ - Name input │               │ - Player list│               │ - 3 cols     │
  │ - Create     │──────────────►│ - Copy link  │──────────────►│ - Canvas     │
  │ - Join Code  │               │ - Start button│              │ - Player list│
  └──────────────┘               └──────────────┘               │ - Chat panel │
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

## 🎨 Responsive Design System (`skribbl.io` Layout)

The client implements a dual-layout responsive system tailored for mobile and desktop screens:

### 1. Mobile & Smaller Screens ($< 768\text{px}$)
- **Top Section (Full Width)**: Word strip + Canvas drawing area (`col-span-12`, `order-1`, height `52vh`) with mobile touch event handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`).
- **Bottom-Left Section**: Player list sidebar (`col-span-6`, `order-2`, height `38vh`).
- **Bottom-Right Section**: Chat panel & guess form (`col-span-6`, `order-3`, height `38vh`).

### 2. Desktop Screens ($\ge 768\text{px}$)
- **Left Column (3 cols)**: Player list sidebar (`col-span-3`, `order-1`).
- **Center Column (6 cols)**: Word strip + Canvas drawing area (`col-span-6`, `order-2`).
- **Right Column (3 cols)**: Chat panel & guess form (`col-span-3`, `order-3`).

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
| `ROUND_STARTED` | `roundStart` — now carries `endsAt`, `wordHint`, `cycleNumber` |
| `ACTION_REPLAY` | `actionReplay` |
| `YOUR_WORD` | `yourWord` |
| `ROUND_RESULT` | `roundResult` |
| `CORRECT_GUESSER_ADDED` | `guessResult` (when correct: true) |
| `WAITING_FOR_PLAYERS` | `waitingForPlayers` |
| `HOST_CHANGED` | `hostChanged` |
| `SHOW_NOTICE` / `CLEAR_NOTICE` | `notice`, `playerLeft`, host-change toasts |
| `GAME_FINISHED` | `gameFinished` |
| `PLAY_AGAIN` | `playAgain` |
| `RESET_TO_HOME` | `leaveRoom` handler |

`GameState` fields: `screen`, `roomId`, `isHost`, `hostId`, `players`, `myColor`, `drawerId`, `drawerName`, `roomStatus`, `word`, `wordLength`, `wordHint`, `replayActions`, `roundResult`, `noticeMsg`, `endsAt: number | null`, `roundPhase: RoundPhase | null`, `choosingEndsAt: number | null`, `wordOptions: string[]`, `isNewCycle: boolean`, `cycleNumber: number | null`, `correctGuessers: string[]`.

Derived values (`isDrawer`, `role`, `wordChars`, `sortedPlayers`, podium groups) are computed with `useMemo` in the screen that needs them — not stored in the reducer.

### `GameContext.tsx`

- Wraps the app with `useReducer(gameReducer, initialGameState)`.
- Registers global socket listeners; each handler `dispatch`es the matching action.
- Exports `useGame()` → `{ state, dispatch, showNotice, leaveRoom }`.

### Screen-local state (stays in `useState`)

| Screen | Local state |
| :--- | :--- |
| `HomeScreen` | `name`, `joinCode`, `urlRoomCode`, `homeError` |
| `LobbyScreen` | `copied` (invite link feedback) |

`HomeScreen` also owns socket listeners for `roomNotFound` and `roomFull` (home-only errors).

---

## ⚡ Client Socket Event Listeners

| Socket Event | Trigger Payload | Client Action / Handler |
| :--- | :--- | :--- |
| `joinedRoomSuccess` | `{ roomId, isHost, color }` | `dispatch(JOINED_ROOM_SUCCESS)` — transitions to `"gameLobby"`. |
| `roomNotFound` | `{ message }` | `HomeScreen` local error state. |
| `roomFull` | `{ message }` | `HomeScreen` local error state. |
| `playersUpdate` | `{ players, hostId, status, drawerId }` | `dispatch(PLAYERS_UPDATED)` — updates roster, host, drawer; sets screen to `"game"` if in progress. |
| `newCycleAnnouncement` | `{ cycleNumber }` | `dispatch(NEW_CYCLE_ANNOUNCEMENT)` — round announcement phase. |
| `choosingStarted` | `{ drawerId, drawerName, endsAt, options?, cycleNumber }` | `dispatch(CHOOSING_STARTED)` — word choice phase. |
| `roundStart` | `{ drawerId, drawerName, wordLength, wordHint, endsAt, cycleNumber }` | `dispatch(ROUND_STARTED)` — clears round state, sets `endsAt`, sets screen to `"game"`. |
| `yourWord` | `{ word }` | `dispatch(YOUR_WORD)` — secret word for drawer only. |
| `strokeBroadcast` | `{ prevX, prevY, x, y, color, width }` | Handled in `Canvas.tsx` — renders live stroke (guessers). |
| `drawAction` | `{ type: 'stroke'\|'fill'\|'clear'\|'undo', ...payload }` | Handled in `Canvas.tsx` — handles stroke, fill, clear, and undo actions. |
| `actionReplay` | `{ actions: [] }` | `dispatch(ACTION_REPLAY)` — late-joiner canvas replay. |
| `canvasCleared` | `(none)` | Handled in `Canvas.tsx` — clears 2D context. |
| `guessBlocked` | `{ text }` | Handled in `GuessForm.tsx` — drawer cheat warning. |
| `chatMessage` | `{ text, senderId, senderName }` | Appended in `ChatLog.tsx`. |
| `guessResult` | `{ text?, senderId, senderName, correct, isSystemGuess?, isSelfConfirm? }` | Appended in `ChatLog.tsx` (green/checkmark if correct, silent if `isSystemGuess`). |
| `roundResult` | `{ word, scores }` | `dispatch(ROUND_RESULT)` — triggers 5s ranking overlay. |
| `gameFinished` | `{ players }` | `dispatch(GAME_FINISHED)` — transitions to `"finished"`. |
| `playAgain` | `(none)` | `dispatch(PLAY_AGAIN)` — returns to `"gameLobby"`. |
| `waitingForPlayers` | `{ count, min, reason? }` | `dispatch(WAITING_FOR_PLAYERS)`; notice toast if `reason === "player_left"`. |
| `notice` | `{ message }` | `showNotice()` toast. |
| `playerJoined` | `{ id, name }` | Appended in `ChatLog.tsx`. |
| `playerLeft` | `{ id, name }` | `showNotice()` toast + `ChatLog.tsx` entry. |
| `hostChanged` | `{ newHostId, newHostName }` | `dispatch(HOST_CHANGED)` + crown transfer toast. |

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
3. Lobby renders a **dedicated invite card** showing only:
   - The invited room code (`ROOM: XYZ123`).
   - Name input.
   - A single large **JOIN ROOM XYZ123** button.
   - A secondary *"← Or switch to main lobby"* escape link.
4. This hides the **PLAY** and **CREATE ROOM** options entirely, reducing friction for invited users.

---

## 🎨 Canvas Precision Drawing

The canvas coordinate system uses direct bounding rect scaling to eliminate cursor offset errors:
```typescript
const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;
return {
  x: (clientX - rect.left) * scaleX,
  y: (clientY - rect.top) * scaleY,
};
```
- The `<canvas>` element uses `w-full h-full block` (no `object-contain`) so the CSS bounding rect matches the canvas pixel coordinate space 1-to-1.
- Both mouse (`clientX/Y`) and touch (`touch.clientX/Y`) events flow through the same normalizer.
