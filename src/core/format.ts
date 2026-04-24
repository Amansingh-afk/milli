import { gzip, ungzip } from 'pako';
import type { CellGrid, RGB } from './types.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

export const MILLI_VERSION = 2;
const KEYFRAME_INTERVAL = 60;
const DELTA_RATIO_MAX = 0.4;

export interface MilliFrame {
  delay: number;
  g: number[];
  fg: number[];
  bg: number[];
}

interface MilliKeyframeRaw {
  delay: number;
  k: 1;
  g: number[];
  fg: number[];
  bg: number[];
}

interface MilliDeltaFrameRaw {
  delay: number;
  k: 0;
  idx: number[];
  g: number[];
  fg: number[];
  bg: number[];
}

type MilliRawFrame = MilliKeyframeRaw | MilliDeltaFrameRaw;

interface MilliFileV1 {
  version: 1;
  width: number;
  height: number;
  loop: boolean;
  glyphs: string;
  frames: MilliFrame[];
}

interface MilliFileV2Raw {
  version: 2;
  width: number;
  height: number;
  loop: boolean;
  glyphs: string;
  frames: MilliRawFrame[];
}

export interface MilliFile {
  version: number;
  width: number;
  height: number;
  loop: boolean;
  glyphs: string;
  frames: MilliFrame[];
}

export function encodeMilli(grids: CellGrid[], delays: number[], loop: boolean): Uint8Array {
  if (grids.length === 0) throw new Error('encodeMilli: no frames');
  const first = grids[0]!;
  const height = first.length;
  const width = first[0]?.length ?? 0;
  const n = width * height;

  const glyphSet = new Set<string>();
  for (const grid of grids) {
    for (const row of grid) {
      for (const cell of row) glyphSet.add(cell.glyph);
    }
  }
  const glyphList = [...glyphSet];
  const glyphIdx = new Map<string, number>();
  glyphList.forEach((g, i) => glyphIdx.set(g, i));

  const fullG = new Array<Int32Array>(grids.length);
  const fullFg = new Array<Uint8Array>(grids.length);
  const fullBg = new Array<Uint8Array>(grids.length);
  for (let i = 0; i < grids.length; i++) {
    const grid = grids[i]!;
    const g = new Int32Array(n);
    const fg = new Uint8Array(n * 3);
    const bg = new Uint8Array(n * 3);
    let k = 0;
    for (let y = 0; y < height; y++) {
      const row = grid[y]!;
      for (let x = 0; x < width; x++) {
        const c = row[x]!;
        g[k] = glyphIdx.get(c.glyph)!;
        fg[k * 3] = c.fg[0];
        fg[k * 3 + 1] = c.fg[1];
        fg[k * 3 + 2] = c.fg[2];
        bg[k * 3] = c.bg[0];
        bg[k * 3 + 1] = c.bg[1];
        bg[k * 3 + 2] = c.bg[2];
        k++;
      }
    }
    fullG[i] = g;
    fullFg[i] = fg;
    fullBg[i] = bg;
  }

  const frames: MilliRawFrame[] = [];
  let lastKeyIdx = -KEYFRAME_INTERVAL;

  for (let i = 0; i < grids.length; i++) {
    const delay = delays[i] ?? 100;
    const gi = fullG[i]!;
    const fgi = fullFg[i]!;
    const bgi = fullBg[i]!;

    const forceKey = i === 0 || i - lastKeyIdx >= KEYFRAME_INTERVAL;
    if (!forceKey) {
      const prevG = fullG[i - 1]!;
      const prevFg = fullFg[i - 1]!;
      const prevBg = fullBg[i - 1]!;
      const changedIdx: number[] = [];
      for (let k = 0; k < n; k++) {
        if (
          gi[k] !== prevG[k] ||
          fgi[k * 3] !== prevFg[k * 3] ||
          fgi[k * 3 + 1] !== prevFg[k * 3 + 1] ||
          fgi[k * 3 + 2] !== prevFg[k * 3 + 2] ||
          bgi[k * 3] !== prevBg[k * 3] ||
          bgi[k * 3 + 1] !== prevBg[k * 3 + 1] ||
          bgi[k * 3 + 2] !== prevBg[k * 3 + 2]
        ) {
          changedIdx.push(k);
        }
      }
      if (changedIdx.length / n <= DELTA_RATIO_MAX) {
        const dg = new Array<number>(changedIdx.length);
        const dfg = new Array<number>(changedIdx.length * 3);
        const dbg = new Array<number>(changedIdx.length * 3);
        for (let j = 0; j < changedIdx.length; j++) {
          const k = changedIdx[j]!;
          dg[j] = gi[k]!;
          dfg[j * 3] = fgi[k * 3]!;
          dfg[j * 3 + 1] = fgi[k * 3 + 1]!;
          dfg[j * 3 + 2] = fgi[k * 3 + 2]!;
          dbg[j * 3] = bgi[k * 3]!;
          dbg[j * 3 + 1] = bgi[k * 3 + 1]!;
          dbg[j * 3 + 2] = bgi[k * 3 + 2]!;
        }
        frames.push({ delay, k: 0, idx: changedIdx, g: dg, fg: dfg, bg: dbg });
        continue;
      }
    }

    frames.push({
      delay,
      k: 1,
      g: Array.from(gi),
      fg: Array.from(fgi),
      bg: Array.from(bgi),
    });
    lastKeyIdx = i;
  }

  const file: MilliFileV2Raw = {
    version: 2,
    width,
    height,
    loop,
    glyphs: glyphList.join(''),
    frames,
  };

  return gzip(encoder.encode(JSON.stringify(file)));
}

export function decodeMilli(buf: Uint8Array): MilliFile {
  const json = decoder.decode(ungzip(buf));
  const raw = JSON.parse(json) as MilliFileV1 | MilliFileV2Raw;

  if (raw.version === 1) {
    return {
      version: 1,
      width: raw.width,
      height: raw.height,
      loop: raw.loop,
      glyphs: raw.glyphs,
      frames: raw.frames,
    };
  }

  if (raw.version !== 2) {
    throw new Error(`unsupported .milli version ${(raw as { version: number }).version}`);
  }

  const { width, height } = raw;
  const frames: MilliFrame[] = new Array(raw.frames.length);
  let prevG: number[] = [];
  let prevFg: number[] = [];
  let prevBg: number[] = [];

  for (let i = 0; i < raw.frames.length; i++) {
    const f = raw.frames[i]!;
    if (f.k === 1) {
      frames[i] = { delay: f.delay, g: f.g, fg: f.fg, bg: f.bg };
      prevG = f.g;
      prevFg = f.fg;
      prevBg = f.bg;
    } else {
      const g = prevG.slice();
      const fg = prevFg.slice();
      const bg = prevBg.slice();
      for (let j = 0; j < f.idx.length; j++) {
        const k = f.idx[j]!;
        g[k] = f.g[j]!;
        fg[k * 3] = f.fg[j * 3]!;
        fg[k * 3 + 1] = f.fg[j * 3 + 1]!;
        fg[k * 3 + 2] = f.fg[j * 3 + 2]!;
        bg[k * 3] = f.bg[j * 3]!;
        bg[k * 3 + 1] = f.bg[j * 3 + 1]!;
        bg[k * 3 + 2] = f.bg[j * 3 + 2]!;
      }
      frames[i] = { delay: f.delay, g, fg, bg };
      prevG = g;
      prevFg = fg;
      prevBg = bg;
    }
  }

  return {
    version: 2,
    width,
    height,
    loop: raw.loop,
    glyphs: raw.glyphs,
    frames,
  };
}

export function frameToGrid(file: MilliFile, frameIdx: number): CellGrid {
  const frame = file.frames[frameIdx]!;
  const glyphs = [...file.glyphs];
  const { width, height } = file;
  const grid: CellGrid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const k = y * width + x;
      const fg: RGB = [frame.fg[k * 3]!, frame.fg[k * 3 + 1]!, frame.fg[k * 3 + 2]!];
      const bg: RGB = [frame.bg[k * 3]!, frame.bg[k * 3 + 1]!, frame.bg[k * 3 + 2]!];
      row.push({ glyph: glyphs[frame.g[k]!] ?? ' ', fg, bg });
    }
    grid.push(row);
  }
  return grid;
}
