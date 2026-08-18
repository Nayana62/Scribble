import { socket } from "@/socket";
import type { Player } from "@/types";

type Props = {
  players: Player[];
  hostId: string | null;
  drawerId: string | null;
};

export function PlayerList({ players, hostId, drawerId }: Props) {
  const currentSocketId = socket.id;

  return (
    <div className="flex flex-col h-full bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
      {/* Header */}
      <div className="bg-white/10 px-3 py-2 flex items-center justify-between shrink-0">
        <span className="text-white font-bold text-sm tracking-wide">Players</span>
        <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {players.length}/12
        </span>
      </div>

      {/* Player rows */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {players.map((player) => {
          const isYou = player.id === currentSocketId;
          const isHost = player.id === hostId;
          const isDrawer = player.id === drawerId;

          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                isYou
                  ? "bg-white/25 ring-1 ring-white/40"
                  : "bg-white/10 hover:bg-white/15"
              }`}
            >
              {/* Color Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-sm"
                style={{ backgroundColor: player.color }}
              >
                {player.name.charAt(0).toUpperCase()}
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span
                    className="font-semibold text-sm truncate max-w-[80px]"
                    style={{ color: player.color }}
                  >
                    {player.name}
                  </span>
                  {isYou && (
                    <span className="text-[9px] bg-white/20 text-white px-1 rounded font-bold uppercase">
                      you
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-white/60 font-mono">
                  {player.score} pts
                </div>
              </div>

              {/* Role icons — right side */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isHost && (
                  <span className="bg-blue-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider select-none">
                    Host
                  </span>
                )}
                {isDrawer && (
                  <span
                    title="Drawing now"
                    className="text-base leading-none select-none animate-pulse"
                  >
                    ✏️
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
