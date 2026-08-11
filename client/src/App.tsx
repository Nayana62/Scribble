import { useSocketEvents } from "./hooks/useSocketEvents";
import { HomeScreen } from "./screens/HomeScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { GameScreen } from "./screens/GameScreen";
import { EndScreen } from "./screens/EndScreen";

export function App() {
  const {
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
    drawerId,
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
  } = useSocketEvents();

  return (
    <div className="w-screen h-screen flex flex-col font-sans overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-950">
        <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.12)_1.5px,transparent_1.5px)] [background-size:28px_28px]" />
      </div>

      {screen === "home" && (
        <HomeScreen
          name={name}
          saveName={saveName}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          urlRoomCode={urlRoomCode}
          setUrlRoomCode={setUrlRoomCode}
          homeError={homeError}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {screen === "gameLobby" && (
        <LobbyScreen
          roomId={roomId}
          players={players}
          hostId={hostId}
          isHost={isHost}
          hostPlayer={hostPlayer}
          copied={copied}
          noticeMsg={noticeMsg}
          onCopyRoomLink={copyRoomLink}
          onStartGame={handleStartGame}
          onBackToMain={handleBackToMain}
        />
      )}

      {screen === "game" && (
        <GameScreen
          players={players}
          hostId={hostId}
          drawerId={drawerId}
          wordLength={wordLength}
          wordChars={wordChars}
          isDrawer={isDrawer}
          word={word}
          role={role}
          replayStrokes={replayStrokes}
          roundEndInfo={roundEndInfo}
          noticeMsg={noticeMsg}
        />
      )}

      {screen === "finished" && (
        <EndScreen
          roomId={roomId}
          sortedPlayers={sortedPlayers}
          firstPlace={firstPlace}
          secondPlace={secondPlace}
          thirdPlace={thirdPlace}
          onPlayAgain={handlePlayAgain}
          onBackToMain={handleBackToMain}
        />
      )}
    </div>
  );
}

export default App;
