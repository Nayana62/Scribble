export type Player = {
  id: string;
  name: string;
  score: number;
  color: string;
};

export type Screen = "home" | "gameLobby" | "game" | "finished";

export type Role = "drawer" | "guesser";

export type RoomStatus = "waiting" | "in_progress" | "finished";

export type RoundPhase = "announcement" | "choosing" | "drawing";

/** A single point in a freehand stroke. */
export type Point = { x: number; y: number };

/**
 * An entry in the ordered round action log.
 * Used for late-joiner replay and undo-from-scratch.
 * NOTE: 'undo' is NOT an action log entry on the client — it removes one entry instead.
 */
export type DrawAction =
  | { type: "stroke"; points: Point[]; color: string; width: number }
  | { type: "fill"; x: number; y: number; color: string }
  | { type: "clear" };

/**
 * Live-preview stroke batch — the points accumulated since the last
 * animation-frame flush while the drawer is dragging, sent as one message
 * (instead of one message per raw pointermove event) for real-time rendering
 * on other clients. Carries color/width so receiving clients render it with
 * the correct style. `points` has at least 2 entries.
 */
export type StrokeBatch = {
  points: Point[];
  color: string;
  width: number;
};

/** @deprecated — kept for type reference; actual replay uses ActionReplayPayload */
export type Stroke = {
  prevX: number;
  prevY: number;
  x: number;
  y: number;
};

export type RoundEndInfo = {
  correctWord: string;
  winnerName: string;
};

/** A single player's point delta in the round-result overlay. */
export type RoundResultScore = {
  playerId: string;
  name: string;
  pointsEarned: number;
};

/** Payload for the `roundResult` socket event — replaces the old roundEnd / roundTimeout. */
export type RoundResultPayload = {
  /** The word that was being drawn. Empty string if drawer disconnected with no word. */
  word: string;
  /**
   * All players' point deltas for this round, sorted descending by pointsEarned.
   * Includes correct guessers, the drawer, zero-point non-guessers, and any
   * disconnected correct guessers whose name was captured at guess time.
   */
  scores: RoundResultScore[];
};

export type JoinedRoomSuccessPayload = {
  roomId: string;
  isHost: boolean;
  color: string;
  /** Opaque per-player-per-room identity token. Store in sessionStorage. */
  token: string;
};

export type PlayersUpdatePayload = {
  players: Player[];
  hostId: string | null;
  status: RoomStatus;
  drawerId: string | null;
};

export type RoundStartPayload = {
  drawerId: string;
  drawerName: string;
  wordLength: number;
  wordHint: string;
  /** Epoch ms when the current round expires. Null-safe on the client. */
  endsAt: number | null;
  cycleNumber: number;
};

export type ChoosingStartedPayload = {
  drawerId: string;
  drawerName: string;
  endsAt: number;
  /** Present for the drawer only — never sent to other clients. */
  options?: string[];
  /** Omitted for late joiners — show round announcement when true. */
  isNewCycle?: boolean;
  cycleNumber?: number;
};

export type RoundTimeoutPayload = {
  word: string;
};

/** Late-joiner full action log replay (replaces the old StrokeReplayPayload). */
export type ActionReplayPayload = {
  actions: DrawAction[];
};

export type YourWordPayload = {
  word: string;
};

/** @deprecated — server no longer emits `roundEnd`; use RoundResultPayload instead. */
export type RoundEndPayload = {
  correctWord: string;
  winnerName: string;
};

// For a correct guess the server sends two variants: the guesser gets
// isSelfConfirm with their text, everyone else gets isSystemGuess with no
// text (to avoid leaking the word).
export type GuessResultPayload = {
  text?: string;
  senderId: string;
  senderName: string;
  correct: boolean;
  /** True when sent only to the guesser themselves as their own confirmation. */
  isSelfConfirm?: boolean;
  /** True when sent to all OTHER players as a word-leak-safe system notification. */
  isSystemGuess?: boolean;
};

export type WaitingForPlayersPayload = {
  count: number;
  min: number;
  reason?: string;
};

export type HostChangedPayload = {
  newHostId: string;
  newHostName: string;
};

export type NoticePayload = {
  message: string;
};

export type PlayerLeftPayload = {
  name: string;
};

export type GameFinishedPayload = {
  players: Player[];
};

export type RankedGroup = {
  rank: number;
  score: number;
  players: Player[];
};

/**
 * Snapshot of room state returned by the server on a successful `rejoin` ack.
 * Used to hydrate the client from scratch after a reconnect.
 */
export type RoomSnapshot = {
  players: Player[];
  hostId: string | null;
  status: RoomStatus;
  drawerId: string | null;
  roundPhase: RoundPhase | null;
  wordLength: number | null;
  wordHint: string | null;
  endsAt: number | null;
  choosingEndsAt: number | null;
  cycleNumber: number | null;
};

/** Ack payload for the `rejoin` event. */
export type RejoinAckPayload =
  | { success: true; token: string; snapshot: RoomSnapshot }
  | { error: "ROOM_NOT_FOUND" | "PLAYER_NOT_FOUND" };
