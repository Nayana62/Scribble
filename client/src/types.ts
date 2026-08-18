export type Player = {
  id: string;
  name: string;
  score: number;
  color: string;
};

export type Screen = "home" | "gameLobby" | "game" | "finished";

export type Role = "drawer" | "guesser";

export type RoomStatus = "waiting" | "in_progress";

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
 * Extended live-preview stroke segment (emitted per mousemove for real-time rendering).
 * Carries color/width so receiving clients render it with the correct style.
 */
export type StrokeSegment = {
  prevX: number;
  prevY: number;
  x: number;
  y: number;
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

export type JoinedRoomSuccessPayload = {
  roomId: string;
  isHost: boolean;
  color: string;
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

export type RoundEndPayload = {
  correctWord: string;
  winnerName: string;
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
