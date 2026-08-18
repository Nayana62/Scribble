/**
 * game/timer.js — Server-authoritative per-room countdown timers.
 *
 * Supports two timer "kinds" per room: choosing (word pick) and drawing (round).
 * The server never broadcasts tick-by-tick remaining time; it only records `endsAt`
 * and fires `onExpire` once when a countdown reaches zero.
 */

/** @type {Map<string, { handle: ReturnType<typeof setTimeout>; endsAt: number }>} */
const timers = new Map();

const TIMER_KINDS = ["choosing", "drawing", "announcement"];

function timerKey(roomId, kind) {
  return `${roomId}:${kind}`;
}

/**
 * @param {string}   roomId
 * @param {'choosing'|'drawing'} kind
 * @param {number}   durationSec
 * @param {Function} onExpire
 */
function startTimer(roomId, kind, durationSec, onExpire) {
  clearTimer(roomId, kind);

  const endsAt = Date.now() + durationSec * 1000;
  const handle = setTimeout(() => {
    timers.delete(timerKey(roomId, kind));
    onExpire();
  }, durationSec * 1000);

  timers.set(timerKey(roomId, kind), { handle, endsAt });
}

/**
 * @param {string} roomId
 * @param {'choosing'|'drawing'} kind
 */
function clearTimer(roomId, kind) {
  const entry = timers.get(timerKey(roomId, kind));
  if (entry) {
    clearTimeout(entry.handle);
    timers.delete(timerKey(roomId, kind));
  }
}

/** Cancel all pending timers for a room. */
function clearAllTimers(roomId) {
  for (const kind of TIMER_KINDS) {
    clearTimer(roomId, kind);
  }
}

/**
 * @param {string} roomId
 * @param {'choosing'|'drawing'} [kind='drawing']
 * @returns {number | null}
 */
function getEndsAt(roomId, kind = "drawing") {
  const entry = timers.get(timerKey(roomId, kind));
  return entry ? entry.endsAt : null;
}

/** @deprecated alias — starts the draw-round timer */
function startRoundTimer(roomId, durationSec, onExpire) {
  startTimer(roomId, "drawing", durationSec, onExpire);
}

/** Clears every timer kind for the room (safe to call from endRound). */
function clearRoundTimer(roomId) {
  clearAllTimers(roomId);
}

module.exports = {
  startTimer,
  clearTimer,
  clearAllTimers,
  getEndsAt,
  startRoundTimer,
  clearRoundTimer,
};
