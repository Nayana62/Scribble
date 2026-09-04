import { socket } from "@/socket";
import { Timer } from "./timer";

/** Must stay in sync with CHOOSING_DURATION_SEC on the server (game/constants.js). */
const CHOOSING_DURATION_SEC = 15;

type Props = {
  visible?: boolean;
} & (
  | {
      mode: "picker";
      choosingEndsAt: number;
      wordOptions: string[];
    }
  | {
      mode: "waiting";
      choosingEndsAt: number;
      drawerName: string;
    }
);

export function ChoosingOverlay({ visible = true, ...props }: Props) {
  const handleChoose = (word: string) => {
    socket.emit("wordChosen", { word });
  };

  return (
    <div
      className={`absolute inset-0 z-10 m-auto aspect-[10/9] max-w-full max-h-full flex items-center justify-center bg-black/50 backdrop-blur-[2px] md:rounded-xl transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/20 bg-indigo-950/95 px-5 py-6 shadow-2xl">
        {props.mode === "picker" ? (
          <>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-white font-bold text-base sm:text-lg">
                Pick a word to draw
              </h2>
              <Timer
                endsAt={props.choosingEndsAt}
                durationSec={CHOOSING_DURATION_SEC}
              />
            </div>
            <div className="flex flex-col gap-2">
              {props.wordOptions.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => handleChoose(word)}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white font-semibold text-sm sm:text-base hover:bg-white/20 hover:border-white/35 transition-colors text-left capitalize"
                >
                  {word}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center gap-4">
            <p className="text-white font-semibold text-base sm:text-lg leading-snug">
              {props.drawerName} is choosing a word…
            </p>
            <Timer
              endsAt={props.choosingEndsAt}
              durationSec={CHOOSING_DURATION_SEC}
            />
          </div>
        )}
      </div>
    </div>
  );
}
