/**
 * Rank-based scoring constants for correct guessers.
 * Index 0 = 1st correct guess, 1 = 2nd, 2 = 3rd. 4th+ gets flat 50, no bonus.
 */
const GUESSER_BASE      = [100, 80, 60];
const GUESSER_MAX_BONUS = [50,  40, 40];

/**
 * Compute per-player point deltas for a completed round.
 *
 * Guesser rank i: base + round(maxBonus * timeRemainingAtGuess / totalRoundDurationMs).
 * Drawer: min(100, 10 * correctGuesserCount). Everyone else: 0.
 *
 * Returned `scores` is sorted descending and includes all current room members
 * plus any disconnected correct guessers (name preserved at guess time).
 */
function computeRoundScores(room, totalRoundDurationMs) {
  const correctGuesses = room.correctGuesses ?? [];

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

  // Include correct guessers who disconnected before the reveal.
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

// Increments room.cyclesCompleted when the next drawer wraps back to index 0
// in join order. Called from startRound before assigning nextDrawer.
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
