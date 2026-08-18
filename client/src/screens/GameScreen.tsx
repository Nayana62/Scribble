import { useMemo } from "react";
import Canvas from "../app/components/canvas";
import { ChatPanel } from "../app/components/chat-panel";
import { PlayerList } from "../app/components/player-list";
import { socket } from "../socket";
import { useGame } from "../state/GameContext";
import type { Role } from "../types";

export function GameScreen() {
  const { state } = useGame();
  const {
    players,
    hostId,
    drawerId,
    wordLength,
    word,
    replayStrokes,
    roundEndInfo,
    noticeMsg,
  } = state;

  const isDrawer = socket.id === drawerId;
  const role: Role = isDrawer ? "drawer" : "guesser";

  const wordChars = useMemo(
    () =>
      isDrawer && word
        ? word.split("")
        : Array.from({ length: wordLength }, () => "_"),
    [isDrawer, word, wordLength],
  );

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      {roundEndInfo && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white font-extrabold text-sm px-6 py-3 rounded-full shadow-2xl max-w-xs text-center">
          🎉 {roundEndInfo.winnerName} guessed &ldquo;{roundEndInfo.correctWord}
          &rdquo;!
        </div>
      )}

      {noticeMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-amber-400 text-gray-900 font-bold text-sm px-5 py-2.5 rounded-full shadow-xl max-w-xs text-center">
          {noticeMsg}
        </div>
      )}

      <div className="flex-1 min-h-0 p-2 md:p-3 grid grid-cols-12 gap-2 md:gap-3 overflow-hidden">
        <div className="col-span-6 order-2 md:col-span-3 md:order-1 h-[38vh] md:h-full min-h-0 overflow-hidden">
          <PlayerList players={players} hostId={hostId} drawerId={drawerId} />
        </div>

        <div className="col-span-12 order-1 md:col-span-6 md:order-2 min-h-0 flex flex-col gap-2 overflow-hidden h-[52vh] md:h-full">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2 flex items-center justify-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 select-none flex-wrap justify-center">
              {wordLength > 0 ? (
                wordChars.map((ch, i) => (
                  <span
                    key={i}
                    className={`font-black font-mono text-xl sm:text-2xl leading-none ${
                      ch === "_" ? "text-white/60 px-0.5 pb-0.5" : "text-white"
                    }`}
                  >
                    {ch}
                  </span>
                ))
              ) : (
                <span className="text-white/40 font-mono text-xl">—</span>
              )}
            </div>
            {isDrawer && word && (
              <span className="text-white/40 text-xs font-semibold uppercase tracking-widest shrink-0">
                your word
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0">
            <Canvas role={role} replayStrokes={replayStrokes} />
          </div>
        </div>

        <div className="col-span-6 order-3 md:col-span-3 md:order-3 h-[38vh] md:h-full min-h-0 overflow-hidden">
          <ChatPanel role={role} players={players} />
        </div>
      </div>
    </div>
  );
}
