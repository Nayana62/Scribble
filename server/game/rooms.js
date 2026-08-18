const crypto = require("crypto");

const rooms = new Map();
const socketRoomMap = new Map();

const ROOM_CAPACITY = 12;
const MIN_PLAYERS = 2;

const PLAYER_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#10b981", // emerald
  "#6366f1", // indigo
];

function generateRoomId() {
  let id;
  do {
    id = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(id));
  return id;
}

function assignColor(room) {
  const taken = new Set(
    Array.from(room.players.values()).map((p) => p.color)
  );
  return PLAYER_COLORS.find((c) => !taken.has(c)) ?? PLAYER_COLORS[0];
}

function getPlayersArray(room) {
  return Array.from(room.players.values());
}

function initRoom(roomId, hostId) {
  const room = {
    hostId,
    players: new Map(),
    joinOrder: [hostId],
    drawerId: null,
    word: null,
    wordLength: 0,
    status: "waiting",
    cyclesCompleted: 0,
    /**
     * Ordered log of all drawing actions for the current round.
     * Entries: { type:'stroke', points, color, width } | { type:'fill', x, y, color } | { type:'clear' }
     * Used for late-joiner canvas replay. Undo pops the last entry instead of appending.
     */
    actionLog: [],
    // Round timer state is managed externally in game/timer.js (keyed by roomId).
  };
  rooms.set(roomId, room);
  return room;
}

module.exports = {
  rooms,
  socketRoomMap,
  ROOM_CAPACITY,
  MIN_PLAYERS,
  PLAYER_COLORS,
  generateRoomId,
  assignColor,
  getPlayersArray,
  initRoom,
};
