function awardPoints(room, guesserId) {
  const guesser = room.players.get(guesserId);
  if (guesser) {
    guesser.score += 50;
  }
  const drawer = room.players.get(room.drawerId);
  if (drawer) {
    drawer.score += 20;
  }
}

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
  awardPoints,
  checkCycleCompleted,
  isGameFinished,
};
