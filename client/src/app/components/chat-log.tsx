import { socket } from "@/socket";
import { useEffect, useRef, useState } from "react";
import type { Player } from "@/types";

type LogEntry = {
  id: string;
  type: "chat" | "guess" | "system";
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
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGuessResult = ({
      text,
      senderId,
      senderName,
      correct,
      isSystemGuess,
      isSelfConfirm,
    }: {
      text?: string;
      senderId: string;
      senderName: string;
      correct: boolean;
      isSystemGuess?: boolean;
      isSelfConfirm?: boolean;
    }) => {
      if (isSystemGuess || isSelfConfirm) {
        setEntries((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: "system",
            text: `✅ ${senderName} guessed the word!`,
          },
        ]);
      } else {
        setEntries((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: "guess",
            text: text || "",
            senderId,
            senderName,
            correct,
          },
        ]);
      }
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
        {
          id: Math.random().toString(),
          type: "chat",
          text,
          senderId,
          senderName,
        },
      ]);
    };

    const handleWaitingForPlayers = ({
      count,
      min,
      reason,
    }: {
      count: number;
      min: number;
      reason?: string;
    }) => {
      const text =
        reason === "player_left"
          ? `A player left — game paused. Need ${min} players to continue (${count}/${min}).`
          : `Waiting for players (${count}/${min})…`;
      setEntries((prev) => [
        ...prev,
        { id: Math.random().toString(), type: "system", text },
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
    socket.on("roundStart", handleRoundStart);
    socket.on("waitingForPlayers", handleWaitingForPlayers);
    socket.on("hostChanged", handleHostChanged);
    socket.on("playerJoined", handlePlayerJoined);
    socket.on("playerLeft", handlePlayerLeft);

    return () => {
      socket.off("guessResult", handleGuessResult);
      socket.off("chatMessage", handleChatMessage);
      socket.off("roundStart", handleRoundStart);
      socket.off("waitingForPlayers", handleWaitingForPlayers);
      socket.off("hostChanged", handleHostChanged);
      socket.off("playerJoined", handlePlayerJoined);
      socket.off("playerLeft", handlePlayerLeft);
    };
  }, []);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  return (
    <div
      ref={messagesRef}
      className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-1 space-y-1"
    >
      {entries.map((entry) => {
        if (entry.type === "system") {
          return (
            <div
              key={entry.id}
              className={`text-[11px] md:text-xs text-center font-semibold px-2 py-1 md:py-1.5 rounded-lg my-0.5 md:my-1 ${
                entry.text.startsWith("✅")
                  ? "text-emerald-300 bg-emerald-900/30"
                  : "text-blue-200 bg-white/10"
              }`}
            >
              {entry.text}
            </div>
          );
        }

        const matchingPlayer = players.find((p) => p.id === entry.senderId);
        const nameColor = matchingPlayer ? matchingPlayer.color : "#93c5fd"; // sender left the room

        return (
          <div
            key={entry.id}
            className={`text-[13px] md:text-sm px-2 py-1 md:py-1.5 rounded-lg break-words ${
              entry.correct
                ? "bg-emerald-900/50 border border-emerald-500/40 text-emerald-200 font-bold"
                : "bg-white/10 text-white/90"
            }`}
          >
            <span className="font-bold mr-1" style={{ color: nameColor }}>
              {entry.senderName}:
            </span>
            <span>{entry.text}</span>
          </div>
        );
      })}
    </div>
  );
};
