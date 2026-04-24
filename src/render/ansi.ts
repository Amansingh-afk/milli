import type { Cell, CellGrid, RGB } from '../core/types.js';

const RESET = '\x1b[0m';

export interface AnsiOptions {
  color: boolean;
  background: boolean;
  // 0 = emit all bg, 1 = skip all bg, between = skip bg whose luma < threshold.
  // Ignored when `background` is false.
  bgThreshold?: number;
}

function luma(rgb: RGB): number {
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
}

function bgVisible(bg: RGB, threshold: number): boolean {
  if (threshold <= 0) return true;
  if (threshold >= 1) return false;
  return luma(bg) >= threshold;
}

export interface DiffResult {
  ansi: string;
  changed: number;
  total: number;
}

export function cellsToAnsi(grid: CellGrid, opts: AnsiOptions = { color: true, background: false }): string {
  let out = '';
  let lastFg = '';
  let lastBg = '';
  const threshold = opts.bgThreshold ?? 0;

  for (const row of grid) {
    for (const cell of row) {
      if (opts.color) {
        const [r, g, b] = cell.fg;
        const fg = `\x1b[38;2;${r};${g};${b}m`;
        if (fg !== lastFg) {
          out += fg;
          lastFg = fg;
        }
        if (opts.background) {
          if (bgVisible(cell.bg, threshold)) {
            const [br, bg_, bb] = cell.bg;
            const bg = `\x1b[48;2;${br};${bg_};${bb}m`;
            if (bg !== lastBg) {
              out += bg;
              lastBg = bg;
            }
          } else if (lastBg !== '\x1b[49m') {
            out += '\x1b[49m';
            lastBg = '\x1b[49m';
          }
        }
      }
      out += cell.glyph;
    }
    out += RESET + '\n';
    lastFg = '';
    lastBg = '';
  }
  return out;
}

export interface PlacedAnsiOptions extends AnsiOptions {
  termX?: number;
  termY?: number;
  region?: { x: number; y: number; w: number; h: number };
}

export function cellsToAnsiPlaced(grid: CellGrid, opts: PlacedAnsiOptions): string {
  const termX = opts.termX ?? 1;
  const termY = opts.termY ?? 1;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const r = opts.region ?? { x: 0, y: 0, w: cols, h: rows };
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(cols, x0 + r.w);
  const y1 = Math.min(rows, y0 + r.h);

  let out = '';
  let lastFg = '';
  let lastBg = '';

  for (let y = y0; y < y1; y++) {
    const row = grid[y]!;
    out += `\x1b[${termY + (y - y0)};${termX}H`;
    for (let x = x0; x < x1; x++) {
      const cell = row[x]!;
      if (opts.color) {
        const fg = `\x1b[38;2;${cell.fg[0]};${cell.fg[1]};${cell.fg[2]}m`;
        if (fg !== lastFg) {
          out += fg;
          lastFg = fg;
        }
        if (opts.background) {
          const bg = `\x1b[48;2;${cell.bg[0]};${cell.bg[1]};${cell.bg[2]}m`;
          if (bg !== lastBg) {
            out += bg;
            lastBg = bg;
          }
        }
      }
      out += cell.glyph;
    }
    out += RESET;
    lastFg = '';
    lastBg = '';
  }
  return out;
}

export function cellsToAnsiDiff(
  prev: CellGrid,
  cur: CellGrid,
  opts: AnsiOptions = { color: true, background: true },
): DiffResult {
  let out = '';
  let lastFg = '';
  let lastBg = '';
  let cursorY = -1;
  let cursorX = -1;
  let changed = 0;
  const rows = cur.length;
  const cols = cur[0]?.length ?? 0;

  for (let y = 0; y < rows; y++) {
    const prevRow = prev[y] ?? [];
    const curRow = cur[y]!;
    for (let x = 0; x < cols; x++) {
      const c = curRow[x]!;
      const p = prevRow[x];
      if (sameCell(p, c)) continue;
      changed++;

      if (cursorY !== y || cursorX !== x) {
        out += `\x1b[${y + 1};${x + 1}H`;
        cursorY = y;
        cursorX = x;
      }

      if (opts.color) {
        const fg = `\x1b[38;2;${c.fg[0]};${c.fg[1]};${c.fg[2]}m`;
        if (fg !== lastFg) {
          out += fg;
          lastFg = fg;
        }
        if (opts.background) {
          const bg = `\x1b[48;2;${c.bg[0]};${c.bg[1]};${c.bg[2]}m`;
          if (bg !== lastBg) {
            out += bg;
            lastBg = bg;
          }
        }
      }

      out += c.glyph;
      cursorX = x + 1;
    }
  }

  return { ansi: out, changed, total: rows * cols };
}

function sameCell(a: Cell | undefined, b: Cell): boolean {
  if (!a) return false;
  return (
    a.glyph === b.glyph &&
    a.fg[0] === b.fg[0] &&
    a.fg[1] === b.fg[1] &&
    a.fg[2] === b.fg[2] &&
    a.bg[0] === b.bg[0] &&
    a.bg[1] === b.bg[1] &&
    a.bg[2] === b.bg[2]
  );
}

export const ANSI = {
  altScreenEnter: '\x1b[?1049h',
  altScreenExit: '\x1b[?1049l',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  home: '\x1b[H',
  clear: '\x1b[2J',
  reset: RESET,
};
