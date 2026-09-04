/**
 * Room deletion grace period timers.
 *
 * When the last player leaves a room, the room is not deleted immediately.
 * Instead a 60-second grace timer is started. If a player rejoins (via the
 * `rejoin` event) before the timer fires, `cancelGrace` cancels the deletion.
 * If no one reconnects within the window, `onExpire` is called to run cleanup.
 */

const graceTimers = new Map();

function startGrace(roomId, durationSec, onExpire) {
  cancelGrace(roomId);
  const handle = setTimeout(() => {
    graceTimers.delete(roomId);
    onExpire();
  }, durationSec * 1000);
  graceTimers.set(roomId, handle);
}

function cancelGrace(roomId) {
  const handle = graceTimers.get(roomId);
  if (handle !== undefined) {
    clearTimeout(handle);
    graceTimers.delete(roomId);
  }
}

function hasGrace(roomId) {
  return graceTimers.has(roomId);
}

module.exports = { startGrace, cancelGrace, hasGrace };
