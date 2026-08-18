export type Player = {
  id: string;
  name: string;
  score: number;
  color: string;
};

export type Screen = "home" | "gameLobby" | "game" | "finished";

export type Role = "drawer" | "guesser";

export type RoomStatus = "waiting" | "in_progress";

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
  /** Epoch ms when the current round expires. Null-safe on the client. */
  endsAt: number | null;
};

export type RoundTimeoutPayload = {
  word: string;
};

export type StrokeReplayPayload = {
  strokes: Stroke[];
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
