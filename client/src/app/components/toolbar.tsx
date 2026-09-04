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
export const DEFAULT_WIDTH = 8;

// Discrete brush-size presets — fits in the tools row and is easier to hit
// on a touchscreen than a continuous slider. Widths are in canvas
// backing-store units (see canvas.tsx), not CSS pixels, so strokes scale
// with the drawing surface instead of looking thinner on larger screens.
const SIZE_PRESETS = [
  { width: 4, label: "Thin" },
  { width: 8, label: "Medium" },
  { width: 16, label: "Thick" },
  { width: 26, label: "Extra thick" },
] as const;

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
    // Exactly two flex-nowrap rows with fixed-size controls — a wrapping
    // toolbar would grow to three rows and desync --toolbar-h in index.css.
    <div className="shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm px-2 py-2 flex flex-col gap-2 items-center w-full overflow-hidden">
      {/* ── Row 1: Color palette ─────────────────────────────────────────── */}
      <div
        className="flex flex-nowrap justify-center gap-1"
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
              className={`relative w-5 h-5 sm:w-6 sm:h-6 shrink-0 rounded-full transition-transform hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 ${
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

      {/* ── Row 2: Tools + size presets + undo/clear ─────────────────────── */}
      <div
        className="flex flex-nowrap items-center justify-center gap-1"
        role="toolbar"
        aria-label="Drawing tools"
      >
        {/* Pencil */}
        <button
          onClick={() => onToolChange("pencil")}
          aria-pressed={activeTool === "pencil"}
          title="Pencil"
          className={`flex items-center justify-center w-8 h-8 shrink-0 rounded-lg transition-all ${
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
          className={`flex items-center justify-center w-8 h-8 shrink-0 rounded-lg transition-all ${
            activeTool === "fill"
              ? "bg-blue-500 text-white shadow-sm shadow-blue-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <PaintBucket className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 shrink-0 bg-gray-200 mx-0.5" aria-hidden="true" />

        {/* Brush size presets — dot grows with size, filled in the active color */}
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="Brush size"
        >
          {SIZE_PRESETS.map(({ width, label }) => {
            const isActive = width === activeWidth;
            return (
              <button
                key={width}
                onClick={() => onWidthChange(width)}
                aria-pressed={isActive}
                aria-label={`${label} (${width}px)${isActive ? " (selected)" : ""}`}
                title={`${label} (${width}px)`}
                className={`flex items-center justify-center w-7 h-7 shrink-0 rounded-lg transition-all ${
                  isActive
                    ? "bg-white ring-2 ring-offset-1 ring-blue-500"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                <span
                  className="rounded-full"
                  style={{
                    // Preview dot in CSS px — widths are canvas units, so scale
                    // them down to fit the 28px swatch.
                    width: Math.round(Math.min(width, 24) * 0.75),
                    height: Math.round(Math.min(width, 24) * 0.75),
                    backgroundColor: activeColor,
                    outline:
                      activeColor === "#ffffff"
                        ? "1px solid #d1d5db"
                        : undefined,
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-6 shrink-0 bg-gray-200 mx-0.5" aria-hidden="true" />

        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          className={`flex items-center justify-center w-8 h-8 shrink-0 rounded-lg transition-all ${
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
          className="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 active:scale-95 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
