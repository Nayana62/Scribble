# Component Architecture & Reference Guide

Comprehensive documentation of React components, props, state triggers, and UI lifecycle in `client/src`.

---

## 🧩 Component Breakdown

### 1. `App.tsx` (Root Controller)
- **Role**: Manages top-level state routing (`home` vs `gameLobby` vs `game` vs `finished`), room connection status, player list updates, and room codes.
- **State**:
  - `screen`: `"home" | "gameLobby" | "game" | "finished"`
  - `name`: Player display name (persisted in `localStorage`)
  - `roomId`: Current active room code
  - `isHost`: Boolean flag indicating if current socket is the room host
  - `players`: Array of `{ id, name, score, color }`
  - `drawerId`: Current active drawer socket ID
  - `word`: Target word (only populated if user is the drawer)
  - `wordLength`: Total letters of target word (displayed as dashes for guessers)
  - `replayStrokes`: Array of `{ prevX, prevY, x, y }` for late joiner replaying
  - `roomStatus`: `"waiting" | "in_progress"`

---

### 2. `Canvas.tsx`
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

### 3. `PlayerList.tsx`
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

### 4. `ChatPanel.tsx` & `ChatLog.tsx`
- **Role**: Manages real-time room chat log, color-matching names dynamically lookup from `players` list, guess outcomes, round start notifications, and system logs.
- **Props**:
  ```typescript
  type Props = {
    role: "drawer" | "guesser" | null;
    players: Player[];
  };
  ```

---

### 5. `GuessForm.tsx`
- **Role**: Input form for typing guesses or chat messages. Handles drawer cheat blocking notifications (`guessBlocked`).
- **Props**:
  ```typescript
  type Props = {
    role: "drawer" | "guesser" | null;
  };
  ```

