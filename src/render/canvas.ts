import type { CellGrid, RGB } from '../core/types.js';

export interface CanvasRenderOptions {
  cellWidth?: number;
  cellHeight?: number;
  font?: string;
  color?: boolean;
  background?: boolean;
  // 0 = draw all bg, 1 = skip all bg, between = skip bg cells whose luma < threshold.
  // Ignored when `background` is false.
  bgThreshold?: number;
}

export interface CanvasMetrics {
  cellWidth: number;
  cellHeight: number;
  pixelWidth: number;
  pixelHeight: number;
}

export function measureCanvas(grid: CellGrid, opts: CanvasRenderOptions = {}): CanvasMetrics {
  const cellWidth = opts.cellWidth ?? 8;
  const cellHeight = opts.cellHeight ?? 16;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  return {
    cellWidth,
    cellHeight,
    pixelWidth: cols * cellWidth,
    pixelHeight: rows * cellHeight,
  };
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function luma(rgb: RGB): number {
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
}

function bgVisible(bg: RGB, threshold: number): boolean {
  if (threshold <= 0) return true;
  if (threshold >= 1) return false;
  return luma(bg) >= threshold;
}

export function cellsToCanvas(
  grid: CellGrid,
  ctx: Ctx2D,
  opts: CanvasRenderOptions = {},
): void {
  const cellW = opts.cellWidth ?? 8;
  const cellH = opts.cellHeight ?? 16;
  const color = opts.color ?? true;
  const bgOn = opts.background ?? true;
  const bgThreshold = opts.bgThreshold ?? 0;
  const font = opts.font ?? `${cellH}px "JetBrains Mono", "Fira Code", monospace`;

  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  (ctx as CanvasRenderingContext2D).imageSmoothingEnabled = false;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (bgOn) {
    for (let y = 0; y < rows; y++) {
      const row = grid[y]!;
      let runStart = 0;
      let runBg = row[0] && bgVisible(row[0].bg, bgThreshold) ? row[0].bg : undefined;
      for (let x = 1; x <= cols; x++) {
        const next = row[x];
        const cur = next && bgVisible(next.bg, bgThreshold) ? next.bg : undefined;
        const same =
          cur && runBg && cur[0] === runBg[0] && cur[1] === runBg[1] && cur[2] === runBg[2];
        if (!same) {
          if (runBg) {
            ctx.fillStyle = `rgb(${runBg[0]},${runBg[1]},${runBg[2]})`;
            ctx.fillRect(runStart * cellW, y * cellH, (x - runStart) * cellW, cellH);
          }
          runStart = x;
          runBg = cur;
        }
      }
    }
  }

  for (let y = 0; y < rows; y++) {
    const row = grid[y]!;
    for (let x = 0; x < cols; x++) {
      const cell = row[x]!;
      if (cell.glyph === ' ') continue;
      if (color) {
        ctx.fillStyle = `rgb(${cell.fg[0]},${cell.fg[1]},${cell.fg[2]})`;
      } else {
        ctx.fillStyle = '#fff';
      }
      ctx.fillText(cell.glyph, x * cellW, y * cellH);
    }
  }
}

export function cellsToHtml(grid: CellGrid, opts: { color?: boolean } = {}): string {
  const color = opts.color ?? true;
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = '<pre class="milli">';
  for (const row of grid) {
    for (const cell of row) {
      if (color) {
        const [r, g, b] = cell.fg;
        const [br, bg, bb] = cell.bg;
        out += `<span style="color:rgb(${r},${g},${b});background:rgb(${br},${bg},${bb})">${esc(cell.glyph)}</span>`;
      } else {
        out += esc(cell.glyph);
      }
    }
    out += '\n';
  }
  return out + '</pre>';
}
