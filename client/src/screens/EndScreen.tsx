import { useMemo, useState } from "react";
import { socket } from "../socket";
import { useGame } from "../state/GameContext";
import type { RankedGroup } from "../types";

export function EndScreen() {
  const { state, leaveRoom } = useGame();
  const { roomId, players } = state;
  const [playAgainError, setPlayAgainError] = useState<string>("");

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => b.score - a.score),
    [players],
  );

  const { firstPlace, secondPlace, thirdPlace } = useMemo(() => {
    const rankedGroups: RankedGroup[] = [];
    sortedPlayers.forEach((player) => {
      const existing = rankedGroups.find((g) => g.score === player.score);
      if (existing) {
        existing.players.push(player);
      } else {
        rankedGroups.push({
          rank: rankedGroups.length + 1,
          score: player.score,
          players: [player],
        });
      }
    });

    return {
      firstPlace: rankedGroups.find((g) => g.rank === 1),
      secondPlace: rankedGroups.find((g) => g.rank === 2),
      thirdPlace: rankedGroups.find((g) => g.rank === 3),
    };
  }, [sortedPlayers]);

  const handlePlayAgain = () => {
    setPlayAgainError("");
    const timeoutHandle = setTimeout(() => {
      setPlayAgainError("Server didn't respond — try again.");
    }, 5000);

    socket.emit("playAgain", (ack: { success?: boolean; error?: string }) => {
      clearTimeout(timeoutHandle);
      if (ack?.error === "NOT_HOST") {
        setPlayAgainError("Only the host can start a new game.");
      } else if (ack?.error === "INVALID_STATE") {
        setPlayAgainError("The game hasn't finished yet.");
      } else if (ack?.error) {
        setPlayAgainError("Something went wrong — try again.");
      }
      // On success the server broadcasts `playAgain` to all clients
      // which dispatches PLAY_AGAIN in the reducer — no extra handling needed here.
    });
  };

  return (
    <div className="w-full h-dvh md:h-screen flex flex-col items-center justify-center p-4 gap-5 overflow-hidden">
      <div className="text-center shrink-0">
        <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-wider drop-shadow-md">
          Game Finished!
        </h1>
        <p className="text-white/60 text-xs sm:text-sm mt-1">
          Here are the final standings of room{" "}
          <span className="font-mono font-bold text-white">{roomId}</span>
        </p>
      </div>

      <div className="flex items-end justify-center gap-4 sm:gap-6 mt-4 w-full max-w-sm shrink-0 px-2">
        {secondPlace ? (
          <div className="flex flex-col items-center flex-1">
            <div className="text-center mb-2 min-h-12 flex flex-col justify-end">
              {secondPlace.players.map((p) => (
                <span
                  key={p.id}
                  className="font-bold text-sm block truncate max-w-20"
                  style={{ color: p.color }}
                >
                  {p.name}
                </span>
              ))}
              <span className="text-slate-300 font-mono text-[10px] font-semibold">
                {secondPlace.score} pts
              </span>
            </div>
            <div className="w-full bg-slate-400/25 border-t border-x border-slate-300/30 rounded-t-xl h-24 flex flex-col items-center justify-center shadow-lg backdrop-blur-xs">
              <span className="text-3xl font-extrabold text-slate-300">2</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                Silver
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {firstPlace ? (
          <div className="flex flex-col items-center flex-1">
            <div className="text-center mb-2 min-h-[48px] flex flex-col justify-end items-center">
              <span className="text-xl animate-bounce mb-1">👑</span>
              {firstPlace.players.map((p) => (
                <span
                  key={p.id}
                  className="font-black text-base block truncate max-w-[90px]"
                  style={{ color: p.color }}
                >
                  {p.name}
                </span>
              ))}
              <span className="text-yellow-300 font-mono text-[10px] font-bold">
                {firstPlace.score} pts
              </span>
            </div>
            <div className="w-full bg-yellow-500/25 border-t-2 border-x border-yellow-300/40 rounded-t-xl h-32 flex flex-col items-center justify-center shadow-xl backdrop-blur-xs">
              <span className="text-4xl font-black text-yellow-300 drop-shadow-md">
                1
              </span>
              <span className="text-[9px] text-yellow-400 font-extrabold uppercase tracking-widest mt-1">
                Winner
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {thirdPlace ? (
          <div className="flex flex-col items-center flex-1">
            <div className="text-center mb-2 min-h-[48px] flex flex-col justify-end">
              {thirdPlace.players.map((p) => (
                <span
                  key={p.id}
                  className="font-bold text-xs block truncate max-w-[80px]"
                  style={{ color: p.color }}
                >
                  {p.name}
                </span>
              ))}
              <span className="text-amber-500 font-mono text-[10px] font-semibold">
                {thirdPlace.score} pts
              </span>
            </div>
            <div className="w-full bg-amber-700/25 border-t border-x border-amber-500/30 rounded-t-xl h-20 flex flex-col items-center justify-center shadow-md backdrop-blur-xs">
              <span className="text-2xl font-extrabold text-amber-500">3</span>
              <span className="text-[9px] text-amber-600/80 font-bold uppercase tracking-widest mt-1">
                Bronze
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      <div className="w-full max-w-sm bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-hidden shadow-2xl">
        <h2 className="text-white font-bold text-center text-xs uppercase tracking-widest shrink-0">
          Final Scoreboard
        </h2>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {sortedPlayers.map((player, index) => {
            const isYou = player.id === socket.id;
            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                  isYou
                    ? "bg-white/20 ring-1 ring-white/35"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <span className="text-xs font-bold text-white/50 w-4 font-mono">
                  #{index + 1}
                </span>

                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: player.color }}
                >
                  {player.name.charAt(0).toUpperCase()}
                </div>

                <span
                  className="font-bold text-sm flex-1 truncate"
                  style={{ color: player.color }}
                >
                  {player.name}
                  {isYou && (
                    <span className="ml-1.5 text-[8px] bg-white/20 text-white font-black px-1.5 py-0.5 rounded uppercase">
                      you
                    </span>
                  )}
                </span>

                <span className="text-white font-mono font-bold text-sm">
                  {player.score} pts
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 w-full max-w-sm shrink-0 flex-col">
        <div className="flex gap-3">
          <button
            onClick={handlePlayAgain}
            className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-950/20 cursor-pointer"
          >
            🔄 Play Again
          </button>
          <button
            onClick={leaveRoom}
            className="flex-1 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 active:scale-95 text-white font-black text-sm rounded-xl transition-all cursor-pointer"
          >
            🏠 Home Menu
          </button>
        </div>
        {playAgainError && (
          <p className="text-red-300 text-xs text-center font-semibold bg-red-900/30 border border-red-500/30 rounded-xl px-3 py-2">
            {playAgainError}
          </p>
        )}
      </div>
    </div>
  );
}
