function nextDrawer(room) {
  const order = room.joinOrder.filter((id) => room.players.has(id));
  if (order.length === 0) return null;

  if (!room.drawerId) {
    return order[0];
  }

  const idx = order.indexOf(room.drawerId);
  if (idx === -1) {
    return order[0];
  }

  return order[(idx + 1) % order.length];
}

function reassignHost(room) {
  const active = room.joinOrder.filter((id) => room.players.has(id));
  room.hostId = active.length > 0 ? active[0] : null;
}

function getActiveJoinOrder(room) {
  return room.joinOrder.filter((id) => room.players.has(id));
}

/** True when the upcoming drawer is the first player in join order (start of a cycle). */
function isFirstTurnOfCycle(room, upcomingDrawerId) {
  const order = getActiveJoinOrder(room);
  return order.length > 0 && order[0] === upcomingDrawerId;
}

module.exports = {
  nextDrawer,
  reassignHost,
  getActiveJoinOrder,
  isFirstTurnOfCycle,
};
