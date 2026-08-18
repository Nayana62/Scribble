import { ChoosingOverlay } from "./choosing-overlay";
import { RoundAnnouncementOverlay } from "./round-announcement-overlay";
import type { RoundPhase } from "@/types";

type Props = {
  roundPhase: RoundPhase | "announcement" | null;
  choosingEndsAt: number | null;
  cycleNumber: number | null;
  isDrawer: boolean;
  wordOptions: string[];
  drawerName: string;
};

export function CanvasPhaseOverlays({
  roundPhase,
  choosingEndsAt,
  cycleNumber,
  isDrawer,
  wordOptions,
  drawerName,
}: Props) {
  if (roundPhase === "announcement" && cycleNumber !== null) {
    return (
      <RoundAnnouncementOverlay
        cycleNumber={cycleNumber}
        visible={true}
      />
    );
  }

  if (roundPhase === "choosing" && choosingEndsAt !== null) {
    if (isDrawer && wordOptions.length > 0) {
      return (
        <ChoosingOverlay
          mode="picker"
          choosingEndsAt={choosingEndsAt}
          wordOptions={wordOptions}
          visible={true}
        />
      );
    } else {
      return (
        <ChoosingOverlay
          mode="waiting"
          choosingEndsAt={choosingEndsAt}
          drawerName={drawerName}
          visible={true}
        />
      );
    }
  }

  return null;
}
