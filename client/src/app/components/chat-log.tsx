import { socket } from "@/socket";
import { useEffect, useRef, useState } from "react";
import type { Player } from "@/types";

type LogEntry = {
  id: string;
  type: "chat" | "guess" | "system" | "round_end";
  text: string;
  senderId?: string;
  senderName?: string;
  correct?: boolean;
};

type Props = {
  players: Player[];
};

export const ChatLog = ({ players }: Props) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGuessResult = ({
      text,
      senderId,
      senderName,
      correct,
    }: {
      text: string;
      senderId: string;
      senderName: string;
      correct: boolean;
    }) => {
      setEntries((prev) => [
        ...prev,
        { id: Math.random().toString(), type: "guess", text, senderId, senderName, correct },
      ]);
    };

    const handleChatMessage = ({
      text,
      senderId,
      senderName,
    }: {
      text: string;
      senderId: string;
      senderName: string;
    }) => {
      setEntries((prev) => [
        ...prev,
        { id: Math.random().toString(), type: "chat", text, senderId, senderName },
      ]);
    };

    const handleRoundEnd = ({
      correctWord,
      winnerName,
    }: {
      correctWord: string;
      winnerName: string;
    }) => {
      setEntries((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: "round_end",
          text: `🎉 ${winnerName} guessed "${correctWord}"!`,
        },
      ]);
    };

    const handleRoundStart = ({ drawerName }: { drawerName: string }) => {
      setEntries((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: "system",
          text: `✏️ New round — ${drawerName} is drawing!`,
        },
      ]);
    };

    const handleHostChanged = ({ newHostName }: { newHostName: string }) => {
      setEntries((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: "system",
          text: `👑 ${newHostName} is now the host.`,
        },
      ]);
    };

    const handlePlayerJoined = ({ name }: { name: string }) => {
      setEntries((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: "system",
          text: `👋 ${name} joined the game.`,
        },
      ]);
    };

    const handlePlayerLeft = ({ name }: { name: string }) => {
      setEntries((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: "system",
          text: `🚪 ${name} left the game.`,
        },
      ]);
    };

    socket.on("guessResult", handleGuessResult);
    socket.on("chatMessage", handleChatMessage);
    socket.on("roundEnd", handleRoundEnd);
    socket.on("roundStart", handleRoundStart);
    socket.on("hostChanged", handleHostChanged);
    socket.on("playerJoined", handlePlayerJoined);
    socket.on("playerLeft", handlePlayerLeft);

    return () => {
      socket.off("guessResult", handleGuessResult);
      socket.off("chatMessage", handleChatMessage);
      socket.off("roundEnd", handleRoundEnd);
      socket.off("roundStart", handleRoundStart);
      socket.off("hostChanged", handleHostChanged);
      socket.off("playerJoined", handlePlayerJoined);
      socket.off("playerLeft", handlePlayerLeft);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
      {entries.map((entry) => {
        if (entry.type === "system") {
          return (
            <div
              key={entry.id}
              className="text-xs text-center font-semibold text-blue-200 bg-white/10 px-2 py-1.5 rounded-lg my-1"
            >
              {entry.text}
            </div>
          );
        }

        if (entry.type === "round_end") {
          return (
            <div
              key={entry.id}
              className="text-xs text-center font-bold text-emerald-300 bg-emerald-900/40 px-2 py-2 rounded-lg my-1 border border-emerald-500/30"
            >
              {entry.text}
            </div>
          );
        }

        // Look up the current color of the sender from players prop
        const matchingPlayer = players.find((p) => p.id === entry.senderId);
        const nameColor = matchingPlayer ? matchingPlayer.color : "#93c5fd"; // fallback to text-blue-300 hex equivalents if player left

        return (
          <div
            key={entry.id}
            className={`text-sm px-2 py-1.5 rounded-lg break-words ${
              entry.correct
                ? "bg-emerald-900/50 border border-emerald-500/40 text-emerald-200 font-bold"
                : "bg-white/10 text-white/90"
            }`}
          >
            <span 
              className="font-bold mr-1" 
              style={{ color: nameColor }}
            >
              {entry.senderName}:
            </span>
            <span>{entry.text}</span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
