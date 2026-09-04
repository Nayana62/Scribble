import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
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
  RejoinAckPayload,
} from "../types";
import {
  gameReducer,
  initialGameState,
  type Action,
  type GameState,
} from "./gameReducer";

// ── sessionStorage token helpers ───────────────────────────────────────────────

function tokenKey(roomId: string): string {
  return `scribble:token:${roomId}`;
}

function saveToken(roomId: string, token: string): void {
  try {
    sessionStorage.setItem(tokenKey(roomId), token);
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — ignore.
  }
}

function loadToken(roomId: string): string | null {
  try {
    return sessionStorage.getItem(tokenKey(roomId));
  } catch {
    return null;
  }
}

function clearToken(roomId: string): void {
  try {
    sessionStorage.removeItem(tokenKey(roomId));
  } catch {
    // ignore
  }
}

// ──────────────────────────────────────────────────────────────────────────────

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
  stateRef: React.RefObject<GameState>,
) {
  useEffect(() => {
    // Fires on initial connect AND on automatic Socket.IO reconnects.
    function handleConnect() {
      const roomId = stateRef.current.roomId;
      if (!roomId) return;

      const token = loadToken(roomId);
      if (!token) return;

      socket.emit("rejoin", { roomId, token }, (ack: RejoinAckPayload) => {
        if ("success" in ack && ack.success) {
          dispatch({
            type: "REJOIN_SUCCESS",
            roomId,
            snapshot: ack.snapshot,
            socketId: socket.id,
          });
          saveToken(roomId, ack.token);
        } else {
          clearToken(roomId);

          if ("error" in ack) {
            if (ack.error === "ROOM_NOT_FOUND") {
              showNotice("This room no longer exists.", 4000);
            } else if (ack.error === "PLAYER_NOT_FOUND") {
              showNotice("You were removed from the game.", 4000);
            }
          }

          dispatch({ type: "RESET_TO_HOME" });
        }
      });
    }

    function handleJoinedRoomSuccess(payload: JoinedRoomSuccessPayload) {
      dispatch({ type: "JOINED_ROOM_SUCCESS", ...payload });
      saveToken(payload.roomId, payload.token);
    }

    function handleRoomClosed({ reason }: { reason: string }) {
      const roomId = stateRef.current.roomId;
      if (roomId) clearToken(roomId);

      const messages: Record<string, string> = {
        empty: "The room was closed — no one reconnected in time.",
      };
      showNotice(messages[reason] ?? "This room was closed.", 5000);
      dispatch({ type: "ROOM_CLOSED" });
    }

    socket.on("connect", handleConnect);
    socket.on("joinedRoomSuccess", handleJoinedRoomSuccess);
    socket.on("roomClosed", handleRoomClosed);

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
      if (correct && senderId) {
        dispatch({ type: "CORRECT_GUESSER_ADDED", playerId: senderId });
      }
    });

    // Safety no-op: no longer emitted by the server, kept for version skew.
    socket.on("roundTimeout", () => {});

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
      socket.off("connect", handleConnect);
      socket.off("joinedRoomSuccess", handleJoinedRoomSuccess);
      socket.off("roomClosed", handleRoomClosed);
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
  }, [dispatch, showNotice, stateRef]);

  // `pagehide` fires on tab close, navigation, and mobile backgrounding.
  // Disconnecting immediately (rather than waiting on the heartbeat timeout)
  // gives near-instant mid-game departure detection.
  useEffect(() => {
    function handlePageHide() {
      if (stateRef.current.roomId) {
        socket.disconnect();
      }
    }
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [stateRef]);
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);

  // Always-current ref, used in socket handlers to avoid stale closures.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const showNotice = useCallback(
    (msg: string, durationMs = 4000) => {
      dispatch({ type: "SHOW_NOTICE", message: msg });
      setTimeout(() => dispatch({ type: "CLEAR_NOTICE" }), durationMs);
    },
    [dispatch],
  );

  const leaveRoom = useCallback(() => {
    const { roomId } = stateRef.current;

    const timeoutHandle = setTimeout(() => {
      showNotice("Couldn't reach the server — please try again.", 4000);
    }, 5000);

    socket.emit("leaveRoom", (ack: { success: boolean }) => {
      clearTimeout(timeoutHandle);
      if (ack?.success) {
        if (roomId) clearToken(roomId);
        dispatch({ type: "RESET_TO_HOME" });
        if (window.location.search) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        showNotice("Couldn't leave the room — please try again.", 4000);
      }
    });
  }, [dispatch, showNotice]);

  useGameSocketEvents(dispatch, showNotice, stateRef);

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
