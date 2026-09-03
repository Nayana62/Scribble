# Scribble — Product Overview

Scribble is a real-time multiplayer drawing and guessing game. One player draws a secret word on a shared canvas while everyone else races to guess it in chat. Inspired by skribbl.io-style room play.

---

## Core Features

### Rooms & Lobby

- **Private rooms** with 6-character codes and shareable invite links (`?room=CODE`)
- Up to **12 players** per room; **2 players minimum** to start or continue a game
- **Host controls** — room creator starts the game from the lobby
- **Host transfer** — if the host disconnects, the next oldest player becomes host
- **Copy invite link** — one-click share from the lobby
- **Reconnect-friendly** — a player who briefly loses connection (backgrounded tab, flaky network) rejoins their same seat automatically; a room with no one connected is kept alive for 60s before it's cleaned up, so a host can background the app to share the invite link without the room vanishing

### Gameplay

- **Sequential drawer rotation** — players draw in join order, one round per player per cycle
- **3 full cycles** — every player draws three times before the game ends
- **Secret word** — active drawer chooses from 3 word options within 15 seconds (auto-picked at random if time runs out); only the drawer sees the target word
- **Live canvas** — strokes broadcast in real time; mouse and touch supported, batched over the network for a smooth feed without flooding the connection
- **Drawing tools** — pencil and fill (paint-bucket), an 11-color palette, 4 discrete brush-size presets (thin / medium / thick / extra thick), undo, and clear
- **Guess blocking** — drawer cannot type the secret word in chat
- **Fair-play limits** — guesses and chat messages are capped at 60 characters and rate-limited to one accepted guess per 250ms per player; names are capped at 16 characters
- **Scoring** — correct guesser gets rank-based base points (100/80/60/50) + time bonus (up to 50/40/40/0); drawer gets +10 pts per correct guess in their round (up to 100 max)
- **Late joiners** — the full drawing is replayed so new players see the current state of the canvas immediately, not a blank one

### Screens

| Screen    | Purpose                                                      |
| --------- | ------------------------------------------------------------ |
| **Home**  | Enter name, create a room, or join by code / invite link     |
| **Lobby** | Player list, room code, invite link, host start button       |
| **Game**  | Grid layout — player list, word strip + canvas + toolbar, chat |
| **End**   | Podium for top 3, full scoreboard, play again or return home |

### In-Round Overlays

Shown on top of the canvas, in sequence, at the start of every round:

1. **Round announcement** — a brief "Round N" title card at the start of each new cycle
2. **Choosing** — the drawer picks from 3 word options while everyone else sees "`{drawer}` is choosing a word…"; both views show a 15s countdown ring
3. **Round result** — shown for 5 seconds once a round ends (everyone guessed, time ran out, or the drawer disconnected): reveals the word and a medal-ranked list of points earned that round

### Chat & Notifications

- Live chat and guess log with color-matched player names
- Round start/end announcements, join/leave system messages
- Toast notices for host changes, disconnects, and game pauses

---

## User Roles

| Role        | Capabilities                                                  |
| ----------- | --------------------------------------------------------------- |
| **Host**    | Start game, play again after game over                        |
| **Drawer**  | See secret word, draw on canvas (tools, colors, undo, clear), choose from word options; guesses blocked |
| **Guesser** | Watch live strokes, submit guesses in chat                    |
