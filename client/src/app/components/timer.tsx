import { useEffect, useRef, useState } from "react";

/**
 * Circular SVG countdown timer.
 *
 * Receives `endsAt` (epoch ms) from shared game state and ticks its own local
 * display state via setInterval — consistent with the "derived/computed display
 * values stay local" pattern used elsewhere in the codebase.
 *
 * Renders nothing when `endsAt` is null (between rounds / lobby).
 */

const RADIUS = 20;
const STROKE_WIDTH = 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const VIEWBOX_SIZE = (RADIUS + STROKE_WIDTH) * 2;

/** Color thresholds (fraction of total duration remaining) */
const COLOR_GREEN = "#22c55e";  // > 50 %
const COLOR_YELLOW = "#eab308"; // 20 – 50 %
const COLOR_RED = "#ef4444";    // < 20 %

type Props = {
  endsAt: number | null;
  /** Total round duration in seconds — used to compute the ring fraction. */
  durationSec: number;
};

export function Timer({ endsAt, durationSec }: Props) {
  const [remaining, setRemaining] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (endsAt === null) {
      setRemaining(0);
      return;
    }

    // Compute immediately on mount / endsAt change so there's no 1-tick delay.
    const tick = () => {
      const ms = Math.max(0, endsAt - Date.now());
      setRemaining(ms);
    };

    tick();
    intervalRef.current = setInterval(tick, 100);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [endsAt]);

  if (endsAt === null) {
    return (
      <div
        className="shrink-0"
        style={{ width: VIEWBOX_SIZE, height: VIEWBOX_SIZE }}
      />
    );
  }

  const totalMs = durationSec * 1000;
  const fraction = totalMs > 0 ? remaining / totalMs : 0;
  const seconds = Math.min(durationSec, Math.ceil(remaining / 1000));

  // Stroke offset: full circle when fraction=1, empty when fraction=0.
  const dashOffset = CIRCUMFERENCE * (1 - fraction);

  const ringColor =
    fraction > 0.5 ? COLOR_GREEN :
    fraction > 0.2 ? COLOR_YELLOW :
    COLOR_RED;

  const center = VIEWBOX_SIZE / 2;

  return (
    <div
      className="relative shrink-0 select-none"
      style={{ width: VIEWBOX_SIZE, height: VIEWBOX_SIZE }}
      aria-label={`${seconds} seconds remaining`}
      role="timer"
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        width={VIEWBOX_SIZE}
        height={VIEWBOX_SIZE}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        {/* Track ring */}
        <circle
          cx={center}
          cy={center}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={STROKE_WIDTH}
        />
        {/* Progress ring */}
        <circle
          cx={center}
          cy={center}
          r={RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.4s ease" }}
        />
      </svg>

      {/* Numeric seconds — rotated back upright, centred over the SVG */}
      <span
        className="absolute inset-0 flex items-center justify-center font-black text-white tabular-nums"
        style={{
          fontSize: RADIUS * 0.75,
          lineHeight: 1,
          // Colour pulse when nearly out of time
          color: fraction <= 0.2 && seconds <= 10 ? ringColor : "white",
          transition: "color 0.4s ease",
        }}
        aria-hidden="true"
      >
        {seconds}
      </span>
    </div>
  );
}
