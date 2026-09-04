type Props = {
  cycleNumber: number;
  visible: boolean;
};

export function RoundAnnouncementOverlay({ cycleNumber, visible }: Props) {
  return (
    <div
      className={`absolute inset-0 z-10 m-auto aspect-[10/9] max-w-full max-h-full flex items-center justify-center bg-black/50 backdrop-blur-[2px] md:rounded-xl transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <p className="text-white font-black text-4xl sm:text-5xl tracking-tight select-none">
        Round {cycleNumber}
      </p>
    </div>
  );
}
