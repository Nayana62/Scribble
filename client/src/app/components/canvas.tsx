import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../../socket.ts";
import type { DrawAction, Point, StrokeSegment } from "../../types.ts";
import { floodFill } from "../lib/flood-fill.ts";
import { replayActions } from "../lib/replay-actions.ts";
import {
  DEFAULT_COLOR,
  DEFAULT_WIDTH,
  Toolbar,
  type ActiveTool,
} from "./toolbar.tsx";

type Props = {
  role: "drawer" | "guesser" | null;
  /** Full ordered action log for late-joiner replay (from shared game state). */
  replayActions?: DrawAction[];
  /** When false, drawing input is disabled (e.g. during word-choosing phase). */
  canDraw?: boolean;
};

export default function Canvas({
  role,
  replayActions: replayActionsProp = [],
  canDraw = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Drawing input state (local to this component, not in the reducer) ────────
  const [activeTool, setActiveTool] = useState<ActiveTool>("pencil");
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_COLOR);
  const [activeWidth, setActiveWidth] = useState<number>(DEFAULT_WIDTH);

  // Action log maintained locally — mirrors server's room.actionLog for this round.
  // Using a ref so mutations don't trigger re-renders; canUndo drives the button state.
  const localActionLog = useRef<DrawAction[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // Current stroke accumulator (points collected between mousedown → mouseup)
  const currentStrokePoints = useRef<Point[]>([]);
  const isDrawing = useRef(false);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getCtx(): CanvasRenderingContext2D | null {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function getCanvasCoords(clientX: number, clientY: number): Point {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  /** Draw a single segment — used for live preview (drawer + receiving clients). */
  function drawSegment(
    prevX: number,
    prevY: number,
    x: number,
    y: number,
    color: string,
    width: number,
  ) {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function clearCanvasLocally() {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /** Sync canUndo state after mutating the local action log. */
  function syncCanUndo() {
    setCanUndo(localActionLog.current.length > 0);
  }

  // ── Drawer action handlers ────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (localActionLog.current.length === 0) return;
    localActionLog.current.pop();
    syncCanUndo();

    const ctx = getCtx();
    if (ctx) replayActions(ctx, localActionLog.current);

    socket.emit("drawAction", { type: "undo" });
  }, []);

  const handleClear = useCallback(() => {
    localActionLog.current.push({ type: "clear" });
    syncCanUndo();
    clearCanvasLocally();
    socket.emit("drawAction", { type: "clear" });
  }, []);

  // ── Mouse Handlers ────────────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (role !== "drawer" || !canDraw) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (activeTool === "fill") {
      // Fill tool: act on mousedown, no drag
      const ctx = getCtx();
      if (!ctx) return;
      floodFill(ctx, x, y, activeColor);
      const action: DrawAction = { type: "fill", x, y, color: activeColor };
      localActionLog.current.push(action);
      syncCanUndo();
      socket.emit("drawAction", action);
      return;
    }

    // Pencil
    isDrawing.current = true;
    currentStrokePoints.current = [{ x, y }];
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (role !== "drawer" || !canDraw || activeTool !== "pencil" || !isDrawing.current) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const pts = currentStrokePoints.current;
    const prev = pts[pts.length - 1];

    drawSegment(prev.x, prev.y, x, y, activeColor, activeWidth);
    pts.push({ x, y });

    // Emit live-preview segment (received by guessers for real-time rendering)
    socket.emit("drawStroke", {
      prevX: prev.x,
      prevY: prev.y,
      x,
      y,
      color: activeColor,
      width: activeWidth,
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const pts = currentStrokePoints.current;
    if (pts.length < 2) {
      currentStrokePoints.current = [];
      return;
    }

    // Commit the completed stroke to the log
    const action: DrawAction = {
      type: "stroke",
      points: [...pts],
      color: activeColor,
      width: activeWidth,
    };
    localActionLog.current.push(action);
    syncCanUndo();
    socket.emit("drawAction", action);
    currentStrokePoints.current = [];
  };

  // ── Touch Handlers ────────────────────────────────────────────────────────────

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (role !== "drawer" || !canDraw) return;
    const touch = e.touches[0];
    if (!touch) return;
    const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);

    if (activeTool === "fill") {
      const ctx = getCtx();
      if (!ctx) return;
      floodFill(ctx, x, y, activeColor);
      const action: DrawAction = { type: "fill", x, y, color: activeColor };
      localActionLog.current.push(action);
      syncCanUndo();
      socket.emit("drawAction", action);
      return;
    }

    isDrawing.current = true;
    currentStrokePoints.current = [{ x, y }];
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (role !== "drawer" || !canDraw || activeTool !== "pencil" || !isDrawing.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
    const pts = currentStrokePoints.current;
    const prev = pts[pts.length - 1];

    drawSegment(prev.x, prev.y, x, y, activeColor, activeWidth);
    pts.push({ x, y });

    socket.emit("drawStroke", {
      prevX: prev.x,
      prevY: prev.y,
      x,
      y,
      color: activeColor,
      width: activeWidth,
    });
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  // ── Late-joiner replay ────────────────────────────────────────────────────────
  // When the shared state provides a fresh action log (joining mid-round),
  // load it into the local log and replay from scratch.
  useEffect(() => {
    if (replayActionsProp.length === 0) return;
    requestAnimationFrame(() => {
      const ctx = getCtx();
      if (!ctx) return;
      localActionLog.current = [...replayActionsProp];
      replayActions(ctx, localActionLog.current);
      syncCanUndo();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayActionsProp]);

  // ── Socket listeners (receiving actions from the drawer) ─────────────────────
  useEffect(() => {
    function handleStrokeBroadcast(data: StrokeSegment) {
      // Live preview segment — render immediately with its color/width.
      drawSegment(data.prevX, data.prevY, data.x, data.y, data.color, data.width);
    }

    function handleDrawAction(action: { type: string; [key: string]: unknown }) {
      const ctx = getCtx();
      if (!ctx) return;

      if (action.type === "stroke") {
        const a = action as DrawAction & { type: "stroke" };
        localActionLog.current.push({ type: "stroke", points: a.points, color: a.color, width: a.width });
        // Replay only this stroke (already rendered via strokeBroadcast segments, but
        // re-drawing via polyline ensures perfect pixel consistency with the drawer).
        // We skip the full replayActions() here for performance — the log is already consistent.
      } else if (action.type === "fill") {
        const a = action as DrawAction & { type: "fill" };
        localActionLog.current.push({ type: "fill", x: a.x, y: a.y, color: a.color });
        floodFill(ctx, a.x, a.y, a.color);
      } else if (action.type === "clear") {
        localActionLog.current.push({ type: "clear" });
        clearCanvasLocally();
      } else if (action.type === "undo") {
        if (localActionLog.current.length > 0) {
          localActionLog.current.pop();
          replayActions(ctx, localActionLog.current);
        }
      }
      // Keep canUndo in sync for non-drawers too (in case role ever changes mid-round)
    }

    function handleCanvasCleared() {
      localActionLog.current = [];
      clearCanvasLocally();
      setCanUndo(false);
    }

    function handleRoundStart() {
      localActionLog.current = [];
      clearCanvasLocally();
      setCanUndo(false);
    }

    socket.on("strokeBroadcast", handleStrokeBroadcast);
    socket.on("drawAction", handleDrawAction);
    socket.on("canvasCleared", handleCanvasCleared);
    socket.on("roundStart", handleRoundStart);

    return () => {
      socket.off("strokeBroadcast", handleStrokeBroadcast);
      socket.off("drawAction", handleDrawAction);
      socket.off("canvasCleared", handleCanvasCleared);
      socket.off("roundStart", handleRoundStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived cursor style ──────────────────────────────────────────────────────
  const canvasCursor =
    role !== "drawer" || !canDraw
      ? "default"
      : activeTool === "fill"
        ? "crosshair"
        : "crosshair";

  return (
    <div className="flex flex-col h-full bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden gap-0">
      {/* Canvas area */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full block bg-white touch-none"
          style={{ cursor: canvasCursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      {/* Toolbar — drawer only, hidden during choosing phase */}
      {role === "drawer" && canDraw && (
        <div className="shrink-0 px-2 pt-1.5 pb-2">
          <Toolbar
            activeColor={activeColor}
            onColorChange={setActiveColor}
            activeWidth={activeWidth}
            onWidthChange={setActiveWidth}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            canUndo={canUndo}
            onUndo={handleUndo}
            onClear={handleClear}
          />
        </div>
      )}
    </div>
  );
}
