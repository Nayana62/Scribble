import { Timer } from "./timer";

type Props = {
  wordChars: string[];
  wordLength: number;
  isDrawer: boolean;
  word: string | null;
  endsAt: number | null;
  durationSec: number;
  cycleNumber: number | null;
};

export function WordStrip({
  wordChars,
  wordLength,
  isDrawer,
  word,
  endsAt,
  durationSec,
  cycleNumber,
}: Props) {
  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 grid grid-cols-3 items-center shrink-0 h-16 select-none">
      {/* Left Column: Round Indicator */}
      <div className="flex flex-col items-start justify-center">
        <span className="text-white/40 text-[10px] sm:text-xs font-bold uppercase tracking-wider leading-none mb-1">
          Round
        </span>
        <span className="text-white font-black text-sm sm:text-base leading-none">
          {cycleNumber ?? 1}
        </span>
      </div>

      {/* Center Column: Word Display */}
      <div className="flex flex-col items-center justify-center text-center min-w-0">
        <span className="text-white/40 text-[10px] sm:text-xs font-bold uppercase tracking-wider leading-none mb-1 truncate w-full">
          {isDrawer ? "Draw this" : "Guess this"}
        </span>
        <div className="flex items-center gap-1 select-none flex-wrap justify-center max-w-full">
          {wordLength > 0 ? (
            wordChars.map((ch, i) => (
              <span
                key={i}
                className={`font-black font-mono text-xl sm:text-2xl leading-none whitespace-pre ${
                  ch === "_" ? "text-white/60 px-0.5 pb-0.5" : "text-white"
                }`}
              >
                {ch}
              </span>
            ))
          ) : (
            <span className="text-white/40 font-mono text-xl leading-none">—</span>
          )}
        </div>
      </div>

      {/* Right Column: Timer */}
      <div className="flex items-center justify-end">
        <Timer endsAt={endsAt} durationSec={durationSec} />
      </div>
    </div>
  );
}
