import { Timer } from "./timer";

type Props = {
  wordChars: string[];
  wordLength: number;
  isDrawer: boolean;
  word: string | null;
  endsAt: number | null;
  durationSec: number;
};

export function WordStrip({
  wordChars,
  wordLength,
  isDrawer,
  word,
  endsAt,
  durationSec,
}: Props) {
  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-1.5 select-none flex-wrap">
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
        {isDrawer && word && (
          <span className="text-white/40 text-xs font-semibold uppercase tracking-widest ml-2 shrink-0">
            your word
          </span>
        )}
      </div>

      <Timer endsAt={endsAt} durationSec={durationSec} />
    </div>
  );
}
