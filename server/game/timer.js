/**
 * game/timer.js — Server-authoritative per-room round timer.
 *
 * Keeps track of one active countdown per room (keyed by roomId).
 * The server never broadcasts tick-by-tick remaining time; it only:
 *  - records `endsAt` (epoch ms) so late joiners can compute remaining time, and
 *  - fires `onExpire` exactly once when the countdown reaches zero.
 *
 * The client derives its own countdown display from `endsAt` locally.
 */

/** @type {Map<string, { handle: ReturnType<typeof setTimeout>; endsAt: number }>} */
const timers = new Map();

/**
 * Start (or restart) the round timer for a room.
 *
 * @param {string}   roomId
 * @param {number}   durationSec
 * @param {Function} onExpire  — called once when the timer fires; should call endRound(room, 'timeout')
 */
function startRoundTimer(roomId, durationSec, onExpire) {
  // Always clear any existing handle before starting a new one.
  clearRoundTimer(roomId);

  const endsAt = Date.now() + durationSec * 1000;
  const handle = setTimeout(() => {
    timers.delete(roomId); // clean up before callback so re-entrant calls are safe
    onExpire();
  }, durationSec * 1000);

  timers.set(roomId, { handle, endsAt });
}

/**
 * Cancel the pending round timer for a room (no-op if none exists).
 * Call unconditionally from endRound so stray timeouts can never fire.
 *
 * @param {string} roomId
 */
function clearRoundTimer(roomId) {
  const entry = timers.get(roomId);
  if (entry) {
    clearTimeout(entry.handle);
    timers.delete(roomId);
  }
}

/**
 * Return the epoch-ms timestamp when the current round expires,
 * or null if no timer is running for this room.
 *
 * @param {string} roomId
 * @returns {number | null}
 */
function getEndsAt(roomId) {
  const entry = timers.get(roomId);
  return entry ? entry.endsAt : null;
}

module.exports = {
  startRoundTimer,
  clearRoundTimer,
  getEndsAt,
};
