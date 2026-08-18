import { ChoosingOverlay } from "./choosing-overlay";
import { RoundAnnouncementOverlay } from "./round-announcement-overlay";
import { RoundResultOverlay } from "./round-result-overlay";
import type { RoundPhase, RoundResultPayload } from "@/types";

type Props = {
  roundPhase: RoundPhase | "announcement" | null;
  choosingEndsAt: number | null;
  cycleNumber: number | null;
  isDrawer: boolean;
  wordOptions: string[];
  drawerName: string;
  roundResult: RoundResultPayload | null;
  myId: string;
};

export function CanvasPhaseOverlays({
  roundPhase,
  choosingEndsAt,
  cycleNumber,
  isDrawer,
  wordOptions,
  drawerName,
  roundResult,
  myId,
}: Props) {
  if (roundResult) {
    return <RoundResultOverlay roundResult={roundResult} myId={myId} />;
  }

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
