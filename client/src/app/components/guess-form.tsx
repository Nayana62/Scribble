import { socket } from "@/socket";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";

type Props = { role: "drawer" | "guesser" | null };

export const GuessForm = ({ role }: Props) => {
  const [guessInput, setGuessInput] = useState("");
  const [blockedMsg, setBlockedMsg] = useState("");

  useEffect(() => {
    const handleBlocked = () => {
      setBlockedMsg("You can't send the answer — that gives it away!");
      setTimeout(() => setBlockedMsg(""), 2500);
    };
    socket.on("guessBlocked", handleBlocked);
    return () => {
      socket.off("guessBlocked", handleBlocked);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!guessInput.trim()) return;
    socket.emit("submitGuess", { text: guessInput });
    setGuessInput("");
  };

  return (
    <div className="shrink-0 p-2 border-t border-white/15">
      {blockedMsg && (
        <p className="text-red-300 text-xs mb-1 font-semibold">{blockedMsg}</p>
      )}
      <form className="flex gap-1.5" onSubmit={handleSubmit}>
        <input
          type="text"
          value={guessInput}
          placeholder={role === "drawer" ? "Chat..." : "Type your guess…"}
          maxLength={60}
          onChange={(e) => setGuessInput(e.target.value)}
          className="flex-1 min-w-0 bg-white/15 text-white placeholder-white/40 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400/60 border border-white/20"
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm px-3 py-2 rounded-lg transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
