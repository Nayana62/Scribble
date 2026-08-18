import { useVisualViewport } from "@/app/lib/use-visual-viewport";
import { GuessForm } from "./guess-form";

type Props = {
  role: "drawer" | "guesser" | null;
};

export function MobileChatInputRow({ role }: Props) {
  const { offset, supported } = useVisualViewport();

  if (!supported) {
    return (
      <div className="md:hidden sticky bottom-0 z-20 w-full shrink-0 bg-[#1a1a2e]/95 backdrop-blur-sm border-t border-white/15">
        <GuessForm role={role} />
      </div>
    );
  }

  return (
    <div
      className="md:hidden fixed left-0 right-0 bottom-0 z-20 w-full bg-[#1a1a2e]/95 backdrop-blur-sm border-t border-white/15"
      style={{ transform: `translateY(-${offset}px)` }}
    >
      <GuessForm role={role} />
    </div>
  );
}
