import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../../socket.ts";
import type { DrawAction, Point, StrokeBatch } from "../../types.ts";
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

  // ── Live-preview network batching ─────────────────────────────────────────
  // Points accumulated since the last `drawStroke` flush, sent at most once
  // per animation frame instead of once per raw pointer event. Separate from
  // currentStrokePoints (the full stroke committed on mouseup) — this is only
  // for throttling what goes over the network.
  const pendingBatchPoints = useRef<Point[]>([]);
  const batchRafHandle = useRef<number | null>(null);

  // Identifier of the single touch currently drawing — lets us ignore an
  // accidental second finger touching the canvas mid-stroke instead of the
  // line jumping to whichever touch happens to be at array index 0.
  const activeTouchId = useRef<number | null>(null);

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

  /** Draw connected segments through a batch of points (received live-preview batch). */
  function drawPolyline(points: Point[], color: string, width: number) {
    for (let i = 1; i < points.length; i++) {
      drawSegment(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, color, width);
    }
  }

  /** Emit whatever points have accumulated since the last flush, if any form a full segment. */
  function flushStrokeBatch() {
    const pts = pendingBatchPoints.current;
    if (pts.length < 2) return;

    socket.emit("drawStroke", {
      points: [...pts],
      color: activeColor,
      width: activeWidth,
    });

    // Keep the last point as the seed for the next batch so consecutive
    // batches connect with no visual gap.
    pendingBatchPoints.current = [pts[pts.length - 1]];
  }

  /** Throttle flushStrokeBatch to at most once per animation frame. */
  function scheduleBatchFlush() {
    if (batchRafHandle.current !== null) return;
    batchRafHandle.current = requestAnimationFrame(() => {
      batchRafHandle.current = null;
      flushStrokeBatch();
    });
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
    pendingBatchPoints.current = [{ x, y }];
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (role !== "drawer" || !canDraw || activeTool !== "pencil" || !isDrawing.current) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const pts = currentStrokePoints.current;
    const prev = pts[pts.length - 1];

    drawSegment(prev.x, prev.y, x, y, activeColor, activeWidth);
    pts.push({ x, y });

    // Batch the live-preview point instead of emitting per-event — flushed
    // to guessers at most once per animation frame (see scheduleBatchFlush).
    pendingBatchPoints.current.push({ x, y });
    scheduleBatchFlush();
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    // Flush any batched points immediately so the live preview never lags
    // behind the stroke that's about to be committed.
    if (batchRafHandle.current !== null) {
      cancelAnimationFrame(batchRafHandle.current);
      batchRafHandle.current = null;
    }
    flushStrokeBatch();
    pendingBatchPoints.current = [];

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
    // Already tracking a touch that's drawing — ignore an extra finger
    // landing on the canvas (e.g. an accidental palm touch) rather than
    // letting it hijack the stroke.
    if (isDrawing.current) return;

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

    activeTouchId.current = touch.identifier;
    isDrawing.current = true;
    currentStrokePoints.current = [{ x, y }];
    pendingBatchPoints.current = [{ x, y }];
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (role !== "drawer" || !canDraw || activeTool !== "pencil" || !isDrawing.current) return;
    // Track the same finger that started the stroke — ignore any other
    // simultaneous touch on the canvas.
    const touch = Array.from(e.touches).find(
      (t) => t.identifier === activeTouchId.current,
    );
    if (!touch) return;
    const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
    const pts = currentStrokePoints.current;
    const prev = pts[pts.length - 1];

    drawSegment(prev.x, prev.y, x, y, activeColor, activeWidth);
    pts.push({ x, y });

    pendingBatchPoints.current.push({ x, y });
    scheduleBatchFlush();
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // Only finish the stroke when the tracked finger is the one that
    // lifted/cancelled — an unrelated second finger lifting shouldn't end it.
    const lifted = Array.from(e.changedTouches).some(
      (t) => t.identifier === activeTouchId.current,
    );
    if (!lifted) return;
    activeTouchId.current = null;
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
    function handleStrokeBroadcast(data: StrokeBatch) {
      // Live preview batch — render immediately with its color/width.
      drawPolyline(data.points, data.color, data.width);
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
      {/* Canvas area — the canvas itself is aspect-ratio-locked (3:4 portrait,
          matching its 600x800 backing resolution) and centered here, rather
          than stretched to fill the container. This keeps drawings looking
          identical across every viewer instead of distorted differently per
          device, and keeps line width scaling uniform.
          Portrait (rather than landscape) is a deliberate choice: this is a
          mobile-first app, and mobile's canvas panel is naturally tall and
          narrow — a portrait ratio fits it with minimal letterboxing.
          Desktop's wider panel ends up pillarboxed instead, which is an
          accepted trade-off given mobile is the priority. */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={600}
          height={800}
          className="max-w-full max-h-full aspect-[3/4] block bg-white touch-none"
          style={{ cursor: canvasCursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
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
