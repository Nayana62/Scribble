import type {
  Player,
  Screen,
  RoomStatus,
  Stroke,
  RoundEndInfo,
} from "../types";

export type GameState = {
  screen: Screen;
  roomId: string;
  isHost: boolean;
  hostId: string | null;
  players: Player[];
  myColor: string;
  drawerId: string | null;
  drawerName: string;
  roomStatus: RoomStatus;
  word: string;
  wordLength: number;
  replayStrokes: Stroke[];
  roundEndInfo: RoundEndInfo | null;
  noticeMsg: string;
};

export const initialGameState: GameState = {
  screen: "home",
  roomId: "",
  isHost: false,
  hostId: null,
  players: [],
  myColor: "#3b82f6",
  drawerId: null,
  drawerName: "",
  roomStatus: "waiting",
  word: "",
  wordLength: 0,
  replayStrokes: [],
  roundEndInfo: null,
  noticeMsg: "",
};

export type Action =
  | { type: "JOINED_ROOM_SUCCESS"; roomId: string; isHost: boolean; color: string }
  | {
      type: "PLAYERS_UPDATED";
      players: Player[];
      hostId: string | null;
      status: RoomStatus;
      drawerId: string | null;
      socketId: string | undefined;
    }
  | {
      type: "ROUND_STARTED";
      drawerId: string;
      drawerName: string;
      wordLength: number;
    }
  | { type: "STROKE_REPLAY"; strokes: Stroke[] }
  | { type: "YOUR_WORD"; word: string }
  | { type: "ROUND_ENDED"; correctWord: string; winnerName: string }
  | { type: "CLEAR_ROUND_END" }
  | { type: "WAITING_FOR_PLAYERS" }
  | {
      type: "HOST_CHANGED";
      newHostId: string;
      socketId: string | undefined;
    }
  | { type: "SHOW_NOTICE"; message: string }
  | { type: "CLEAR_NOTICE" }
  | { type: "GAME_FINISHED"; players: Player[] }
  | { type: "PLAY_AGAIN" }
  | { type: "RESET_TO_HOME" };

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "JOINED_ROOM_SUCCESS":
      return {
        ...state,
        roomId: action.roomId,
        isHost: action.isHost,
        myColor: action.color,
        screen: "gameLobby",
      };

    case "PLAYERS_UPDATED": {
      const next: GameState = {
        ...state,
        players: action.players,
        hostId: action.hostId,
        roomStatus: action.status,
        drawerId: action.drawerId,
      };
      if (action.socketId && action.hostId) {
        next.isHost = action.socketId === action.hostId;
      }
      if (action.status === "in_progress") {
        next.screen = "game";
      }
      return next;
    }

    case "ROUND_STARTED":
      return {
        ...state,
        drawerId: action.drawerId,
        drawerName: action.drawerName,
        wordLength: action.wordLength,
        word: "",
        roundEndInfo: null,
        roomStatus: "in_progress",
        replayStrokes: [],
        screen: "game",
      };

    case "STROKE_REPLAY":
      return { ...state, replayStrokes: action.strokes };

    case "YOUR_WORD":
      return {
        ...state,
        word: action.word,
        wordLength: action.word.length,
      };

    case "ROUND_ENDED":
      return {
        ...state,
        roundEndInfo: {
          correctWord: action.correctWord,
          winnerName: action.winnerName,
        },
      };

    case "CLEAR_ROUND_END":
      return { ...state, roundEndInfo: null };

    case "WAITING_FOR_PLAYERS":
      return {
        ...state,
        roomStatus: "waiting",
        drawerId: null,
        word: "",
        wordLength: 0,
        screen: "gameLobby",
      };

    case "HOST_CHANGED": {
      const next: GameState = { ...state, hostId: action.newHostId };
      if (action.socketId === action.newHostId) {
        next.isHost = true;
      }
      return next;
    }

    case "SHOW_NOTICE":
      return { ...state, noticeMsg: action.message };

    case "CLEAR_NOTICE":
      return { ...state, noticeMsg: "" };

    case "GAME_FINISHED":
      return {
        ...state,
        players: action.players,
        screen: "finished",
      };

    case "PLAY_AGAIN":
      return {
        ...state,
        screen: "gameLobby",
        roomStatus: "waiting",
        drawerId: null,
        word: "",
        wordLength: 0,
      };

    case "RESET_TO_HOME":
      return {
        ...state,
        screen: "home",
        roomId: "",
        isHost: false,
        hostId: null,
        players: [],
        drawerId: null,
        word: "",
        wordLength: 0,
      };

    default:
      return state;
  }
}
