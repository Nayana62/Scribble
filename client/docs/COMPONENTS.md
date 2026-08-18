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
  - `drawerId`, `drawerName`, `roomStatus`: `"waiting" | "in_progress"`
  - `word`, `wordLength`, `replayStrokes`, `roundEndInfo`, `noticeMsg`

---

### 3. `HomeScreen.tsx`

- **Role**: Name input, create room, join by code or invite link.
- **Local state**: `name` (persisted to `localStorage`), `joinCode`, `urlRoomCode`, `homeError`
- **Socket emits**: `createRoom`, `joinRoom`
- **Socket listens** (local): `roomNotFound`, `roomFull`

---

### 4. `LobbyScreen.tsx`

- **Role**: Room code display, player list, invite link copy, host start button.
- **Reads from context**: `roomId`, `players`, `hostId`, `isHost`, `noticeMsg`
- **Local state**: `copied`
- **Derived**: `hostPlayer` (inline find)
- **Actions**: `leaveRoom()`, `socket.emit("startGame")`

---

### 5. `GameScreen.tsx`

- **Role**: 3-column game layout — player list, canvas + word strip, chat panel.
- **Reads from context**: `players`, `hostId`, `drawerId`, `wordLength`, `word`, `replayStrokes`, `roundEndInfo`, `noticeMsg`
- **Derived** (`useMemo`): `isDrawer`, `role`, `wordChars`

---

### 6. `EndScreen.tsx`

- **Role**: Podium (top 3), full scoreboard, play again / home.
- **Reads from context**: `roomId`, `players`
- **Derived** (`useMemo`): `sortedPlayers`, `firstPlace`, `secondPlace`, `thirdPlace`
- **Actions**: `socket.emit("playAgain")`, `leaveRoom()`

---

### 7. `Canvas.tsx`

- **Role**: HTML5 `<canvas>` drawing board. Manages coordinate scaling, line rendering, mouse & touch event listeners, stroke emission, and board clearing.
- **Props**:
  ```typescript
  type Props = {
    role: "drawer" | "guesser" | null;
    replayStrokes?: Array<{ prevX: number; prevY: number; x: number; y: number }>;
  };
  ```
- **Key Methods**:
  - `getCanvasCoords(e)`: Normalizes mouse click coordinates against bounding rectangle scaling.
  - `drawLine(x1, y1, x2, y2)`: Renders 2D canvas line with rounded line caps.
  - `clearCanvas()`: Clears the drawing context.

---

### 8. `PlayerList.tsx`

- **Role**: Renders room player list, score indicator, color avatars, and status icons (👑 for host, ✏️ for current drawer). Uses pure status icons instead of text labels.
- **Props**:
  ```typescript
  type Props = {
    players: Player[];
    hostId: string | null;
    drawerId: string | null;
  };
  ```

---

### 9. `ChatPanel.tsx` & `ChatLog.tsx`

- **Role**: Manages real-time room chat log, color-matching names dynamically lookup from `players` list, guess outcomes, round start notifications, and system logs.
- **Props**:
  ```typescript
  type Props = {
    role: "drawer" | "guesser" | null;
    players: Player[];
  };
  ```

---

### 10. `GuessForm.tsx`

- **Role**: Input form for typing guesses or chat messages. Handles drawer cheat blocking notifications (`guessBlocked`).
- **Props**:
  ```typescript
  type Props = {
    role: "drawer" | "guesser" | null;
  };
  ```
