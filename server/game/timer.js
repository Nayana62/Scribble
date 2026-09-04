/**
 * Server-authoritative per-room countdown timers.
 *
 * Supports two timer "kinds" per room: choosing (word pick) and drawing (round).
 * The server never broadcasts tick-by-tick remaining time; it only records `endsAt`
 * and fires `onExpire` once when a countdown reaches zero.
 */

const timers = new Map();

const TIMER_KINDS = ["choosing", "drawing", "announcement"];

function timerKey(roomId, kind) {
  return `${roomId}:${kind}`;
}

function startTimer(roomId, kind, durationSec, onExpire) {
  clearTimer(roomId, kind);

  const endsAt = Date.now() + durationSec * 1000;
  const handle = setTimeout(() => {
    timers.delete(timerKey(roomId, kind));
    onExpire();
  }, durationSec * 1000);

  timers.set(timerKey(roomId, kind), { handle, endsAt });
}

function clearTimer(roomId, kind) {
  const entry = timers.get(timerKey(roomId, kind));
  if (entry) {
    clearTimeout(entry.handle);
    timers.delete(timerKey(roomId, kind));
  }
}

function clearAllTimers(roomId) {
  for (const kind of TIMER_KINDS) {
    clearTimer(roomId, kind);
  }
}

function getEndsAt(roomId, kind = "drawing") {
  const entry = timers.get(timerKey(roomId, kind));
  return entry ? entry.endsAt : null;
}

// No-op if the timer doesn't exist or is already paused.
function pauseTimer(roomId, kind) {
  const key = timerKey(roomId, kind);
  const entry = timers.get(key);
  if (!entry || entry.paused) return;

  clearTimeout(entry.handle);
  const remainingMs = Math.max(0, entry.endsAt - Date.now());
  timers.set(key, {
    ...entry,
    handle: null,
    paused: true,
    remainingMs,
  });
}

// No-op if the timer isn't paused. Fires onExpire immediately if no time was left.
function resumeTimer(roomId, kind, onExpire) {
  const key = timerKey(roomId, kind);
  const entry = timers.get(key);
  if (!entry || !entry.paused) return;

  const remainingMs = entry.remainingMs ?? 0;
  if (remainingMs <= 0) {
    timers.delete(key);
    onExpire();
    return;
  }

  const endsAt = Date.now() + remainingMs;
  const handle = setTimeout(() => {
    timers.delete(key);
    onExpire();
  }, remainingMs);

  timers.set(key, { handle, endsAt, paused: false });
}

function isTimerPaused(roomId, kind) {
  const entry = timers.get(timerKey(roomId, kind));
  return !!(entry && entry.paused);
}

function startRoundTimer(roomId, durationSec, onExpire) {
  startTimer(roomId, "drawing", durationSec, onExpire);
}

function clearRoundTimer(roomId) {
  clearAllTimers(roomId);
}

module.exports = {
  startTimer,
  clearTimer,
  clearAllTimers,
  getEndsAt,
  pauseTimer,
  resumeTimer,
  isTimerPaused,
  startRoundTimer,
  clearRoundTimer,
};
