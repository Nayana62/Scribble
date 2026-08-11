import { ChatLog } from "./chat-log";
import { GuessForm } from "./guess-form";
import type { Player } from "@/types";

type Props = {
  role: "drawer" | "guesser" | null;
  players: Player[];
};

export function ChatPanel({ role, players }: Props) {
  return (
    <div className="flex flex-col h-full min-h-0 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
      <div className="bg-white/10 px-3 py-2 shrink-0">
        <span className="text-white font-bold text-sm tracking-wide">Chat</span>
      </div>
      <ChatLog players={players} />
      <GuessForm role={role} />
    </div>
  );
}
