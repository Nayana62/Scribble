import { useEffect, useState } from "react";
import { socket } from "../socket";
import type { NoticePayload } from "../types";

export function HomeScreen() {
  const [name, setName] = useState<string>(
    () => localStorage.getItem("scribble_name") || "",
  );
  const [joinCode, setJoinCode] = useState<string>("");
  const [urlRoomCode, setUrlRoomCode] = useState<string>("");
  const [homeError, setHomeError] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      const code = roomParam.trim().toUpperCase();
      setUrlRoomCode(code);
      setJoinCode(code);
    }
  }, []);

  useEffect(() => {
    const showHomeError = (msg: string) => {
      setHomeError(msg);
      setTimeout(() => setHomeError(""), 4000);
    };

    socket.on("roomNotFound", ({ message }: NoticePayload) => {
      showHomeError(message);
    });

    socket.on("roomFull", ({ message }: NoticePayload) => {
      showHomeError(message);
    });

    return () => {
      socket.off("roomNotFound");
      socket.off("roomFull");
    };
  }, []);

  const saveName = (val: string) => {
    setName(val);
    localStorage.setItem("scribble_name", val);
  };

  const showHomeError = (msg: string) => {
    setHomeError(msg);
    setTimeout(() => setHomeError(""), 4000);
  };

  const handleCreateRoom = () => {
    if (!name.trim()) {
      showHomeError("Enter your name first!");
      return;
    }
    socket.emit("createRoom", { name: name.trim() });
  };

  const handleJoinRoom = (code: string) => {
    if (!name.trim()) {
      showHomeError("Enter your name first!");
      return;
    }
    const clean = code.trim().toUpperCase();
    if (!clean) {
      showHomeError("Enter a room code!");
      return;
    }
    socket.emit("joinRoom", { roomId: clean, name: name.trim() });
  };

  const clearInviteLink = () => {
    setUrlRoomCode("");
    setJoinCode("");
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col justify-center items-center p-4 gap-6">
      <h1 className="text-6xl sm:text-8xl font-semibold tracking-tight bg-gradient-to-r from-red-400 via-yellow-300 via-green-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent drop-shadow-xl select-none">
        scribble
      </h1>

      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-sm flex flex-col gap-4">
        {urlRoomCode ? (
          <>
            <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-4 text-center">
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">
                You've been invited
              </p>
              <p className="text-white text-2xl font-black font-mono tracking-widest">
                {urlRoomCode}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-white/70 text-xs font-bold uppercase tracking-widest">
                Your Name
              </label>
              <input
                type="text"
                placeholder="Enter your name…"
                value={name}
                maxLength={16}
                autoFocus
                onChange={(e) => saveName(e.target.value)}
                className="bg-white/15 border border-white/25 text-white placeholder-white/35 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-blue-400/60"
              />
            </div>

            <button
              onClick={() => handleJoinRoom(urlRoomCode)}
              className="w-full py-4 bg-blue-500 hover:bg-blue-400 active:scale-95 text-white font-black text-lg rounded-xl transition-all shadow-lg"
            >
              JOIN ROOM
            </button>

            <button
              onClick={clearInviteLink}
              className="text-white/40 hover:text-white/70 text-xs text-center underline transition-colors"
            >
              ← Back to main menu
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-white/70 text-xs font-bold uppercase tracking-widest">
                Your Name
              </label>
              <input
                type="text"
                placeholder="Enter your name…"
                value={name}
                maxLength={16}
                onChange={(e) => saveName(e.target.value)}
                className="bg-white/15 border border-white/25 text-white placeholder-white/35 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-blue-400/60"
              />
            </div>

            <div className="flex flex-col gap-2 mt-1">
              <button
                onClick={handleCreateRoom}
                className="w-full py-4 bg-blue-500 hover:bg-blue-400 active:scale-95 text-white font-black text-base rounded-xl transition-all shadow-lg"
              >
                ✦ Create Room
              </button>

              <div className="flex items-center gap-2 text-white/30 text-xs">
                <div className="flex-1 h-px bg-white/15" />
                <span className="uppercase tracking-widest">or join</span>
                <div className="flex-1 h-px bg-white/15" />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ROOM CODE"
                  value={joinCode}
                  maxLength={8}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="flex-1 min-w-0 bg-white/15 border border-white/25 text-white placeholder-white/35 font-mono font-bold text-center tracking-widest rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-400/60 uppercase"
                />
                <button
                  onClick={() => handleJoinRoom(joinCode)}
                  className="bg-indigo-500 hover:bg-indigo-400 active:scale-95 text-white font-bold px-5 py-3 rounded-xl transition-all"
                >
                  Join
                </button>
              </div>
            </div>
          </>
        )}

        {homeError && (
          <p className="text-red-300 text-sm text-center font-semibold bg-red-900/30 border border-red-500/30 rounded-xl px-3 py-2">
            {homeError}
          </p>
        )}
      </div>

      <p className="text-white/20 text-xs">Draw. Guess. Win.</p>
    </div>
  );
}
