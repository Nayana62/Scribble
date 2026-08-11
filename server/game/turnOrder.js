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

module.exports = {
  nextDrawer,
  reassignHost,
};
