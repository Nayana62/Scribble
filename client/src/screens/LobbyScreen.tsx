import { useState } from "react";
import { socket } from "../socket";
import { useGame } from "../state/GameContext";
import { HostBadge } from "../app/components/host-badge";

export function LobbyScreen() {
  const { state, leaveRoom } = useGame();
  const { roomId, players, hostId, isHost, noticeMsg } = state;
  const [copied, setCopied] = useState(false);

  const hostPlayer = players.find((p) => p.id === hostId);

  const copyRoomLink = () => {
    const clientBase =
      import.meta.env.VITE_CLIENT_URL || window.location.origin;
    const url = `${clientBase}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleStartGame = () => socket.emit("startGame");

  return (
    <div className="w-full h-dvh md:h-screen flex flex-col justify-center items-center p-4 gap-5">
      <h1 className="text-6xl sm:text-8xl font-semibold tracking-tight bg-gradient-to-r from-red-400 via-yellow-300 via-green-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent drop-shadow-xl select-none">
        scribble
      </h1>

      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-5 sm:p-7 w-full max-w-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold">
              Room Code
            </p>
            <p className="text-white font-black font-mono text-2xl tracking-widest">
              {roomId}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold">
              Players
            </p>
            <p className="text-white font-black text-2xl">
              {players.length}
              <span className="text-white/40 font-normal text-base">/12</span>
            </p>
          </div>
        </div>

        <button
          onClick={copyRoomLink}
          className={`w-full py-3 font-extrabold text-sm rounded-xl transition-all active:scale-95 ${
            copied
              ? "bg-emerald-500/80 text-white"
              : "bg-white/15 hover:bg-white/25 text-white border border-white/20"
          }`}
        >
          {copied ? "✓ Link Copied!" : "📋 Copy Invite Link"}
        </button>

        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {players.map((p) => {
            const isThisHost = p.id === hostId;
            const isYou = p.id === socket.id;
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span
                  className="font-semibold text-sm flex-1 truncate"
                  style={{ color: p.color }}
                >
                  {p.name}
                </span>
                {isYou && (
                  <span className="text-[9px] text-white/50 uppercase font-bold">
                    you
                  </span>
                )}
                 {isThisHost && (
                  <HostBadge />
                )}
              </div>
            );
          })}
        </div>

        {isHost ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              className={`w-full py-4 font-black text-lg rounded-xl transition-all active:scale-95 ${
                players.length >= 2
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-900/40"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              {players.length >= 2
                ? `▶ Start Game (${players.length}/12)`
                : `Waiting for players… (${players.length}/2 min)`}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <p className="text-white/70 text-sm text-center">
              Waiting for{" "}
              <span className="font-bold text-white">
                {hostPlayer?.name ?? "host"}
              </span>{" "}
              to start the game…
            </p>
          </div>
        )}

        <button
          onClick={leaveRoom}
          className="text-white/40 hover:text-white/70 text-[11px] text-center underline transition-colors cursor-pointer mt-1"
        >
          ← Leave Room & Back to Home
        </button>
      </div>

      {noticeMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-amber-500 text-gray-900 font-bold text-sm px-5 py-3 rounded-full shadow-xl animate-bounce max-w-xs text-center">
          {noticeMsg}
        </div>
      )}
    </div>
  );
}
