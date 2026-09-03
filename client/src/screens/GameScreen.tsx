import { useEffect, useMemo, useState } from "react";
import { CanvasPhaseOverlays } from "../app/components/canvas-phase-overlays";
import Canvas from "../app/components/canvas";
import { ChatPanel } from "../app/components/chat-panel";
import { MobileChatInputRow } from "../app/components/mobile-chat-input-row";
import { PlayerList } from "../app/components/player-list";
import { WordStrip } from "../app/components/word-strip";
import { socket } from "../socket";
import { useGame } from "../state/GameContext";
import type { Role } from "../types";

/** Must stay in sync with ROUND_DURATION_SEC on the server (game/constants.js). */
const ROUND_DURATION_SEC = 80;

export function GameScreen() {
  const { state } = useGame();
  const {
    players,
    hostId,
    drawerId,
    wordLength,
    word,
    wordHint,
    replayActions,
    endsAt,
    roundPhase,
    choosingEndsAt,
    wordOptions,
    drawerName,
    cycleNumber,
    correctGuessers,
  } = state;

  const [inputBarHeight, setInputBarHeight] = useState(0);

  const isDrawer = socket.id === drawerId;
  const role: Role = isDrawer ? "drawer" : "guesser";

  const wordChars = useMemo(
    () => {
      const targetWord = isDrawer ? word : wordHint;
      return targetWord ? targetWord.split("") : [];
    },
    [isDrawer, word, wordHint],
  );

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("game-screen-active");
    window.scrollTo(0, 0);

    return () => {
      html.classList.remove("game-screen-active");
    };
  }, []);

  const canDraw = roundPhase === "drawing";

  const wordStripProps = {
    wordChars,
    wordLength,
    isDrawer,
    word,
    endsAt,
    durationSec: ROUND_DURATION_SEC,
    cycleNumber,
  };

  return (
    <div className="h-dvh md:h-screen w-full flex flex-col overflow-hidden overscroll-none">
      {/* Single grid — each panel mounts once and is repositioned between
          mobile/desktop via .game-grid's media query (see index.css),
          instead of duplicating every panel across two parallel trees. */}
      <div
        className={`game-grid flex-1 min-h-0 px-2 pt-2 md:p-3${
          isDrawer && canDraw ? " game-grid--toolbar" : ""
        }`}
        style={
          inputBarHeight > 0 ? { paddingBottom: inputBarHeight } : undefined
        }
      >
        <div className="game-grid__word">
          <WordStrip {...wordStripProps} />
        </div>

        <div className="game-grid__canvas">
          <Canvas role={role} replayActions={replayActions} canDraw={canDraw} />
          <CanvasPhaseOverlays
            roundPhase={roundPhase}
            choosingEndsAt={choosingEndsAt}
            cycleNumber={cycleNumber}
            isDrawer={isDrawer}
            wordOptions={wordOptions}
            drawerName={drawerName}
            roundResult={state.roundResult}
            myId={socket.id || ""}
          />
        </div>

        <div className="game-grid__players">
          <PlayerList players={players} hostId={hostId} drawerId={drawerId} correctGuessers={correctGuessers} />
        </div>

        <div className="game-grid__chat">
          <ChatPanel role={role} players={players} />
        </div>
      </div>

      <MobileChatInputRow role={role} onHeightChange={setInputBarHeight} />
    </div>
  );
}
