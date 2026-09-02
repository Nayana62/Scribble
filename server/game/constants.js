/**
 * Shared game constants.
 *
 * ROUND_DURATION_SEC will become host-configurable in a future settings feature.
 * Keep it here — not buried inline — so there is a single place to change it.
 */

const ROUND_DURATION_SEC = 80;
const CHOOSING_DURATION_SEC = 15;

/**
 * Server-side hard caps on user-supplied text, enforced regardless of what a
 * client sends (the UI's `maxLength` attributes only constrain well-behaved
 * clients). Keep these in sync with the client's input `maxLength` values:
 *   - name:  client/src/screens/HomeScreen.tsx
 *   - guess: client/src/app/components/guess-form.tsx
 */
const MAX_NAME_LENGTH = 16;
const MAX_GUESS_LENGTH = 60;

/**
 * Minimum time (ms) a single player must wait between accepted `submitGuess`
 * messages. Per-socket, not room-wide — stops one flooding client without
 * throttling other players. Well above realistic human typing speed.
 */
const MIN_GUESS_INTERVAL_MS = 250;

module.exports = {
  ROUND_DURATION_SEC,
  CHOOSING_DURATION_SEC,
  MAX_NAME_LENGTH,
  MAX_GUESS_LENGTH,
  MIN_GUESS_INTERVAL_MS,
};
