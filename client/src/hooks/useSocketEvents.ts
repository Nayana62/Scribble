import { useState, useEffect, useCallback } from "react";
import { socket } from "../socket";
import type {
  Player,
  Screen,
  RoomStatus,
  Stroke,
  RoundEndInfo,
  JoinedRoomSuccessPayload,
  PlayersUpdatePayload,
  RoundStartPayload,
  StrokeReplayPayload,
  YourWordPayload,
  RoundEndPayload,
  WaitingForPlayersPayload,
  HostChangedPayload,
  NoticePayload,
  PlayerLeftPayload,
  GameFinishedPayload,
  RankedGroup,
  Role,
} from "../types";

export function useSocketEvents() {
  const [screen, setScreen] = useState<Screen>("home");

  const [name, setName] = useState<string>(
    () => localStorage.getItem("scribble_name") || ""
  );
  const [joinCode, setJoinCode] = useState<string>("");
  const [urlRoomCode, setUrlRoomCode] = useState<string>("");
  const [homeError, setHomeError] = useState<string>("");

  const [roomId, setRoomId] = useState<string>("");
  const [isHost, setIsHost] = useState<boolean>(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myColor, setMyColor] = useState<string>("#3b82f6");

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerName, setDrawerName] = useState<string>("");
  const [roomStatus, setRoomStatus] = useState<RoomStatus>("waiting");
  const [word, setWord] = useState<string>("");
  const [wordLength, setWordLength] = useState<number>(0);
  const [replayStrokes, setReplayStrokes] = useState<Stroke[]>([]);
  const [roundEndInfo, setRoundEndInfo] = useState<RoundEndInfo | null>(null);

  const [noticeMsg, setNoticeMsg] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      const code = roomParam.trim().toUpperCase();
      setUrlRoomCode(code);
      setJoinCode(code);
    }
  }, []);

  const saveName = (val: string) => {
    setName(val);
    localStorage.setItem("scribble_name", val);
  };

  const showNotice = useCallback((msg: string, durationMs = 4000) => {
    setNoticeMsg(msg);
    setTimeout(() => setNoticeMsg(""), durationMs);
  }, []);

  const showHomeError = (msg: string) => {
    setHomeError(msg);
    setTimeout(() => setHomeError(""), 4000);
  };

  const copyRoomLink = () => {
    const clientBase = import.meta.env.VITE_CLIENT_URL || window.location.origin;
    const url = `${clientBase}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCreateRoom = () => {
    if (!name.trim()) { showHomeError("Enter your name first!"); return; }
    socket.emit("createRoom", { name: name.trim() });
  };

  const handleJoinRoom = (code: string) => {
    if (!name.trim()) { showHomeError("Enter your name first!"); return; }
    const clean = code.trim().toUpperCase();
    if (!clean) { showHomeError("Enter a room code!"); return; }
    socket.emit("joinRoom", { roomId: clean, name: name.trim() });
  };

  const handleStartGame = () => socket.emit("startGame");

  const handlePlayAgain = () => {
    socket.emit("playAgain");
  };

  const handleBackToMain = () => {
    socket.emit("leaveRoom");
    setRoomId("");
    setIsHost(false);
    setHostId(null);
    setPlayers([]);
    setDrawerId(null);
    setWord("");
    setWordLength(0);
    setUrlRoomCode("");
    setJoinCode("");

    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    setScreen("home");
  };

  useEffect(() => {
    socket.on("joinedRoomSuccess", ({
      roomId,
      isHost,
      color,
    }: JoinedRoomSuccessPayload) => {
      setRoomId(roomId);
      setIsHost(isHost);
      setMyColor(color);
      setHomeError("");
      setScreen("gameLobby");
    });

    socket.on("roomNotFound", ({ message }: NoticePayload) => {
      showHomeError(message);
    });

    socket.on("roomFull", ({ message }: NoticePayload) => {
      showHomeError(message);
    });

    socket.on("playersUpdate", ({
      players,
      hostId,
      status,
      drawerId,
    }: PlayersUpdatePayload) => {
      setPlayers(players);
      setHostId(hostId);
      setRoomStatus(status);
      setDrawerId(drawerId);
      if (socket.id && hostId) setIsHost(socket.id === hostId);

      if (status === "in_progress") setScreen("game");
    });

    socket.on("roundStart", ({
      drawerId,
      drawerName,
      wordLength,
    }: RoundStartPayload) => {
      setDrawerId(drawerId);
      setDrawerName(drawerName);
      setWordLength(wordLength);
      setWord("");
      setRoundEndInfo(null);
      setRoomStatus("in_progress");
      setReplayStrokes([]);
      setScreen("game");
    });

    socket.on("strokeReplay", ({ strokes }: StrokeReplayPayload) => {
      setReplayStrokes(strokes);
    });

    socket.on("yourWord", ({ word }: YourWordPayload) => {
      setWord(word);
      setWordLength(word.length);
    });

    socket.on("roundEnd", ({
      correctWord,
      winnerName,
    }: RoundEndPayload) => {
      setRoundEndInfo({ correctWord, winnerName });
      setTimeout(() => setRoundEndInfo(null), 2600);
    });

    socket.on("waitingForPlayers", ({
      count,
      min,
      reason,
    }: WaitingForPlayersPayload) => {
      setRoomStatus("waiting");
      setDrawerId(null);
      setWord("");
      setWordLength(0);
      setScreen("gameLobby");
      if (reason === "player_left") {
        showNotice(`A player left — game paused. Need ${min} players to continue (${count}/${min}).`);
      }
    });

    socket.on("hostChanged", ({
      newHostId,
      newHostName,
    }: HostChangedPayload) => {
      setHostId(newHostId);
      if (socket.id === newHostId) setIsHost(true);
      showNotice(`👑 ${newHostName} is now the host.`);
    });

    socket.on("notice", ({ message }: NoticePayload) => {
      showNotice(message, 3500);
    });

    socket.on("playerLeft", ({ name }: PlayerLeftPayload) => {
      showNotice(`${name} left the room.`, 3000);
    });

    socket.on("gameFinished", ({ players }: GameFinishedPayload) => {
      setPlayers(players);
      setScreen("finished");
    });

    socket.on("playAgain", () => {
      setScreen("gameLobby");
      setRoomStatus("waiting");
      setDrawerId(null);
      setWord("");
      setWordLength(0);
    });

    return () => {
      socket.off("joinedRoomSuccess");
      socket.off("roomNotFound");
      socket.off("roomFull");
      socket.off("playersUpdate");
      socket.off("roundStart");
      socket.off("strokeReplay");
      socket.off("yourWord");
      socket.off("roundEnd");
      socket.off("waitingForPlayers");
      socket.off("hostChanged");
      socket.off("notice");
      socket.off("playerLeft");
      socket.off("gameFinished");
      socket.off("playAgain");
    };
  }, [showNotice]);

  const isDrawer = socket.id === drawerId;
  const role: Role = isDrawer ? "drawer" : "guesser";

  const wordChars: string[] = isDrawer && word
    ? word.split("")
    : Array.from({ length: wordLength }, () => "_");

  const hostPlayer = players.find((p) => p.id === hostId);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

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

  const firstPlace = rankedGroups.find((g) => g.rank === 1);
  const secondPlace = rankedGroups.find((g) => g.rank === 2);
  const thirdPlace = rankedGroups.find((g) => g.rank === 3);

  return {
    screen,
    name,
    saveName,
    joinCode,
    setJoinCode,
    urlRoomCode,
    setUrlRoomCode,
    homeError,
    roomId,
    isHost,
    hostId,
    players,
    myColor,
    drawerId,
    drawerName,
    roomStatus,
    word,
    wordLength,
    replayStrokes,
    roundEndInfo,
    noticeMsg,
    copied,
    copyRoomLink,
    handleCreateRoom,
    handleJoinRoom,
    handleStartGame,
    handlePlayAgain,
    handleBackToMain,
    isDrawer,
    role,
    wordChars,
    hostPlayer,
    sortedPlayers,
    firstPlace,
    secondPlace,
    thirdPlace,
  };
}
