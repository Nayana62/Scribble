/**
 * Rank-based scoring constants for correct guessers.
 * Index 0 = 1st correct guess, 1 = 2nd, 2 = 3rd. 4th+ gets flat 50, no bonus.
 */
const GUESSER_BASE      = [100, 80, 60];
const GUESSER_MAX_BONUS = [50,  40, 40];

/**
 * Compute per-player point deltas for a completed round.
 *
 * Uses room.correctGuesses (ordered list of { playerId, guessedAt, name }) and
 * room.roundEndsAt (epoch-ms the drawing timer was set to expire) for time-bonus math.
 *
 * Scoring formula:
 *   Guesser rank i (0-indexed):
 *     base     = GUESSER_BASE[i]      (100 / 80 / 60 / 50 for 4th+)
 *     maxBonus = GUESSER_MAX_BONUS[i] (50 / 40 / 40 / 0 for 4th+)
 *     timeBonus = Math.round(maxBonus * (timeRemainingAtGuess / totalRoundDurationMs))
 *     earned  = base + timeBonus
 *   Drawer:
 *     earned = Math.min(100, 10 * correctGuesserCount)  — 0 if no one guessed
 *   Everyone else (non-guesser, non-drawer): 0 pts
 *
 * @param {object} room               — room state object
 * @param {number} totalRoundDurationMs — full draw-round length in ms
 * @returns {{
 *   scores: Array<{playerId: string, name: string, pointsEarned: number}>,
 *   guessScoreMap: Map<string, number>,
 *   drawerPoints: number
 * }}
 * `scores` is sorted descending by pointsEarned and includes all current room members
 * plus any disconnected correct guessers (name preserved at guess time).
 */
function computeRoundScores(room, totalRoundDurationMs) {
  const correctGuesses = room.correctGuesses ?? [];

  // Build a map: playerId → points earned (for guessers only)
  const guessScoreMap = new Map();
  for (let i = 0; i < correctGuesses.length; i++) {
    const guess    = correctGuesses[i];
    const base     = i < GUESSER_BASE.length      ? GUESSER_BASE[i]      : 50;
    const maxBonus = i < GUESSER_MAX_BONUS.length  ? GUESSER_MAX_BONUS[i] : 0;

    const timeRemaining = Math.max(0, (room.roundEndsAt ?? 0) - guess.guessedAt);
    const timeBonus =
      maxBonus > 0
        ? Math.round(maxBonus * (timeRemaining / totalRoundDurationMs))
        : 0;

    guessScoreMap.set(guess.playerId, base + timeBonus);
  }

  const drawerPoints = Math.min(100, 10 * correctGuesses.length);

  // Build the full scores list: current room members first …
  const included = new Set();
  const scores   = [];

  for (const [playerId, player] of room.players) {
    included.add(playerId);
    if (playerId === room.drawerId) {
      scores.push({ playerId, name: player.name, pointsEarned: drawerPoints });
    } else if (guessScoreMap.has(playerId)) {
      scores.push({ playerId, name: player.name, pointsEarned: guessScoreMap.get(playerId) });
    } else {
      scores.push({ playerId, name: player.name, pointsEarned: 0 });
    }
  }

  // … then any correct guesser who disconnected before the reveal (name stored at guess time)
  for (const guess of correctGuesses) {
    if (!included.has(guess.playerId)) {
      scores.push({
        playerId:     guess.playerId,
        name:         guess.name,
        pointsEarned: guessScoreMap.get(guess.playerId) ?? 0,
      });
    }
  }

  scores.sort((a, b) => b.pointsEarned - a.pointsEarned);

  return { scores, guessScoreMap, drawerPoints };
}

/**
 * Increment room.cyclesCompleted when the next drawer wraps back to index 0
 * in join order.  Called from startRound before assigning nextDrawer.
 */
function checkCycleCompleted(room, currentDrawerId) {
  const order = room.joinOrder.filter((id) => room.players.has(id));
  if (order.length === 0 || !currentDrawerId) return;

  const idx = order.indexOf(currentDrawerId);
  if (idx === -1) return;

  const nextIdx = (idx + 1) % order.length;
  if (nextIdx === 0) {
    room.cyclesCompleted++;
  }
}

function isGameFinished(room) {
  return room.cyclesCompleted >= 3;
}

module.exports = {
  computeRoundScores,
  checkCycleCompleted,
  isGameFinished,
};
