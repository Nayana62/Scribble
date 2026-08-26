/**
 * game/gracePeriod.js — Room deletion grace period timers.
 *
 * When the last player leaves a room, the room is not deleted immediately.
 * Instead a 60-second grace timer is started. If a player rejoins (via the
 * `rejoin` event) before the timer fires, `cancelGrace` cancels the deletion.
 * If no one reconnects within the window, `onExpire` is called to run cleanup.
 */

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const graceTimers = new Map();

/**
 * Start a grace timer for a room.
 * If a timer already exists for this room it is replaced.
 *
 * @param {string}   roomId
 * @param {number}   durationSec
 * @param {Function} onExpire  Called when the grace window elapses with no rejoin.
 */
function startGrace(roomId, durationSec, onExpire) {
  cancelGrace(roomId); // replace any existing timer
  const handle = setTimeout(() => {
    graceTimers.delete(roomId);
    onExpire();
  }, durationSec * 1000);
  graceTimers.set(roomId, handle);
}

/**
 * Cancel the grace timer for a room (e.g. a player rejoined in time).
 * Safe to call even if no timer exists.
 *
 * @param {string} roomId
 */
function cancelGrace(roomId) {
  const handle = graceTimers.get(roomId);
  if (handle !== undefined) {
    clearTimeout(handle);
    graceTimers.delete(roomId);
  }
}

/**
 * @param {string} roomId
 * @returns {boolean} True if a grace timer is currently running for this room.
 */
function hasGrace(roomId) {
  return graceTimers.has(roomId);
}

module.exports = { startGrace, cancelGrace, hasGrace };
