import type { RoundResultPayload } from "@/types";

type Props = {
  roundResult: RoundResultPayload;
  /** My socket ID — used to highlight the local player's row. */
  myId: string;
};

/**
 * RoundResultOverlay
 *
 * Shown for 5 seconds at the end of every round (allGuessed, timeout, or
 * drawerDisconnected).  Dismissed automatically when the next CHOOSING_STARTED /
 * NEW_CYCLE_ANNOUNCEMENT action clears `roundResult` from state.
 *
 * Layout mirrors the ChoosingOverlay / RoundAnnouncementOverlay style:
 *  - Full-canvas backdrop with blur
 *  - Centred glass card
 *  - Word reveal header
 *  - Sorted scores list (server already sorted descending)
 */
export function RoundResultOverlay({ roundResult, myId }: Props) {
  const { word, scores } = roundResult;

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 backdrop-blur-[3px] rounded-xl"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/20 bg-indigo-950/95 px-5 py-5 shadow-2xl">
        {/* ── Word reveal header ─────────────────────────────────────── */}
        <div className="text-center mb-4">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1">
            The word was
          </p>
          <p className="text-white font-black text-2xl sm:text-3xl tracking-tight capitalize">
            {word || "—"}
          </p>
        </div>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div className="border-t border-white/15 mb-3" />

        {/* ── Scores list ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
          {scores.map((entry, idx) => {
            const isFirst = idx === 0 && entry.pointsEarned > 0;
            const isMe = entry.playerId === myId;

            return (
              <div
                key={entry.playerId}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                  isFirst
                    ? "bg-amber-500/20 border border-amber-400/40"
                    : isMe
                      ? "bg-white/15 border border-white/25"
                      : "bg-white/8 border border-white/10"
                }`}
              >
                {/* Rank medal or position number */}
                <span className="text-base leading-none w-5 text-center shrink-0 select-none">
                  {idx === 0 && entry.pointsEarned > 0
                    ? "🥇"
                    : idx === 1 && entry.pointsEarned > 0
                      ? "🥈"
                      : idx === 2 && entry.pointsEarned > 0
                        ? "🥉"
                        : <span className="text-white/40 text-xs font-bold">{idx + 1}</span>}
                </span>

                {/* Player name */}
                <span
                  className={`flex-1 font-semibold text-sm truncate ${
                    isMe ? "text-blue-200" : "text-white/90"
                  }`}
                >
                  {entry.name}
                  {isMe && (
                    <span className="ml-1.5 text-[9px] bg-white/20 text-white px-1 py-0.5 rounded font-bold uppercase align-middle">
                      you
                    </span>
                  )}
                </span>

                {/* Points earned this round */}
                <span
                  className={`shrink-0 font-black text-sm tabular-nums ${
                    entry.pointsEarned > 0
                      ? isFirst
                        ? "text-amber-300"
                        : "text-emerald-300"
                      : "text-white/30"
                  }`}
                >
                  {entry.pointsEarned > 0 ? `+${entry.pointsEarned}` : "+0"}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Footer hint ────────────────────────────────────────────── */}
        <p className="text-center text-white/35 text-[10px] mt-3 select-none">
          Next round starting soon…
        </p>
      </div>
    </div>
  );
}
