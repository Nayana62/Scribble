import { useEffect, useRef } from "react";
import { socket } from "../../socket.ts";
import { Trash2 } from "lucide-react";

type StrokeData = { prevX: number; prevY: number; x: number; y: number };

type Props = {
  role: "drawer" | "guesser" | null;
  replayStrokes?: StrokeData[];
};

export default function Canvas({ role, replayStrokes = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawing = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);

  // Exact coordinate calculation matching DOM bounding box to internal canvas resolution
  function getCanvasCoords(clientX: number, clientY: number) {
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

  function drawLine(x1: number, y1: number, x2: number, y2: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.stroke();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (role !== "drawer") return;
    isDrawing.current = true;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    lastX.current = x;
    lastY.current = y;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (role !== "drawer" || !isDrawing.current) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    drawLine(lastX.current, lastY.current, x, y);

    socket.emit("drawStroke", {
      prevX: lastX.current,
      prevY: lastY.current,
      x,
      y,
    });

    lastX.current = x;
    lastY.current = y;
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  // Touch Handlers for Mobile Devices
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (role !== "drawer") return;
    const touch = e.touches[0];
    if (!touch) return;

    isDrawing.current = true;
    const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
    lastX.current = x;
    lastY.current = y;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (role !== "drawer" || !isDrawing.current) return;
    const touch = e.touches[0];
    if (!touch) return;

    const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
    drawLine(lastX.current, lastY.current, x, y);

    socket.emit("drawStroke", {
      prevX: lastX.current,
      prevY: lastY.current,
      x,
      y,
    });

    lastX.current = x;
    lastY.current = y;
  };

  // Draw replay strokes whenever the prop changes (late joiner catches up)
  useEffect(() => {
    if (replayStrokes.length === 0) return;
    // Small rAF delay ensures the canvas is painted and sized before we draw
    requestAnimationFrame(() => {
      replayStrokes.forEach((s) => drawLine(s.prevX, s.prevY, s.x, s.y));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayStrokes]);

  useEffect(() => {
    function handleStroke(data: StrokeData) {
      drawLine(data.prevX, data.prevY, data.x, data.y);
    }

    socket.on("strokeBroadcast", handleStroke);
    socket.on("canvasCleared", clearCanvas);
    socket.on("roundStart", clearCanvas);

    return () => {
      socket.off("strokeBroadcast", handleStroke);
      socket.off("canvasCleared", clearCanvas);
      socket.off("roundStart", clearCanvas);
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
      {/* Canvas area */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full block bg-white touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        />
      </div>

      {/* Clear button — only visible to drawer */}
      {role === "drawer" && (
        <div className="shrink-0 flex justify-end px-2 py-1.5 bg-white/5 border-t border-white/10">
          <button
            onClick={() => {
              clearCanvas();
              socket.emit("clearCanvasRequest");
            }}
            className="bg-red-500/80 flex items-center gap-1 hover:bg-red-500 active:scale-95 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />

            <span>Clear</span>
          </button>
        </div>
      )}
    </div>
  );
}
