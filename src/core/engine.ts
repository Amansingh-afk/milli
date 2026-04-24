import type { Cell, CellGrid, EngineOptions, Frame, RGB } from './types.js';
import { pickGlyph, rampFor } from './ramp.js';
import { loadAtlas } from './atlas.js';
import { clusterPatch } from './cluster.js';
import { edgeWeights, matchGlyph } from './match.js';

export function frameToCells(frame: Frame, opts: EngineOptions): CellGrid {
  if (opts.mode === 'match') return frameToCellsMatch(frame, opts);
  if (opts.mode === 'braille') return frameToCellsBraille(frame, opts);
  return frameToCellsRamp(frame, opts);
}

// Unicode braille maps 8 sub-pixel dots to bit positions per cell.
// Dot numbering (col, row) → bit:  (0,0)=1 (0,1)=2 (0,2)=3 (1,0)=4 (1,1)=5 (1,2)=6 (0,3)=7 (1,3)=8.
const BRAILLE_BIT: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 2, 6],
  [3, 4, 5, 7],
];

export function frameToCellsBraille(frame: Frame, opts: EngineOptions): CellGrid {
  const { cols, rows, invert, color } = opts;
  const { width, rgb } = frame;
  const cellW = frame.width / cols;
  const cellH = frame.height / rows;
  const grid: CellGrid = [];

  const subR = new Float64Array(8);
  const subG = new Float64Array(8);
  const subB = new Float64Array(8);
  const subLum = new Float64Array(8);

  for (let cy = 0; cy < rows; cy++) {
    const row: Cell[] = [];
    const cy0 = cy * cellH;
    for (let cx = 0; cx < cols; cx++) {
      const cx0 = cx * cellW;

      let totalLum = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const x0 = Math.floor(cx0 + (sx * cellW) / 2);
          const x1 = Math.max(x0 + 1, Math.floor(cx0 + ((sx + 1) * cellW) / 2));
          const y0 = Math.floor(cy0 + (sy * cellH) / 4);
          const y1 = Math.max(y0 + 1, Math.floor(cy0 + ((sy + 1) * cellH) / 4));
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const p = (y * width + x) * 3;
              r += rgb[p]!;
              g += rgb[p + 1]!;
              b += rgb[p + 2]!;
              n++;
            }
          }
          const i = sy * 2 + sx;
          if (n === 0) {
            subR[i] = subG[i] = subB[i] = 0;
            subLum[i] = 0;
          } else {
            const ar = r / n, ag = g / n, ab = b / n;
            subR[i] = ar; subG[i] = ag; subB[i] = ab;
            const l = 0.2126 * ar + 0.7152 * ag + 0.0722 * ab;
            subLum[i] = l;
            totalLum += l;
          }
        }
      }

      const meanLum = totalLum / 8;
      let dotmask = 0;
      let fgR = 0, fgG = 0, fgB = 0, fgN = 0;
      let bgR = 0, bgG = 0, bgB = 0, bgN = 0;

      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const i = sy * 2 + sx;
          const on = invert ? subLum[i]! <= meanLum : subLum[i]! > meanLum;
          if (on) {
            dotmask |= 1 << BRAILLE_BIT[sx]![sy]!;
            fgR += subR[i]!; fgG += subG[i]!; fgB += subB[i]!; fgN++;
          } else {
            bgR += subR[i]!; bgG += subG[i]!; bgB += subB[i]!; bgN++;
          }
        }
      }

      const glyph = String.fromCodePoint(0x2800 | dotmask);
      const fg: RGB = color && fgN > 0
        ? [Math.round(fgR / fgN), Math.round(fgG / fgN), Math.round(fgB / fgN)]
        : [255, 255, 255];
      const bg: RGB = color && bgN > 0
        ? [Math.round(bgR / bgN), Math.round(bgG / bgN), Math.round(bgB / bgN)]
        : [0, 0, 0];

      row.push({ glyph, fg, bg });
    }
    grid.push(row);
  }

  return grid;
}

export function frameToCellsRamp(frame: Frame, opts: EngineOptions): CellGrid {
  const { cols, rows, glyphSet, invert, dither } = opts;
  const ramp = rampFor(glyphSet);
  const grid: CellGrid = [];

  const cellW = frame.width / cols;
  const cellH = frame.height / rows;

  const avgs: RGB[] = new Array(cols * rows);
  const lums = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor(cy * cellH);
    const y1 = Math.floor((cy + 1) * cellH);
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor(cx * cellW);
      const x1 = Math.floor((cx + 1) * cellW);
      const avg = avgPatch(frame, x0, y0, x1, y1);
      const i = cy * cols + cx;
      avgs[i] = avg;
      lums[i] = luminance(avg);
    }
  }

  if (dither) {
    const step = 1 / (ramp.length - 1 || 1);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        const old = Math.min(1, Math.max(0, lums[i]!));
        const quant = Math.round(old / step) * step;
        const err = old - quant;
        lums[i] = quant;
        if (cx + 1 < cols) lums[i + 1]! += (err * 7) / 16;
        if (cy + 1 < rows) {
          if (cx > 0) lums[i + cols - 1]! += (err * 3) / 16;
          lums[i + cols]! += (err * 5) / 16;
          if (cx + 1 < cols) lums[i + cols + 1]! += (err * 1) / 16;
        }
      }
    }
  }

  for (let cy = 0; cy < rows; cy++) {
    const row: Cell[] = [];
    for (let cx = 0; cx < cols; cx++) {
      const i = cy * cols + cx;
      const glyph = pickGlyph(lums[i]!, ramp, invert);
      row.push({ glyph, fg: avgs[i]!, bg: [0, 0, 0] });
    }
    grid.push(row);
  }

  return grid;
}

export function frameToCellsMatch(frame: Frame, opts: EngineOptions): CellGrid {
  const { cols, rows } = opts;
  const atlas = loadAtlas();
  const grid: CellGrid = [];

  const cellW = frame.width / cols;
  const cellH = frame.height / rows;

  for (let cy = 0; cy < rows; cy++) {
    const row: Cell[] = [];
    const y0 = Math.floor(cy * cellH);
    const y1 = Math.max(y0 + 1, Math.floor((cy + 1) * cellH));

    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor(cx * cellW);
      const x1 = Math.max(x0 + 1, Math.floor((cx + 1) * cellW));

      const pxW = x1 - x0;
      const pxH = y1 - y0;
      const patch = extractPatch(frame, x0, y0, pxW, pxH);

      const cluster = clusterPatch(patch, pxW, pxH, atlas.width, atlas.height);

      if (cluster.contrast < 8) {
        const avg: RGB = [
          Math.round((cluster.fg[0] + cluster.bg[0]) / 2),
          Math.round((cluster.fg[1] + cluster.bg[1]) / 2),
          Math.round((cluster.fg[2] + cluster.bg[2]) / 2),
        ];
        row.push({ glyph: ' ', fg: avg, bg: avg });
        continue;
      }

      const w = edgeWeights(cluster.mask, atlas.width, atlas.height);
      const m = matchGlyph(cluster.mask, atlas, true, w);
      const fg = m.invert ? cluster.bg : cluster.fg;
      const bg = m.invert ? cluster.fg : cluster.bg;
      row.push({ glyph: m.glyph, fg, bg });
    }
    grid.push(row);
  }

  return grid;
}

function extractPatch(frame: Frame, x0: number, y0: number, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 3);
  const { width, rgb } = frame;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y0 + y) * width + (x0 + x)) * 3;
      const di = (y * w + x) * 3;
      out[di] = rgb[si]!;
      out[di + 1] = rgb[si + 1]!;
      out[di + 2] = rgb[si + 2]!;
    }
  }
  return out;
}

function avgPatch(frame: Frame, x0: number, y0: number, x1: number, y1: number): RGB {
  let r = 0, g = 0, b = 0, n = 0;
  const { width, rgb } = frame;
  const xe = Math.max(x1, x0 + 1);
  const ye = Math.max(y1, y0 + 1);

  for (let y = y0; y < ye; y++) {
    for (let x = x0; x < xe; x++) {
      const i = (y * width + x) * 3;
      r += rgb[i]!;
      g += rgb[i + 1]!;
      b += rgb[i + 2]!;
      n++;
    }
  }
  if (n === 0) return [0, 0, 0];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function luminance(c: RGB): number {
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

export function fitGrid(
  imgW: number,
  imgH: number,
  maxCols: number,
  maxRows: number,
  charAspect: number,
): { cols: number; rows: number } {
  const imgAspect = imgW / imgH;
  const termAspect = (maxCols * charAspect) / maxRows;

  if (imgAspect > termAspect) {
    const cols = maxCols;
    const rows = Math.max(1, Math.round(cols / imgAspect * charAspect));
    return { cols, rows };
  } else {
    const rows = maxRows;
    const cols = Math.max(1, Math.round(rows * imgAspect / charAspect));
    return { cols, rows };
  }
}
