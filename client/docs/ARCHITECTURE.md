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
                                  │     App.tsx Controller    │
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

## ⚡ Client Socket Event Listeners

| Socket Event | Trigger Payload | Client Action / Handler |
| :--- | :--- | :--- |
| `joinedRoomSuccess` | `{ roomId, isHost, color }` | Transitions screen to `"gameLobby"`, sets room details, host status, and assigned color avatar. |
| `roomNotFound` | `{ message }` | Renders error notification on home screen. |
| `roomFull` | `{ message }` | Renders room full error notification on home screen. |
| `playersUpdate` | `{ players, hostId, status, drawerId }` | Updates live player list, scores, host badge, and drawer status. |
| `roundStart` | `{ drawerId, drawerName, wordLength }` | Clears canvas, updates drawer role UI, resets round state, sets screen to `"game"`. |
| `yourWord` | `{ word }` | Renders secret target word for the active drawer only. |
| `strokeBroadcast` | `{ prevX, prevY, x, y }` | Renders live incoming stroke onto 2D canvas context. |
| `strokeReplay` | `{ strokes: [] }` | Replays the full history of the current round's drawings to a late joiner. |
| `canvasCleared` | `(none)` | Clears the 2D canvas context. |
| `guessBlocked` | `{ text }` | Displays warning feedback if drawer attempts to type secret word. |
| `chatMessage` | `{ text, senderId, senderName }` | Appends chat message to `ChatLog`. |
| `guessResult` | `{ text, senderId, senderName, correct }` | Appends guess outcome to `ChatLog` (styled green if correct). |
| `roundEnd` | `{ correctWord, winnerName }` | Displays round winner toast overlay. |
| `gameFinished` | `{ players }` | Transition to the `"finished"` screen showing podium standings. |
| `playAgain` | `(none)` | Resets room status to `"waiting"`, wipes drawer status, and returns all players to the `"gameLobby"`. |
| `waitingForPlayers` | `{ count, min, reason? }` | Resets `roomStatus` to `"waiting"`, clears drawer and word. If `reason === "player_left"`, returns players to `"gameLobby"` and shows notice toast. |
| `notice` | `{ message }` | Displays floating alert notice toast. |
| `playerJoined` | `{ id, name }` | Appends joined notification to `ChatLog`. |
| `playerLeft` | `{ id, name }` | Displays disconnection alert toast and appends left notification to `ChatLog`. |
| `hostChanged` | `{ newHostId, newHostName }` | Updates host information and appends crown transfer notification to `ChatLog`. |

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
1. `useEffect` reads `new URLSearchParams(window.location.search).get("room")` on mount.
2. Sets `urlRoomCode` state to the extracted code.
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
