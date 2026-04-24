import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { CellGrid, GlyphSet, RenderMode } from '../core/types.js';
import { fitGrid, frameToCells } from '../core/engine.js';
import {
  emitGoData,
  emitGoHelper,
  emitJson,
  emitLuaData,
  emitLuaHelper,
} from '../core/emit.js';
import { decodeAnimation, decodeImage } from './decode.js';

export type ExportTarget = 'go' | 'lua' | 'json';

export interface ExportOptions {
  target: ExportTarget;
  width: number;
  height?: number;
  mode: RenderMode;
  glyphSet: GlyphSet;
  charAspect: number;
  packageName?: string;
  withHelper: boolean;
  color: boolean;
  // 0 = keep all bg, 1 = drop all bg, between = luma-gated threshold.
  backgroundThreshold: number;
}

export interface ExportResult {
  files: string[];
  frameCount: number;
  cols: number;
  rows: number;
}

export async function exportFromFile(
  inPath: string,
  outDir: string,
  opts: ExportOptions,
): Promise<ExportResult> {
  const isAnim = /\.(gif|webp|apng)$/i.test(inPath);

  let frames, delays: number[];
  let srcW: number, srcH: number;
  if (isAnim) {
    const anim = await decodeAnimation(inPath);
    frames = anim.frames;
    delays = anim.delays;
    srcW = anim.width;
    srcH = anim.height;
  } else {
    const single = await decodeImage(inPath);
    frames = [single];
    delays = [0];
    srcW = single.width;
    srcH = single.height;
  }

  const { cols, rows } = fitGrid(srcW, srcH, opts.width, opts.height ?? 9999, opts.charAspect);
  const grids: CellGrid[] = frames.map((f) =>
    frameToCells(f, {
      cols,
      rows,
      mode: opts.mode,
      glyphSet: opts.glyphSet,
      color: true,
      invert: false,
      charAspect: opts.charAspect,
    }),
  );

  await mkdir(outDir, { recursive: true });
  const files: string[] = [];
  const threshold = opts.backgroundThreshold;

  switch (opts.target) {
    case 'go': {
      const pkg = opts.packageName ?? basename(resolve(outDir));
      const dataPath = resolve(outDir, 'frames.go');
      await writeFile(dataPath, emitGoData(grids, delays, cols, rows, pkg, threshold));
      files.push(dataPath);
      if (opts.withHelper) {
        const helperPath = resolve(outDir, 'splash.go');
        await writeFile(helperPath, emitGoHelper(pkg));
        files.push(helperPath);
      }
      break;
    }
    case 'lua': {
      const dataPath = resolve(outDir, 'frames.lua');
      await writeFile(dataPath, emitLuaData(grids, delays, cols, rows, opts.color, threshold));
      files.push(dataPath);
      if (opts.withHelper) {
        const helperPath = resolve(outDir, 'init.lua');
        await writeFile(helperPath, emitLuaHelper());
        files.push(helperPath);
      }
      break;
    }
    case 'json': {
      const p = resolve(outDir, 'frames.json');
      await writeFile(p, emitJson(grids, delays, cols, rows));
      files.push(p);
      break;
    }
  }

  return { files, frameCount: grids.length, cols, rows };
}
