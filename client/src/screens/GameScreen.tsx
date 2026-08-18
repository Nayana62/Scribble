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

  const canvasBlock = (
    <div className="flex-1 min-h-0 relative">
      <Canvas
        role={role}
        replayActions={replayActions}
        canDraw={canDraw}
      />
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
  );

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
      {/* Mobile: flex column — canvas grows, players/chat fixed height, no page scroll */}
      <div
        className="md:hidden gap-y-2 flex flex-col flex-1 min-h-0 overflow-hidden px-2 pt-2"
        style={
          inputBarHeight > 0 ? { paddingBottom: inputBarHeight } : undefined
        }
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-2">
          <WordStrip {...wordStripProps} />
          {canvasBlock}
        </div>

        <div className="shrink-0 h-[30vh] flex gap-x-2 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            <PlayerList players={players} hostId={hostId} drawerId={drawerId} correctGuessers={correctGuessers} />
          </div>
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            <ChatPanel role={role} players={players} />
          </div>
        </div>
      </div>

      {/* Desktop: 3-column grid */}
      <div className="hidden md:grid flex-1 min-h-0 p-3 grid-cols-12 gap-3 overflow-hidden">
        <div className="col-span-3 h-full min-h-0 overflow-hidden">
          <PlayerList players={players} hostId={hostId} drawerId={drawerId} correctGuessers={correctGuessers} />
        </div>

        <div className="col-span-6 min-h-0 flex flex-col gap-2 overflow-hidden h-full">
          <WordStrip {...wordStripProps} />
          {canvasBlock}
        </div>

        <div className="col-span-3 h-full min-h-0 overflow-hidden">
          <ChatPanel role={role} players={players} />
        </div>
      </div>

      <MobileChatInputRow role={role} onHeightChange={setInputBarHeight} />
    </div>
  );
}
