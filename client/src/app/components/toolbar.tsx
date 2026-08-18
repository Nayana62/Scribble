import { Check, PaintBucket, Pencil, Trash2, Undo2 } from "lucide-react";

export type ActiveTool = "pencil" | "fill";

/** The 11 preset palette colors, in display order. */
export const PALETTE_COLORS = [
  { hex: "#ef4444", label: "Red" },
  { hex: "#eab308", label: "Yellow" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#92400e", label: "Brown" },
  { hex: "#3b82f6", label: "Blue" },
  { hex: "#0ea5e9", label: "Sky blue" },
  { hex: "#22c55e", label: "Green" },
  { hex: "#6b7280", label: "Grey" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#0f172a", label: "Black" },
  { hex: "#ffffff", label: "White" },
] as const;

export const DEFAULT_COLOR = "#0f172a";
export const DEFAULT_WIDTH = 6;

type Props = {
  activeColor: string;
  onColorChange: (color: string) => void;
  activeWidth: number;
  onWidthChange: (width: number) => void;
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  canUndo: boolean;
  onUndo: () => void;
  onClear: () => void;
};

export function Toolbar({
  activeColor,
  onColorChange,
  activeWidth,
  onWidthChange,
  activeTool,
  onToolChange,
  canUndo,
  onUndo,
  onClear,
}: Props) {
  return (
    <div className="shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex flex-col gap-2.5 items-center w-full">
      {/* ── Row 1: Color palette ─────────────────────────────────────────── */}
      <div
        className="flex flex-wrap justify-center gap-1.5"
        role="group"
        aria-label="Color palette"
      >
        {PALETTE_COLORS.map(({ hex, label }) => {
          const isActive = hex === activeColor;
          return (
            <button
              key={hex}
              onClick={() => onColorChange(hex)}
              aria-label={`${label}${isActive ? " (selected)" : ""}`}
              title={label}
              className={`relative w-7 h-7 rounded-full transition-transform hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 ${
                isActive ? "ring-2 ring-offset-1 ring-gray-600 scale-110" : ""
              } ${hex === "#ffffff" ? "border border-gray-300" : ""}`}
              style={{ backgroundColor: hex }}
            >
              {isActive && (
                <Check
                  className="absolute inset-0 m-auto w-3.5 h-3.5 drop-shadow"
                  style={{
                    color:
                      hex === "#ffffff" || hex === "#eab308"
                        ? "#374151"
                        : "#ffffff",
                  }}
                  strokeWidth={3}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Row 2: Thickness slider + live preview ───────────────────────── */}
      <div
        className="flex items-center gap-3 w-full px-1"
        aria-label="Brush size"
      >
        <input
          id="toolbar-width-slider"
          type="range"
          min={2}
          max={30}
          step={1}
          value={activeWidth}
          onInput={(e) =>
            onWidthChange(Number((e.target as HTMLInputElement).value))
          }
          onChange={(e) => onWidthChange(Number(e.target.value))}
          className="flex-1 h-2 accent-blue-500 cursor-pointer"
          aria-label={`Brush size: ${activeWidth}px`}
        />
        {/* Live preview circle — size and color update synchronously with slider */}
        <div
          className="shrink-0 w-8 h-8 flex items-center justify-center"
          aria-hidden="true"
        >
          <div
            className="rounded-full"
            style={{
              width: activeWidth,
              height: activeWidth,
              backgroundColor: activeColor,
              minWidth: 4,
              minHeight: 4,
              maxWidth: "100%",
              maxHeight: "100%",
              outline:
                activeColor === "#ffffff" ? "1px solid #d1d5db" : undefined,
              transition: "none",
            }}
          />
        </div>
      </div>

      {/* ── Row 3: Tool buttons ──────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1.5"
        role="toolbar"
        aria-label="Drawing tools"
      >
        {/* Pencil */}
        <button
          onClick={() => onToolChange("pencil")}
          aria-pressed={activeTool === "pencil"}
          title="Pencil"
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
            activeTool === "pencil"
              ? "bg-blue-500 text-white shadow-sm shadow-blue-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <Pencil className="w-4 h-4" />
        </button>

        {/* Paint bucket */}
        <button
          onClick={() => onToolChange("fill")}
          aria-pressed={activeTool === "fill"}
          title="Fill"
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
            activeTool === "fill"
              ? "bg-blue-500 text-white shadow-sm shadow-blue-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <PaintBucket className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-0.5" aria-hidden="true" />

        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
            canUndo
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95"
              : "bg-gray-50 text-gray-300 cursor-not-allowed"
          }`}
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* Clear / Trash */}
        <button
          onClick={onClear}
          title="Clear canvas"
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 active:scale-95 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
