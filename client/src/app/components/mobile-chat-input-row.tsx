import { useEffect, useRef } from "react";
import { useVisualViewport } from "@/app/lib/use-visual-viewport";
import { GuessForm } from "./guess-form";

type Props = {
  role: "drawer" | "guesser" | null;
  onHeightChange?: (height: number) => void;
};

export function MobileChatInputRow({ role, onHeightChange }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const { offset, supported } = useVisualViewport();

  useEffect(() => {
    const el = rowRef.current;
    if (!el || !onHeightChange) return;

    const report = () => {
      // Fixed bar is out of flow — parent needs padding. In-flow sticky bar needs none.
      onHeightChange(supported ? el.offsetHeight : 0);
    };

    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);

    return () => {
      ro.disconnect();
      onHeightChange(0);
    };
  }, [onHeightChange, supported]);

  if (!supported) {
    return (
      <div
        ref={rowRef}
        className="md:hidden sticky bottom-0 z-20 w-full shrink-0 bg-[#1a1a2e]/95 backdrop-blur-sm border-t border-white/15"
      >
        <GuessForm role={role} />
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      className="md:hidden fixed left-0 right-0 bottom-0 z-20 w-full bg-[#1a1a2e]/95 backdrop-blur-sm border-t border-white/15"
      style={{ transform: `translateY(-${offset}px)` }}
    >
      <GuessForm role={role} />
    </div>
  );
}
