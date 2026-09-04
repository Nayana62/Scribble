const crypto = require("crypto");

const rooms = new Map();
const socketRoomMap = new Map();
// Reverse-lookup map (token → roomId) so `rejoin` doesn't need to scan all rooms.
const tokenRoomMap = new Map();

const ROOM_CAPACITY = 12;
const MIN_PLAYERS = 2;

const PLAYER_COLORS = [
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
  "#ef4444", // red
  "#f97316", // orange
];

function generateRoomId() {
  let id;
  do {
    id = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(id));
  return id;
}

function generateToken() {
  return crypto.randomUUID();
}

function assignColor(room) {
  const taken = new Set(Array.from(room.players.values()).map((p) => p.color));
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
    // Ordered log of drawing actions for the current round, used for late-joiner
    // replay. Entries: {type:'stroke',points,color,width} | {type:'fill',x,y,color} | {type:'clear'}.
    // Undo pops the last entry instead of appending.
    actionLog: [],
    usedWords: [],
    roundPhase: null, // 'announcement' | 'choosing' | 'drawing' | null
    choosingOptions: null, // server-only, never broadcast
    shouldResetUsedPoolOnLock: false,
    announcementCycleNumber: 0,
    // Ordered list of {playerId, guessedAt, name} for the active drawing round.
    // Cleared at the start of each drawing phase and when endRound fires.
    correctGuesses: [],
    // Epoch-ms the drawing timer expires — kept separately so computeRoundScores
    // can still calculate time-remaining bonuses after clearRoundTimer() runs.
    roundEndsAt: null,
    // Timer state itself lives in game/timer.js, keyed by roomId + kind.
  };
  rooms.set(roomId, room);
  return room;
}

module.exports = {
  rooms,
  socketRoomMap,
  tokenRoomMap,
  ROOM_CAPACITY,
  MIN_PLAYERS,
  PLAYER_COLORS,
  generateRoomId,
  generateToken,
  assignColor,
  getPlayersArray,
  initRoom,
};
