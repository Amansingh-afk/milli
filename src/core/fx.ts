// Text FX engine for `milli text`. Every effect is a pure-ish frame generator:
// init() builds persistent state from the text mask, frame(i) returns a
// CellGrid. Deterministic for a given seed so exports are reproducible and
// live playback can run forever.

import type { Cell, CellGrid, RGB } from './types.js';
import { padMask, textToMask, type Mask, type TextMaskOptions } from './font.js';

export interface TextFxOptions {
  color: RGB; // base color for effects that take one
  fps: number;
  seed: number;
  mask?: TextMaskOptions;
}

export interface FxInstance {
  cols: number;
  rows: number;
  frame(i: number): CellGrid;
  // Frame count that closes the loop cleanly when baking an export.
  period: number;
}

export type FxName =
  | 'fire'
  | 'glitch'
  | 'wave'
  | 'matrix'
  | 'dissolve'
  | 'typewriter'
  | 'pulse'
  | 'rainbow';

export const FX_NAMES: FxName[] = [
  'fire',
  'glitch',
  'wave',
  'matrix',
  'dissolve',
  'typewriter',
  'pulse',
  'rainbow',
];

const BLACK: RGB = [0, 0, 0];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsv(h: number, s: number, v: number): RGB {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const c = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6]!;
  return [Math.round(c[0]! * 255), Math.round(c[1]! * 255), Math.round(c[2]! * 255)];
}

function scaleRgb(c: RGB, k: number): RGB {
  return [
    Math.max(0, Math.min(255, Math.round(c[0] * k))),
    Math.max(0, Math.min(255, Math.round(c[1] * k))),
    Math.max(0, Math.min(255, Math.round(c[2] * k))),
  ];
}

function blankGrid(cols: number, rows: number): CellGrid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): Cell => ({ glyph: ' ', fg: BLACK, bg: BLACK })),
  );
}

function maskDims(mask: Mask): { w: number; h: number } {
  return { h: mask.length, w: mask.length > 0 ? mask[0]!.length : 0 };
}

// ---------------------------------------------------------------- fire

const FIRE_PALETTE: RGB[] = [
  [0, 0, 0],
  [40, 0, 0],
  [90, 10, 0],
  [140, 30, 0],
  [190, 60, 0],
  [220, 90, 0],
  [240, 130, 10],
  [250, 170, 30],
  [255, 210, 70],
  [255, 245, 160],
  [255, 255, 230],
];
const FIRE_GLYPHS = [' ', '.', ':', '*', '&', '8', '#', '@', '▓', '█', '█'];

function fireFx(mask: Mask, opts: TextFxOptions): FxInstance {
  const { w: mw, h: mh } = maskDims(mask);
  const padTop = Math.max(4, Math.floor(mh * 0.9));
  const m = padMask(mask, padTop, 3, 1, 3);
  const { w: cols, h: rows } = maskDims(m);
  const heat: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  const rng = mulberry32(opts.seed);

  const step = () => {
    // Text cells are flickering heat sources; heat rises with lateral jitter.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (m[y]![x]) heat[y]![x] = 0.85 + rng() * 0.15;
      }
    }
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols; x++) {
        const jitter = Math.floor(rng() * 3) - 1;
        const sx = Math.min(cols - 1, Math.max(0, x + jitter));
        const src = heat[y + 1]![sx]!;
        const decay = 0.08 + rng() * 0.12;
        const next = Math.max(0, src - decay);
        if (!m[y]![x]) heat[y]![x] = next;
      }
    }
  };
  // Warm up so frame 0 already burns.
  for (let i = 0; i < rows; i++) step();

  return {
    cols,
    rows,
    period: opts.fps * 3,
    frame: () => {
      step();
      const grid = blankGrid(cols, rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const h = heat[y]![x]!;
          if (h <= 0.02) continue;
          const idx = Math.min(FIRE_PALETTE.length - 1, Math.floor(h * FIRE_PALETTE.length));
          grid[y]![x] = { glyph: FIRE_GLYPHS[idx]!, fg: FIRE_PALETTE[idx]!, bg: BLACK };
        }
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- glitch

const GLITCH_CHARS = '▚▞▟▙▛▜░▒▓#%&$@!/\\|<>~';

function glitchFx(mask: Mask, opts: TextFxOptions): FxInstance {
  const m = padMask(mask, 1, 5, 1, 5);
  const { w: cols, h: rows } = maskDims(m);
  const base = opts.color;

  return {
    cols,
    rows,
    period: opts.fps * 2,
    frame: (i) => {
      const rng = mulberry32(opts.seed + i * 2654435761);
      const grid = blankGrid(cols, rows);
      const bursting = rng() < 0.35;

      // Channel-split ghosts behind the text during bursts.
      const ghostOff = bursting ? 1 + Math.floor(rng() * 2) : 0;
      for (let y = 0; y < rows; y++) {
        const rowShift = bursting && rng() < 0.3 ? Math.floor(rng() * 7) - 3 : 0;
        for (let x = 0; x < cols; x++) {
          const sx = x - rowShift;
          const draw = (px: number, cell: Cell) => {
            if (px >= 0 && px < cols) grid[y]![px] = cell;
          };
          if (ghostOff && sx - ghostOff >= 0 && sx - ghostOff < cols && m[y]![sx - ghostOff]) {
            draw(x, { glyph: '█', fg: [220, 30, 60], bg: BLACK });
          }
          if (ghostOff && sx + ghostOff >= 0 && sx + ghostOff < cols && m[y]![sx + ghostOff]) {
            draw(x, { glyph: '█', fg: [40, 90, 255], bg: BLACK });
          }
          if (sx >= 0 && sx < cols && m[y]![sx]) {
            const corrupt = bursting && rng() < 0.12;
            draw(x, {
              glyph: corrupt ? GLITCH_CHARS[Math.floor(rng() * GLITCH_CHARS.length)]! : '█',
              fg: corrupt ? scaleRgb(base, 0.6 + rng() * 0.4) : base,
              bg: BLACK,
            });
          }
        }
      }
      // Static specks.
      const specks = bursting ? Math.floor(cols * rows * 0.01) : Math.floor(cols * rows * 0.002);
      for (let s = 0; s < specks; s++) {
        const x = Math.floor(rng() * cols);
        const y = Math.floor(rng() * rows);
        grid[y]![x] = {
          glyph: GLITCH_CHARS[Math.floor(rng() * GLITCH_CHARS.length)]!,
          fg: scaleRgb([255, 255, 255], 0.3 + rng() * 0.5),
          bg: BLACK,
        };
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- wave

function waveFx(mask: Mask, opts: TextFxOptions): FxInstance {
  const amp = 2;
  const m = padMask(mask, amp + 1, 2, amp + 1, 2);
  const { w: cols, h: rows } = maskDims(m);
  const period = opts.fps * 2;

  return {
    cols,
    rows,
    period,
    frame: (i) => {
      const t = (i % period) / period; // 0..1, loops cleanly
      const grid = blankGrid(cols, rows);
      for (let x = 0; x < cols; x++) {
        const dy = Math.round(Math.sin((x / cols) * Math.PI * 4 + t * Math.PI * 2) * amp);
        for (let y = 0; y < rows; y++) {
          const sy = y - dy;
          if (sy < 0 || sy >= rows || !m[sy]![x]) continue;
          grid[y]![x] = { glyph: '█', fg: hsv(x / cols + t, 0.85, 1), bg: BLACK };
        }
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- matrix

const MATRIX_CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅ0123456789Z:･.=*+-<>';

function matrixFx(mask: Mask, opts: TextFxOptions): FxInstance {
  const m = padMask(mask, 2, 3, 2, 3);
  const { w: cols, h: rows } = maskDims(m);
  const rng = mulberry32(opts.seed);
  // One drop per column, staggered so the reveal sweeps over ~2s.
  const drops = Array.from({ length: cols }, () => ({
    start: Math.floor(rng() * opts.fps * 2),
    speed: 0.4 + rng() * 0.6, // rows per frame
  }));
  const holdFrames = opts.fps * 2;
  const fallFrames = opts.fps * 2 + Math.ceil(rows / 0.4);
  const period = fallFrames + holdFrames;

  return {
    cols,
    rows,
    period,
    frame: (i) => {
      const f = i % period;
      const grid = blankGrid(cols, rows);
      const charRng = mulberry32(opts.seed + Math.floor(i / 2) * 7919);
      for (let x = 0; x < cols; x++) {
        const d = drops[x]!;
        const head = (f - d.start) * d.speed;
        for (let y = 0; y < rows; y++) {
          const revealed = head >= y;
          if (m[y]![x]) {
            if (revealed) {
              grid[y]![x] = { glyph: '█', fg: [180, 255, 180], bg: BLACK };
            }
            continue;
          }
          // Rain trail: head bright white, tail fades over ~6 rows.
          const dist = head - y;
          if (dist >= 0 && dist < 7 && head < rows + 7) {
            const ch = MATRIX_CHARS[Math.floor(charRng() * MATRIX_CHARS.length)]!;
            const fg: RGB = dist < 1 ? [230, 255, 230] : scaleRgb([0, 255, 70], 1 - dist / 7);
            grid[y]![x] = { glyph: ch, fg, bg: BLACK };
          }
        }
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- dissolve

function dissolveFx(mask: Mask, opts: TextFxOptions): FxInstance {
  const pad = 5;
  const m = padMask(mask, pad, pad, pad, pad);
  const { w: cols, h: rows } = maskDims(m);
  const rng = mulberry32(opts.seed);

  interface P {
    hx: number;
    hy: number;
    dx: number;
    dy: number;
    delay: number; // 0..0.3 phase offset
  }
  const parts: P[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!m[y]![x]) continue;
      const ang = rng() * Math.PI * 2;
      const dist = 3 + rng() * pad;
      parts.push({
        hx: x,
        hy: y,
        dx: Math.cos(ang) * dist * 2,
        dy: Math.sin(ang) * dist,
        delay: rng() * 0.25,
      });
    }
  }
  const period = opts.fps * 3;

  return {
    cols,
    rows,
    period,
    frame: (i) => {
      const t = (i % period) / period;
      // Triangle wave: assemble 0..0.35 hold, blow apart, return.
      let phase: number;
      if (t < 0.3) phase = 0;
      else if (t < 0.55) phase = (t - 0.3) / 0.25;
      else if (t < 0.75) phase = 1;
      else phase = 1 - (t - 0.75) / 0.25;

      const grid = blankGrid(cols, rows);
      for (const p of parts) {
        const local = Math.max(0, Math.min(1, (phase - p.delay) / (1 - 0.25)));
        const e = local * local * (3 - 2 * local); // smoothstep
        const x = Math.round(p.hx + p.dx * e);
        const y = Math.round(p.hy + p.dy * e);
        if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
        const fade = 1 - e * 0.7;
        const glyph = e < 0.15 ? '█' : e < 0.5 ? '▓' : e < 0.8 ? '▒' : '░';
        grid[y]![x] = { glyph, fg: scaleRgb(opts.color, fade), bg: BLACK };
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- typewriter

function typewriterFx(mask: Mask, opts: TextFxOptions): FxInstance {
  const m = padMask(mask, 1, 3, 1, 1);
  const { w: cols, h: rows } = maskDims(m);
  // Reveal left-to-right by column; ~cols/1.5s total, then hold with blink.
  const revealFrames = Math.max(1, Math.round(opts.fps * 1.5));
  const holdFrames = opts.fps * 2;
  const period = revealFrames + holdFrames;

  // Rightmost occupied column, for cursor parking.
  let lastCol = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) if (m[y]![x] && x > lastCol) lastCol = x;
  }

  return {
    cols,
    rows,
    period,
    frame: (i) => {
      const f = i % period;
      const frontier = f < revealFrames ? Math.ceil(((f + 1) / revealFrames) * cols) : cols;
      const grid = blankGrid(cols, rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (m[y]![x] && x < frontier) grid[y]![x] = { glyph: '█', fg: opts.color, bg: BLACK };
        }
      }
      // Block cursor: rides the frontier, blinks while holding.
      const cx = Math.min(cols - 1, f < revealFrames ? frontier : lastCol + 2);
      const blinkOn = f < revealFrames || Math.floor((f - revealFrames) / (opts.fps / 2)) % 2 === 0;
      if (blinkOn) {
        for (let y = 1; y < rows - 1; y++) {
          grid[y]![cx] = { glyph: '▌', fg: opts.color, bg: BLACK };
        }
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- pulse

function pulseFx(mask: Mask, opts: TextFxOptions): FxInstance {
  const m = padMask(mask, 3, 4, 3, 4);
  const { w: cols, h: rows } = maskDims(m);
  const period = opts.fps * 2;

  // Distance-to-text field (chebyshev, capped at 3) for the glow halo.
  const dist: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(99));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) if (m[y]![x]) dist[y]![x] = 0;
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue;
            dist[y]![x] = Math.min(dist[y]![x]!, dist[ny]![nx]! + 1);
          }
        }
      }
    }
  }

  return {
    cols,
    rows,
    period,
    frame: (i) => {
      const t = (i % period) / period;
      const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2); // 0..1
      const grid = blankGrid(cols, rows);
      const glowReach = 1 + pulse * 2;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const d = dist[y]![x]!;
          if (d === 0) {
            grid[y]![x] = { glyph: '█', fg: scaleRgb(opts.color, 0.65 + 0.35 * pulse), bg: BLACK };
          } else if (d <= glowReach) {
            const k = (1 - d / (glowReach + 0.5)) * (0.25 + 0.3 * pulse);
            grid[y]![x] = { glyph: d <= 1 ? '▒' : '░', fg: scaleRgb(opts.color, k + 0.15), bg: BLACK };
          }
        }
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- rainbow

function rainbowFx(mask: Mask, opts: TextFxOptions): FxInstance {
  const m = padMask(mask, 1, 2, 1, 2);
  const { w: cols, h: rows } = maskDims(m);
  const period = opts.fps * 2;

  return {
    cols,
    rows,
    period,
    frame: (i) => {
      const t = (i % period) / period;
      const grid = blankGrid(cols, rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!m[y]![x]) continue;
          grid[y]![x] = { glyph: '█', fg: hsv(x / cols - t + y * 0.02, 0.9, 1), bg: BLACK };
        }
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- entry

const FX_TABLE: Record<FxName, (mask: Mask, opts: TextFxOptions) => FxInstance> = {
  fire: fireFx,
  glitch: glitchFx,
  wave: waveFx,
  matrix: matrixFx,
  dissolve: dissolveFx,
  typewriter: typewriterFx,
  pulse: pulseFx,
  rainbow: rainbowFx,
};

export function createTextFx(text: string, effect: FxName, opts: Partial<TextFxOptions> = {}): FxInstance {
  const full: TextFxOptions = {
    color: opts.color ?? [0, 255, 190],
    fps: opts.fps ?? 30,
    seed: opts.seed ?? 1337,
    mask: opts.mask,
  };
  const make = FX_TABLE[effect];
  if (!make) {
    throw new Error(`unknown effect: ${effect} (want one of: ${FX_NAMES.join(', ')})`);
  }
  const mask = textToMask(text, full.mask);
  if (mask.length === 0 || mask[0]!.length === 0) throw new Error('empty text');
  return make(mask, full);
}
