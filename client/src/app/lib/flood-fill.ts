/**
 * flood-fill.ts
 *
 * Stack-based (BFS) flood fill with tolerance-based color matching.
 * NOT recursive — recursion blows the call stack on any reasonably large canvas.
 *
 * The tolerance comparison is against the *starting* pixel's original color,
 * not against whatever color we last painted. This prevents the fill from
 * leaking through anti-aliased stroke edges while still covering them fully.
 */

/** Parse a CSS hex color (#rrggbb or #rgb) into [r, g, b, 255]. */
function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    const [r, g, b] = h.split("").map((c) => parseInt(c + c, 16));
    return [r, g, b, 255];
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b, 255];
}

/** Euclidean distance between two RGBA pixels (ignoring alpha). */
function colorDistance(
  a: Uint8ClampedArray,
  aOffset: number,
  b: [number, number, number, number],
): number {
  const dr = a[aOffset] - b[0];
  const dg = a[aOffset + 1] - b[1];
  const db = a[aOffset + 2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Run a flood fill on the given canvas context.
 *
 * @param ctx       - 2D rendering context
 * @param startX    - X coordinate of the seed pixel (canvas space, integer)
 * @param startY    - Y coordinate of the seed pixel (canvas space, integer)
 * @param fillColor - CSS hex color to fill with (e.g. "#ef4444")
 * @param tolerance - Per-channel Euclidean distance threshold (default 40)
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string,
  tolerance = 40,
): void {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const sx = Math.round(startX);
  const sy = Math.round(startY);

  // Clamp to canvas bounds
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

  const startOffset = (sy * width + sx) * 4;
  const targetColor: [number, number, number, number] = [
    data[startOffset],
    data[startOffset + 1],
    data[startOffset + 2],
    data[startOffset + 3],
  ];

  const fill = hexToRgba(fillColor);

  // If the seed pixel already matches the fill color closely, bail out
  // (avoids flooding the entire canvas when clicking on an already-filled area).
  if (colorDistance(new Uint8ClampedArray(fill), 0, targetColor) < tolerance) return;

  // Visited flags — one boolean per pixel, avoids re-queuing
  const visited = new Uint8Array(width * height);

  const stack: number[] = [sy * width + sx];
  visited[sy * width + sx] = 1;

  while (stack.length > 0) {
    const idx = stack.pop()!;
    const offset = idx * 4;

    // Paint this pixel
    data[offset] = fill[0];
    data[offset + 1] = fill[1];
    data[offset + 2] = fill[2];
    data[offset + 3] = fill[3];

    const x = idx % width;
    const y = (idx - x) / width;

    // Check 4-connected neighbours
    const neighbours: [number, number][] = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];

    for (const [nx, ny] of neighbours) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      const nOffset = nIdx * 4;
      if (colorDistance(data, nOffset, targetColor) <= tolerance) {
        visited[nIdx] = 1;
        stack.push(nIdx);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
