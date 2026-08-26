# Testing Issues Log

Running record of bugs found during real-device testing and the fixes applied.
Append new entries as issues are found in future testing sessions.

---

## Format

Each entry follows this template:

```
### [ISSUE-NNN] Short title
- **Discovered**: YYYY-MM-DD, [where/how discovered]
- **Symptoms**: What the tester observed.
- **Root cause**: Why it happened.
- **Resolution**: What was changed.
- **Status**: Fixed / Open / Won't Fix
```

---

## Original Issues (found during real-device testing, 2026-08-26)

### [ISSUE-001] Non-host "Play Again" click was silently ignored

- **Discovered**: 2026-08-26, real-device testing (two phones on same Wi-Fi)
- **Symptoms**: Non-host player clicked "Play Again" on the end screen; nothing happened — no error message, no button state change, no indication that the action was rejected.
- **Root cause**: The server's `playAgain` handler had no host check and no ack callback. It applied the reset unconditionally to whoever sent the event (only the host should be allowed to trigger it). When a non-host sent it, the server silently ignored them because by coincidence the `socket.id !== room.hostId` path just fell through without any response. Meanwhile the client emitted `socket.emit("playAgain")` with no ack and no timeout — so there was never any feedback path.
- **Resolution**: Server `playAgain` converted to ack-based. Added host check (`NOT_HOST`) and state check (`INVALID_STATE`). Client wraps emit with an ack callback + 5-second timeout, showing an inline error on the end screen for any failure case. Role-based UI split: host sees a functional "Play Again" button; non-hosts see a "Waiting for {hostName} to start a new game…" status line and a "Leave Room" button — the Play Again button is never shown to players who can't act on it.
- **Status**: Fixed

---

### [ISSUE-002] Stale "still waiting" lobby shown after room was deleted server-side

- **Discovered**: 2026-08-26, real-device testing
- **Symptoms**: One player's client remained on the lobby/waiting screen even after the room had been deleted on the server. The client had no way to know the room was gone; it just sat there indefinitely showing the old state.
- **Root cause**: The server deleted rooms immediately on `players.size === 0` (inside the `disconnect` handler) but never notified any remaining sockets. In this scenario, the last player briefly lost connectivity; the server deleted the room while their socket was still nominally joined to the Socket.IO room — so there were technically sockets subscribed but the room Map entry was gone. No `roomClosed` or equivalent event was ever emitted.
- **Resolution**: Immediate `rooms.delete()` replaced with a 60-second grace timer (`gracePeriod.js`). When the grace period elapses a `roomClosed` event (with `reason: "empty"`) is broadcast to any sockets still in the Socket.IO room. Client listens for `roomClosed`, shows a notice, and dispatches `ROOM_CLOSED` → home screen.
- **Status**: Fixed

---

### [ISSUE-003] Host created room on mobile, backgrounded Chrome to share invite link — room was gone by the time guests clicked it

- **Discovered**: 2026-08-26, real-device testing (mobile Chrome backgrounded while sharing link via WhatsApp)
- **Symptoms**: Host created a room, immediately switched away from Chrome to copy/share the invite link via WhatsApp. By the time the invited players clicked the link (< 60 seconds later), the room no longer existed. Socket.IO's ping-timeout (~20s by default) had already fired and the server had deleted the room on disconnect.
- **Root cause**: Same immediate `rooms.delete()` on `players.size === 0` as ISSUE-002, with the added problem that mobile Chrome suspends the page's network activity when backgrounded, causing Socket.IO's heartbeat to time out within ~20 seconds.
- **Resolution**: Persistent player tokens (`crypto.randomUUID()`) stored per-player in the room record and in `sessionStorage` on the client. If the socket drops and reconnects, the client emits `rejoin` on the `connect` event — the server re-associates the new `socket.id` with the existing player record. Grace period (60s) prevents the room from being deleted the instant the player count hits zero, giving the host time to return from the share sheet.
- **Status**: Fixed

---
