import { GameProvider, useGame } from "./state/GameContext";
import { HomeScreen } from "./screens/HomeScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { GameScreen } from "./screens/GameScreen";
import { EndScreen } from "./screens/EndScreen";

function AppContent() {
  const { state } = useGame();

  return (
    <div className="w-screen h-screen flex flex-col font-sans overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-950">
        <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.12)_1.5px,transparent_1.5px)] [background-size:28px_28px]" />
      </div>

      {state.screen === "home" && <HomeScreen />}
      {state.screen === "gameLobby" && <LobbyScreen />}
      {state.screen === "game" && <GameScreen />}
      {state.screen === "finished" && <EndScreen />}
    </div>
  );
}

export function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
