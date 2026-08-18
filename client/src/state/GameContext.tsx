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
  ActionReplayPayload,
  YourWordPayload,
  RoundEndPayload,
  RoundTimeoutPayload,
  WaitingForPlayersPayload,
  HostChangedPayload,
  NoticePayload,
  PlayerLeftPayload,
  GameFinishedPayload,
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
        endsAt: payload.endsAt ?? null,
      });
    });

    socket.on("roundTimeout", ({ word }: RoundTimeoutPayload) => {
      dispatch({ type: "ROUND_TIMEOUT", word });
      setTimeout(() => dispatch({ type: "CLEAR_ROUND_END" }), 2600);
    });

    socket.on("actionReplay", ({ actions }: ActionReplayPayload) => {
      dispatch({ type: "ACTION_REPLAY", actions });
    });

    socket.on("yourWord", ({ word }: YourWordPayload) => {
      dispatch({ type: "YOUR_WORD", word });
    });

    socket.on("roundEnd", ({ correctWord, winnerName }: RoundEndPayload) => {
      dispatch({ type: "ROUND_ENDED", correctWord, winnerName });
      setTimeout(() => dispatch({ type: "CLEAR_ROUND_END" }), 2600);
    });

    socket.on(
      "waitingForPlayers",
      ({ count, min, reason }: WaitingForPlayersPayload) => {
        dispatch({ type: "WAITING_FOR_PLAYERS" });
        if (reason === "player_left") {
          showNotice(
            `A player left — game paused. Need ${min} players to continue (${count}/${min}).`,
          );
        }
      },
    );

    socket.on(
      "hostChanged",
      ({ newHostId, newHostName }: HostChangedPayload) => {
        dispatch({
          type: "HOST_CHANGED",
          newHostId,
          socketId: socket.id,
        });
        showNotice(`👑 ${newHostName} is now the host.`);
      },
    );

    socket.on("notice", ({ message }: NoticePayload) => {
      showNotice(message, 3500);
    });

    socket.on("playerLeft", ({ name }: PlayerLeftPayload) => {
      showNotice(`${name} left the room.`, 3000);
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
      socket.off("actionReplay");
      socket.off("yourWord");
      socket.off("roundEnd");
      socket.off("roundTimeout");
      socket.off("waitingForPlayers");
      socket.off("hostChanged");
      socket.off("notice");
      socket.off("playerLeft");
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

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return ctx;
}
