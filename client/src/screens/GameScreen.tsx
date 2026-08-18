import { useEffect, useMemo, useState } from "react";
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
    replayActions,
    roundEndInfo,
    noticeMsg,
    endsAt,
  } = state;

  const [inputBarHeight, setInputBarHeight] = useState(0);

  const isDrawer = socket.id === drawerId;
  const role: Role = isDrawer ? "drawer" : "guesser";

  const wordChars = useMemo(
    () =>
      isDrawer && word
        ? word.split("")
        : Array.from({ length: wordLength }, () => "_"),
    [isDrawer, word, wordLength],
  );

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("game-screen-active");
    window.scrollTo(0, 0);

    return () => {
      html.classList.remove("game-screen-active");
    };
  }, []);

  const wordStripProps = {
    wordChars,
    wordLength,
    isDrawer,
    word,
    endsAt,
    durationSec: ROUND_DURATION_SEC,
  };

  return (
    <div className="h-dvh md:h-screen w-full flex flex-col overflow-hidden overscroll-none">
      {roundEndInfo && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white font-extrabold text-sm px-6 py-3 rounded-full shadow-2xl max-w-xs text-center">
          {roundEndInfo.winnerName
            ? `🎉 ${roundEndInfo.winnerName} guessed "${roundEndInfo.correctWord}"!`
            : `⏰ Time's up! The word was "${roundEndInfo.correctWord}".`}
        </div>
      )}

      {noticeMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-amber-400 text-gray-900 font-bold text-sm px-5 py-2.5 rounded-full shadow-xl max-w-xs text-center">
          {noticeMsg}
        </div>
      )}

      {/* Mobile: flex column — canvas grows, players/chat fixed height, no page scroll */}
      <div
        className="md:hidden gap-y-2 flex flex-col flex-1 min-h-0 overflow-hidden px-2 pt-2"
        style={
          inputBarHeight > 0 ? { paddingBottom: inputBarHeight } : undefined
        }
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-2">
          <WordStrip {...wordStripProps} />
          <div className="flex-1 min-h-0">
            <Canvas role={role} replayActions={replayActions} />
          </div>
        </div>

        <div className="shrink-0 h-[30vh] flex gap-x-2 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            <PlayerList players={players} hostId={hostId} drawerId={drawerId} />
          </div>
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            <ChatPanel role={role} players={players} />
          </div>
        </div>
      </div>

      {/* Desktop: 3-column grid */}
      <div className="hidden md:grid flex-1 min-h-0 p-3 grid-cols-12 gap-3 overflow-hidden">
        <div className="col-span-3 h-full min-h-0 overflow-hidden">
          <PlayerList players={players} hostId={hostId} drawerId={drawerId} />
        </div>

        <div className="col-span-6 min-h-0 flex flex-col gap-2 overflow-hidden h-full">
          <WordStrip {...wordStripProps} />
          <div className="flex-1 min-h-0">
            <Canvas role={role} replayActions={replayActions} />
          </div>
        </div>

        <div className="col-span-3 h-full min-h-0 overflow-hidden">
          <ChatPanel role={role} players={players} />
        </div>
      </div>

      <MobileChatInputRow role={role} onHeightChange={setInputBarHeight} />
    </div>
  );
}
