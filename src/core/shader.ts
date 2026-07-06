// Procedural terminal shaders for `milli shader`. No frames on disk — each
// one computes cells from (x, y, t) like a fragment shader. Infinite,
// resolution-independent, seeded-deterministic.

import type { Cell, CellGrid, RGB } from './types.js';

export interface ShaderOptions {
  cols: number;
  rows: number;
  fps: number;
  seed: number;
  hue?: number; // 0..1 base hue override for shaders that take one
}

export interface ShaderInstance {
  cols: number;
  rows: number;
  frame(i: number): CellGrid;
  // Frames for a clean-ish export loop (procedurals don't all loop perfectly;
  // this picks a count where the seam is least visible).
  period: number;
}

export type ShaderName = 'plasma' | 'rain' | 'doomfire' | 'starfield' | 'tunnel' | 'waves';

export const SHADER_NAMES: ShaderName[] = ['plasma', 'rain', 'doomfire', 'starfield', 'tunnel', 'waves'];

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

const RAMP = ' ░▒▓█';
function rampCell(v: number, fg: RGB): Cell {
  const idx = Math.max(0, Math.min(RAMP.length - 1, Math.floor(v * RAMP.length)));
  return { glyph: RAMP[idx]!, fg, bg: BLACK };
}

// ---------------------------------------------------------------- plasma

function plasma(o: ShaderOptions): ShaderInstance {
  const { cols, rows, fps } = o;
  return {
    cols,
    rows,
    period: fps * 8,
    frame: (i) => {
      const t = i / fps;
      const grid = blankGrid(cols, rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const nx = x / cols;
          const ny = (y / rows) * 2; // compensate cell aspect
          const v =
            Math.sin(nx * 6 + t) +
            Math.sin((ny + t) * 3) +
            Math.sin((nx + ny + t) * 4) +
            Math.sin(Math.hypot(nx - 0.5, ny - 1) * 10 - t * 2);
          const n = (v + 4) / 8; // 0..1
          const hue = (o.hue ?? 0) + n * 0.7 + t * 0.02;
          grid[y]![x] = { glyph: '█', fg: hsv(hue, 0.8, 0.45 + n * 0.55), bg: BLACK };
        }
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- rain (matrix)

const RAIN_CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅ0123456789Z:･.=*+-<>';

function rain(o: ShaderOptions): ShaderInstance {
  const { cols, rows, fps, seed } = o;
  const rng = mulberry32(seed);
  const drops = Array.from({ length: cols }, () => ({
    y: -Math.floor(rng() * rows * 2),
    speed: 0.3 + rng() * 0.7,
    len: 4 + Math.floor(rng() * (rows / 2)),
  }));
  const baseHue = o.hue ?? 1 / 3; // matrix green

  return {
    cols,
    rows,
    period: fps * 10,
    frame: (i) => {
      const grid = blankGrid(cols, rows);
      const charRng = mulberry32(seed + Math.floor(i / 2) * 7919);
      for (let x = 0; x < cols; x++) {
        const d = drops[x]!;
        d.y += d.speed;
        if (d.y - d.len > rows) {
          d.y = -Math.floor(rng() * rows);
          d.speed = 0.3 + rng() * 0.7;
          d.len = 4 + Math.floor(rng() * (rows / 2));
        }
        const head = Math.floor(d.y);
        for (let k = 0; k < d.len; k++) {
          const y = head - k;
          if (y < 0 || y >= rows) continue;
          const ch = RAIN_CHARS[Math.floor(charRng() * RAIN_CHARS.length)]!;
          const fg: RGB =
            k === 0 ? [235, 255, 235] : hsvDim(baseHue, 1 - k / d.len);
          grid[y]![x] = { glyph: ch, fg, bg: BLACK };
        }
      }
      return grid;
    },
  };

  function hsvDim(h: number, k: number): RGB {
    return scaleRgb(hsv(h, 0.9, 1), Math.max(0.12, k));
  }
}

// ---------------------------------------------------------------- doomfire

const DOOM_PALETTE: RGB[] = [
  [0, 0, 0], [31, 7, 7], [71, 15, 7], [103, 31, 7], [143, 39, 7],
  [175, 63, 7], [199, 71, 7], [223, 79, 7], [223, 105, 15], [215, 127, 23],
  [207, 143, 31], [207, 159, 47], [215, 175, 63], [223, 191, 79],
  [239, 219, 111], [255, 255, 255],
];
const DOOM_GLYPHS = ' ..::**&&##@@▓▓██';

function doomfire(o: ShaderOptions): ShaderInstance {
  const { cols, rows, fps, seed } = o;
  const rng = mulberry32(seed);
  const heat: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  heat[rows - 1] = new Array<number>(cols).fill(15);

  const step = () => {
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols; x++) {
        const jitter = Math.floor(rng() * 3) - 1;
        const sx = Math.min(cols - 1, Math.max(0, x + jitter));
        const cool = rng() < 0.4 ? 1 : 0;
        heat[y]![x] = Math.max(0, heat[y + 1]![sx]! - cool);
      }
    }
  };
  for (let i = 0; i < rows; i++) step();

  return {
    cols,
    rows,
    period: fps * 4,
    frame: () => {
      step();
      const grid = blankGrid(cols, rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const h = heat[y]![x]!;
          if (h === 0) continue;
          grid[y]![x] = { glyph: DOOM_GLYPHS[h]!, fg: DOOM_PALETTE[h]!, bg: BLACK };
        }
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- starfield

function starfield(o: ShaderOptions): ShaderInstance {
  const { cols, rows, fps, seed } = o;
  const rng = mulberry32(seed);
  const N = Math.floor((cols * rows) / 18);
  interface Star { x: number; y: number; z: number }
  const stars: Star[] = Array.from({ length: N }, () => ({
    x: rng() * 2 - 1,
    y: rng() * 2 - 1,
    z: 0.1 + rng() * 0.9,
  }));
  const GLYPH_BY_DEPTH = ['·', '•', '*', '✦', '█'];

  return {
    cols,
    rows,
    period: fps * 6,
    frame: () => {
      const grid = blankGrid(cols, rows);
      for (const s of stars) {
        s.z -= 0.012;
        if (s.z <= 0.05) {
          s.x = rng() * 2 - 1;
          s.y = rng() * 2 - 1;
          s.z = 1;
        }
        const px = Math.round(((s.x / s.z) * 0.5 + 0.5) * (cols - 1));
        const py = Math.round(((s.y / s.z) * 0.5 + 0.5) * (rows - 1));
        if (px < 0 || px >= cols || py < 0 || py >= rows) continue;
        const near = 1 - s.z; // 0 far .. ~1 near
        const gi = Math.min(GLYPH_BY_DEPTH.length - 1, Math.floor(near * GLYPH_BY_DEPTH.length));
        const warm = hsv(o.hue ?? 0.6, 0.25 * (1 - near), 0.35 + near * 0.65);
        grid[py]![px] = { glyph: GLYPH_BY_DEPTH[gi]!, fg: warm, bg: BLACK };
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- tunnel

function tunnel(o: ShaderOptions): ShaderInstance {
  const { cols, rows, fps } = o;
  return {
    cols,
    rows,
    period: fps * 4,
    frame: (i) => {
      const t = i / fps;
      const grid = blankGrid(cols, rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const dx = (x / cols - 0.5) * 2;
          const dy = (y / rows - 0.5) * 2;
          const r = Math.hypot(dx, dy) + 1e-6;
          const a = Math.atan2(dy, dx);
          const depth = 0.4 / r + t * 1.5;
          const swirl = a / Math.PI * 4 + t;
          const band = (Math.floor(depth * 4) + Math.floor(swirl * 2)) % 2;
          const shade = Math.min(1, r * 1.2) * (band ? 1 : 0.45);
          const hue = (o.hue ?? 0.75) + depth * 0.03;
          grid[y]![x] = rampCell(shade, hsv(hue, 0.75, Math.min(1, 0.25 + shade)));
        }
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- waves

function waves(o: ShaderOptions): ShaderInstance {
  const { cols, rows, fps } = o;
  const period = fps * 4;
  return {
    cols,
    rows,
    period,
    frame: (i) => {
      const t = ((i % period) / period) * Math.PI * 2;
      const grid = blankGrid(cols, rows);
      for (let x = 0; x < cols; x++) {
        const nx = x / cols;
        // Stacked sine layers, back to front.
        for (let layer = 0; layer < 4; layer++) {
          const yBase = rows * (0.35 + layer * 0.17);
          const ampL = 1.5 + layer * 0.8;
          const surf = yBase + Math.sin(nx * (6 - layer) * Math.PI + t * (layer % 2 ? 1 : -1)) * ampL;
          const hue = (o.hue ?? 0.55) + layer * 0.02;
          for (let y = Math.max(0, Math.round(surf)); y < rows; y++) {
            const depthK = 0.25 + (layer / 4) * 0.6;
            const foam = y === Math.round(surf);
            grid[y]![x] = foam
              ? { glyph: '▔', fg: [235, 245, 255], bg: BLACK }
              : rampCell(depthK, hsv(hue, 0.8, depthK + 0.15));
          }
        }
      }
      return grid;
    },
  };
}

// ---------------------------------------------------------------- entry

const SHADER_TABLE: Record<ShaderName, (o: ShaderOptions) => ShaderInstance> = {
  plasma,
  rain,
  doomfire,
  starfield,
  tunnel,
  waves,
};

export function createShader(name: ShaderName, opts: Partial<ShaderOptions> = {}): ShaderInstance {
  const full: ShaderOptions = {
    cols: opts.cols ?? 80,
    rows: opts.rows ?? 24,
    fps: opts.fps ?? 30,
    seed: opts.seed ?? 1337,
    hue: opts.hue,
  };
  const make = SHADER_TABLE[name];
  if (!make) {
    throw new Error(`unknown shader: ${name} (want one of: ${SHADER_NAMES.join(', ')})`);
  }
  return make(full);
}
