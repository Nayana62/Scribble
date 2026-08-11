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

### Gameplay

- **Sequential drawer rotation** — players draw in join order, one round per player per cycle
- **3 full cycles** — every player draws three times before the game ends
- **Secret word** — only the active drawer sees the target word
- **Live canvas** — strokes broadcast in real time; mouse and touch supported
- **Canvas clear** — drawer can wipe the board mid-round
- **Guess blocking** — drawer cannot type the secret word in chat
- **Scoring** — correct guesser +50 pts; drawer +20 pts per correct guess in their round
- **Late joiners** — stroke history replayed so new players see the current drawing

### Screens

| Screen    | Purpose                                                      |
| --------- | ------------------------------------------------------------ |
| **Home**  | Enter name, create a room, or join by code / invite link     |
| **Lobby** | Player list, room code, invite link, host start button       |
| **Game**  | 3-column layout — player list, canvas + word strip, chat     |
| **End**   | Podium for top 3, full scoreboard, play again or return home |

### Chat & Notifications

- Live chat and guess log with color-matched player names
- Round start/end announcements, join/leave system messages
- Toast notices for host changes, disconnects, and game pauses

---

## User Roles

| Role        | Capabilities                                                  |
| ----------- | ------------------------------------------------------------- |
| **Host**    | Start game, play again after game over                        |
| **Drawer**  | See secret word, draw on canvas, clear board; guesses blocked |
| **Guesser** | Watch live strokes, submit guesses in chat                    |
