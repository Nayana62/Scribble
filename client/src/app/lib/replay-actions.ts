/**
 * replay-actions.ts
 *
 * Single reusable function that reconstructs a canvas from an ordered DrawAction log.
 * Called in two contexts:
 *   1. Late-joiner sync (replays the server's actionLog from scratch)
 *   2. Undo (replays the local actionLog after popping the last entry)
 *
 * This is the only correct approach for undo on a raster canvas — pixel-level
 * subtraction of the last stroke is not reliable due to overlap and anti-aliasing.
 */

import type { DrawAction, Point } from "../../types";
import { floodFill } from "./flood-fill";

/**
 * Draw a polyline through a sequence of points using the given style.
 * Connects each consecutive pair with a lineTo, which reproduces the same
 * visual as the segment-by-segment live preview (identical line width / cap).
 */
function drawStrokePoints(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  width: number,
): void {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

// Reconstructs the canvas by clearing it and replaying an ordered DrawAction
// log from scratch (no 'undo' entries — those are already resolved).
export function replayActions(
  ctx: CanvasRenderingContext2D,
  actions: DrawAction[],
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  for (const action of actions) {
    if (action.type === "stroke") {
      drawStrokePoints(ctx, action.points, action.color, action.width);
    } else if (action.type === "fill") {
      floodFill(ctx, action.x, action.y, action.color);
    } else if (action.type === "clear") {
      ctx.clearRect(0, 0, width, height);
    }
  }
}
