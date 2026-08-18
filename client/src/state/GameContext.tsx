import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import { socket } from "../socket";
import type {
  JoinedRoomSuccessPayload,
  PlayersUpdatePayload,
  RoundStartPayload,
  ChoosingStartedPayload,
  ActionReplayPayload,
  YourWordPayload,
  RoundResultPayload,
  // WaitingForPlayersPayload,
  HostChangedPayload,
  NoticePayload,
  GameFinishedPayload,
  GuessResultPayload,
} from "../types";
import {
  gameReducer,
  initialGameState,
  type Action,
  type GameState,
} from "./gameReducer";

type GameContextValue = {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  showNotice: (msg: string, durationMs?: number) => void;
  leaveRoom: () => void;
};

const GameContext = createContext<GameContextValue | null>(null);

function useGameSocketEvents(
  dispatch: React.Dispatch<Action>,
  showNotice: (msg: string, durationMs?: number) => void,
) {
  useEffect(() => {
    socket.on("joinedRoomSuccess", (payload: JoinedRoomSuccessPayload) => {
      dispatch({ type: "JOINED_ROOM_SUCCESS", ...payload });
    });

    socket.on("playersUpdate", (payload: PlayersUpdatePayload) => {
      dispatch({
        type: "PLAYERS_UPDATED",
        ...payload,
        socketId: socket.id,
      });
    });

    socket.on("roundStart", (payload: RoundStartPayload) => {
      dispatch({
        type: "ROUND_STARTED",
        drawerId: payload.drawerId,
        drawerName: payload.drawerName,
        wordLength: payload.wordLength,
        wordHint: payload.wordHint,
        endsAt: payload.endsAt ?? null,
        cycleNumber: payload.cycleNumber,
      });
    });

    socket.on("newCycleAnnouncement", (payload: { cycleNumber: number }) => {
      dispatch({
        type: "NEW_CYCLE_ANNOUNCEMENT",
        cycleNumber: payload.cycleNumber,
      });
    });

    socket.on("choosingStarted", (payload: ChoosingStartedPayload) => {
      dispatch({
        type: "CHOOSING_STARTED",
        drawerId: payload.drawerId,
        drawerName: payload.drawerName,
        endsAt: payload.endsAt,
        options: payload.options,
        isNewCycle: payload.isNewCycle,
        cycleNumber: payload.cycleNumber,
      });
    });

    socket.on("actionReplay", ({ actions }: ActionReplayPayload) => {
      dispatch({ type: "ACTION_REPLAY", actions });
    });

    socket.on("yourWord", ({ word }: YourWordPayload) => {
      dispatch({ type: "YOUR_WORD", word });
    });

    socket.on("roundResult", ({ word, scores }: RoundResultPayload) => {
      dispatch({ type: "ROUND_RESULT", word, scores });
    });

    socket.on("guessResult", ({ senderId, correct }: GuessResultPayload) => {
      // Track which players have guessed correctly so the player list can show checkmarks.
      if (correct && senderId) {
        dispatch({ type: "CORRECT_GUESSER_ADDED", playerId: senderId });
      }
    });

    socket.on("roundTimeout", () => {
      // roundTimeout is no longer emitted by the server; this handler is a safety no-op
      // kept here to prevent unhandled-event warnings during a server/client version skew.
    });

    socket.on("waitingForPlayers", () => {
      dispatch({ type: "WAITING_FOR_PLAYERS" });
    });

    socket.on("hostChanged", ({ newHostId }: HostChangedPayload) => {
      dispatch({
        type: "HOST_CHANGED",
        newHostId,
        socketId: socket.id,
      });
    });

    socket.on("notice", ({ message }: NoticePayload) => {
      showNotice(message, 3500);
    });

    socket.on("gameFinished", ({ players }: GameFinishedPayload) => {
      dispatch({ type: "GAME_FINISHED", players });
    });

    socket.on("playAgain", () => {
      dispatch({ type: "PLAY_AGAIN" });
    });

    return () => {
      socket.off("joinedRoomSuccess");
      socket.off("playersUpdate");
      socket.off("roundStart");
      socket.off("newCycleAnnouncement");
      socket.off("choosingStarted");
      socket.off("actionReplay");
      socket.off("yourWord");
      socket.off("roundResult");
      socket.off("guessResult");
      socket.off("roundTimeout");
      socket.off("waitingForPlayers");
      socket.off("hostChanged");
      socket.off("notice");
      socket.off("gameFinished");
      socket.off("playAgain");
    };
  }, [dispatch, showNotice]);
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);

  const showNotice = useCallback(
    (msg: string, durationMs = 4000) => {
      dispatch({ type: "SHOW_NOTICE", message: msg });
      setTimeout(() => dispatch({ type: "CLEAR_NOTICE" }), durationMs);
    },
    [dispatch],
  );

  const leaveRoom = useCallback(() => {
    socket.emit("leaveRoom");
    dispatch({ type: "RESET_TO_HOME" });
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [dispatch]);

  useGameSocketEvents(dispatch, showNotice);

  return (
    <GameContext.Provider value={{ state, dispatch, showNotice, leaveRoom }}>
      {children}
    </GameContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return ctx;
}
