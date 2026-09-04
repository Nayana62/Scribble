import type {
  Player,
  Screen,
  RoomStatus,
  RoundPhase,
  DrawAction,
  RoundResultPayload,
  RoomSnapshot,
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
  wordHint: string;
  /** Full ordered action log for late-joiner canvas replay. */
  replayActions: DrawAction[];
  /** Payload for the 5-second round-result overlay; null when no overlay is active. */
  roundResult: RoundResultPayload | null;
  noticeMsg: string;
  /** Epoch ms when the current round expires. Null when no round is active. */
  endsAt: number | null;
  /** Current in-round phase — null between rounds / in lobby. */
  roundPhase: RoundPhase | null;
  /** Epoch ms when the choosing phase expires. Null during drawing / between rounds. */
  choosingEndsAt: number | null;
  /** Drawer-only word options during choosing phase. */
  wordOptions: string[];
  /** True at cycle boundaries — triggers "Round N" announcement before choosing UI. */
  isNewCycle: boolean;
  cycleNumber: number | null;
  /** IDs of players who have guessed correctly in the current drawing round. */
  correctGuessers: string[];
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
  wordHint: "",
  replayActions: [],
  roundResult: null,
  noticeMsg: "",
  endsAt: null,
  roundPhase: null,
  choosingEndsAt: null,
  wordOptions: [],
  isNewCycle: false,
  cycleNumber: null,
  correctGuessers: [],
};

export type Action =
  | {
      type: "JOINED_ROOM_SUCCESS";
      roomId: string;
      isHost: boolean;
      color: string;
    }
  | {
      type: "PLAYERS_UPDATED";
      players: Player[];
      hostId: string | null;
      status: RoomStatus;
      drawerId: string | null;
      socketId: string | undefined;
    }
  | {
      type: "NEW_CYCLE_ANNOUNCEMENT";
      cycleNumber: number;
    }
  | {
      type: "CHOOSING_STARTED";
      drawerId: string;
      drawerName: string;
      endsAt: number;
      options?: string[];
      isNewCycle?: boolean;
      cycleNumber?: number;
    }
  | {
      type: "ROUND_STARTED";
      drawerId: string;
      drawerName: string;
      wordLength: number;
      wordHint: string;
      endsAt: number | null;
      cycleNumber: number;
    }
  | { type: "ACTION_REPLAY"; actions: DrawAction[] }
  | { type: "YOUR_WORD"; word: string }
  | { type: "ROUND_RESULT"; word: string; scores: RoundResultPayload["scores"] }
  | { type: "CORRECT_GUESSER_ADDED"; playerId: string }
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
  | { type: "RESET_TO_HOME" }
  | {
      /** Hydrate entire client state from server snapshot after a successful rejoin. */
      type: "REJOIN_SUCCESS";
      roomId: string;
      snapshot: RoomSnapshot;
      socketId: string | undefined;
    }
  | {
      /** Server closed the room (grace period expired or explicit close). */
      type: "ROOM_CLOSED";
    };

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

    case "NEW_CYCLE_ANNOUNCEMENT":
      return {
        ...state,
        roundPhase: "announcement",
        cycleNumber: action.cycleNumber,
        isNewCycle: true,
        choosingEndsAt: null,
        wordOptions: [],
        word: "",
        wordHint: "",
        wordLength: 0,
        endsAt: null,
        roundResult: null,
        correctGuessers: [],
        replayActions: [],
        roomStatus: "in_progress",
        screen: "game",
      };

    case "CHOOSING_STARTED":
      return {
        ...state,
        drawerId: action.drawerId,
        drawerName: action.drawerName,
        roundPhase: "choosing",
        choosingEndsAt: action.endsAt,
        wordOptions: action.options ?? [],
        isNewCycle: false,
        cycleNumber: action.cycleNumber ?? state.cycleNumber,
        word: "",
        wordLength: 0,
        wordHint: "",
        endsAt: null,
        roundResult: null,
        correctGuessers: [],
        replayActions: [],
        roomStatus: "in_progress",
        screen: "game",
      };

    case "ROUND_STARTED":
      return {
        ...state,
        drawerId: action.drawerId,
        drawerName: action.drawerName,
        wordLength: action.wordLength,
        wordHint: action.wordHint,
        word: "",
        roundPhase: "drawing",
        choosingEndsAt: null,
        wordOptions: [],
        isNewCycle: false,
        cycleNumber: action.cycleNumber,
        roundResult: null,
        correctGuessers: [],
        roomStatus: "in_progress",
        replayActions: [],
        screen: "game",
        endsAt: action.endsAt,
      };

    case "ACTION_REPLAY":
      return { ...state, replayActions: action.actions };

    case "YOUR_WORD":
      return {
        ...state,
        word: action.word,
        wordLength: action.word.length,
        wordHint: action.word,
      };

    case "ROUND_RESULT":
      return {
        ...state,
        endsAt: null,
        roundPhase: null,
        choosingEndsAt: null,
        wordOptions: [],
        isNewCycle: false,
        // Keep correctGuessers visible during the overlay so player-list checkmarks stay.
        roundResult: { word: action.word, scores: action.scores },
      };

    case "CORRECT_GUESSER_ADDED":
      // Deduplicate — server guarantees idempotency but be safe.
      if (state.correctGuessers.includes(action.playerId)) return state;
      return {
        ...state,
        correctGuessers: [...state.correctGuessers, action.playerId],
      };

    case "WAITING_FOR_PLAYERS":
      return {
        ...state,
        roomStatus: "waiting",
        drawerId: null,
        word: "",
        wordLength: 0,
        wordHint: "",
        screen: "gameLobby",
        endsAt: null,
        roundPhase: null,
        choosingEndsAt: null,
        wordOptions: [],
        isNewCycle: false,
        cycleNumber: null,
        roundResult: null,
        correctGuessers: [],
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
        endsAt: null,
        roundPhase: null,
        choosingEndsAt: null,
        wordOptions: [],
        isNewCycle: false,
        cycleNumber: null,
        roundResult: null,
        correctGuessers: [],
      };

    case "PLAY_AGAIN":
      return {
        ...state,
        screen: "gameLobby",
        roomStatus: "waiting",
        drawerId: null,
        word: "",
        wordLength: 0,
        wordHint: "",
        endsAt: null,
        roundPhase: null,
        choosingEndsAt: null,
        wordOptions: [],
        isNewCycle: false,
        cycleNumber: null,
        roundResult: null,
        correctGuessers: [],
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
        wordHint: "",
        endsAt: null,
        roundPhase: null,
        choosingEndsAt: null,
        wordOptions: [],
        isNewCycle: false,
        cycleNumber: null,
        roundResult: null,
        correctGuessers: [],
      };

    case "REJOIN_SUCCESS": {
      const { snapshot, socketId } = action;
      // Determine which screen the player should land on based on room status.
      let screen: Screen = "gameLobby";
      if (snapshot.status === "in_progress") screen = "game";
      else if (snapshot.status === "finished") screen = "finished";

      const isHost = !!(socketId && snapshot.hostId && socketId === snapshot.hostId);

      return {
        ...state,
        roomId: action.roomId,
        screen,
        isHost,
        hostId: snapshot.hostId,
        players: snapshot.players,
        drawerId: snapshot.drawerId,
        roomStatus: snapshot.status,
        roundPhase: snapshot.roundPhase,
        wordLength: snapshot.wordLength ?? 0,
        wordHint: snapshot.wordHint ?? "",
        endsAt: snapshot.endsAt,
        choosingEndsAt: snapshot.choosingEndsAt,
        cycleNumber: snapshot.cycleNumber,
        // Clear transient state that the server will re-push via events.
        word: "",
        replayActions: [],
        roundResult: null,
        correctGuessers: [],
        isNewCycle: false,
        wordOptions: [],
      };
    }

    case "ROOM_CLOSED":
      return {
        ...initialGameState,
      };

    default:
      return state;
  }
}
