#!/usr/bin/env node
import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { decodeAnimation, decodeImage } from '../src/cli/decode.js';
import { exportFromFile, type ExportTarget } from '../src/cli/export.js';
import { fitGrid, frameToCells } from '../src/core/engine.js';
import { decodeMilli, encodeMilli, frameToGrid } from '../src/core/format.js';
import { cellsToAnsi } from '../src/render/ansi.js';
import { play } from '../src/render/player.js';
import type { CellGrid, EngineOptions, GlyphSet, RenderMode } from '../src/core/types.js';

const program = new Command();

program
  .name('milli')
  .description('Pixel-perfect ASCII art. Images now, video soon.')
  .version('0.0.1');

program
  .command('image <path>', { isDefault: true })
  .description('Render image as ASCII to stdout')
  .option('-w, --width <cols>', 'columns (chars wide)', (v) => parseInt(v, 10))
  .option('-h, --height <rows>', 'rows (chars tall)', (v) => parseInt(v, 10))
  .option('-m, --mode <mode>', 'render mode: match|ramp|braille', 'match')
  .option('-s, --symbols <set>', 'glyph set (ramp mode): ascii|block|braille|all', 'ascii')
  .option('--no-color', 'monochrome output')
  .option('--bg', 'render background color (auto on for match mode)', false)
  .option('--invert', 'invert luminance ramp', false)
  .option('--dither', 'Floyd-Steinberg dither (ramp mode only)', false)
  .option('--aspect <ratio>', 'char width/height ratio', (v) => parseFloat(v), 0.5)
  .action(async (path: string, opts) => {
    const frame = await decodeImage(path);

    const termCols = opts.width ?? process.stdout.columns ?? 100;
    const termRows = opts.height ?? (process.stdout.rows ? process.stdout.rows - 2 : 40);
    const { cols, rows } = fitGrid(frame.width, frame.height, termCols, termRows, opts.aspect);

    const mode = opts.mode as RenderMode;
    const grid = frameToCells(frame, {
      cols,
      rows,
      mode,
      glyphSet: opts.symbols as GlyphSet,
      color: opts.color,
      invert: opts.invert,
      charAspect: opts.aspect,
      dither: opts.dither,
    });

    const bg = opts.bg || mode === 'match';
    process.stdout.write(cellsToAnsi(grid, { color: opts.color, background: bg }));
  });

program
  .command('play <path>')
  .description('Play animated GIF or .milli file as ASCII in terminal')
  .option('-w, --width <cols>', 'columns', (v) => parseInt(v, 10))
  .option('-h, --height <rows>', 'rows', (v) => parseInt(v, 10))
  .option('-m, --mode <mode>', 'render mode: match|ramp|braille', 'match')
  .option('-s, --symbols <set>', 'glyph set (ramp mode)', 'ascii')
  .option('--no-color', 'monochrome')
  .option('--no-loop', 'play once and exit')
  .option('--fps <n>', 'override fps', (v) => parseFloat(v))
  .option('--aspect <ratio>', 'char w/h ratio', (v) => parseFloat(v), 0.5)
  .action(async (path: string, opts) => {
    if (path.endsWith('.milli')) {
      const buf = await readFile(path);
      const file = decodeMilli(buf);
      const rendered = file.frames.map((_, i) =>
        cellsToAnsi(frameToGrid(file, i), { color: opts.color, background: true }),
      );
      const delays = opts.fps
        ? new Array(file.frames.length).fill(Math.round(1000 / opts.fps))
        : file.frames.map((f) => f.delay);
      const loop = opts.loop && file.loop;
      await play({ frames: rendered, delays, loop });
      return;
    }

    const anim = await decodeAnimation(path);

    const termCols = opts.width ?? process.stdout.columns ?? 100;
    const termRows = opts.height ?? (process.stdout.rows ? process.stdout.rows - 2 : 40);
    const { cols, rows } = fitGrid(anim.width, anim.height, termCols, termRows, opts.aspect);

    const mode = opts.mode as RenderMode;
    const engineOpts: EngineOptions = {
      cols,
      rows,
      mode,
      glyphSet: opts.symbols as GlyphSet,
      color: opts.color,
      invert: false,
      charAspect: opts.aspect,
    };
    const bg = mode === 'match';

    process.stderr.write(`decoding ${anim.frames.length} frames at ${cols}x${rows}...\n`);
    const rendered = anim.frames.map((f) =>
      cellsToAnsi(frameToCells(f, engineOpts), { color: opts.color, background: bg }),
    );

    const delays = opts.fps
      ? new Array(anim.frames.length).fill(Math.round(1000 / opts.fps))
      : anim.delays;

    await play({ frames: rendered, delays, loop: opts.loop });
  });

program
  .command('convert <in> <out>')
  .description('Bake image or GIF into a .milli file for fast playback')
  .option('-w, --width <cols>', 'target columns', (v) => parseInt(v, 10))
  .option('-h, --height <rows>', 'target rows', (v) => parseInt(v, 10))
  .option('-m, --mode <mode>', 'render mode: match|ramp|braille', 'match')
  .option('-s, --symbols <set>', 'glyph set (ramp mode)', 'ascii')
  .option('--no-loop', 'mark as play-once', true)
  .option('--aspect <ratio>', 'char w/h ratio', (v) => parseFloat(v), 0.5)
  .action(async (inPath: string, outPath: string, opts) => {
    const isGif = /\.(gif|webp|apng)$/i.test(inPath);

    let frames, delays: number[];
    let srcW: number, srcH: number;

    if (isGif) {
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

    const termCols = opts.width ?? 100;
    const termRows = opts.height ?? 40;
    const { cols, rows } = fitGrid(srcW, srcH, termCols, termRows, opts.aspect);

    const engineOpts: EngineOptions = {
      cols,
      rows,
      mode: opts.mode as RenderMode,
      glyphSet: opts.symbols as GlyphSet,
      color: true,
      invert: false,
      charAspect: opts.aspect,
    };

    const grids: CellGrid[] = frames.map((f) => frameToCells(f, engineOpts));
    const buf = encodeMilli(grids, delays, opts.loop);
    await writeFile(outPath, buf);

    process.stderr.write(
      `wrote ${outPath}: ${grids.length} frames, ${cols}x${rows}, ${(buf.length / 1024).toFixed(1)}KB\n`,
    );
  });

program
  .command('export <in> <outdir>')
  .description('Export frames as Go/Lua/JSON source for embedding in other projects')
  .option('-t, --target <target>', 'go | lua | json', 'go')
  .option('-w, --width <cols>', 'columns', (v) => parseInt(v, 10), 80)
  .option('-h, --height <rows>', 'rows cap', (v) => parseInt(v, 10))
  .option('-m, --mode <mode>', 'render mode: match|ramp|braille', 'match')
  .option('-s, --symbols <set>', 'glyph set (ramp mode)', 'ascii')
  .option('-p, --package <name>', 'Go package name (default: outdir basename)')
  .option('--aspect <ratio>', 'char w/h ratio', (v) => parseFloat(v), 0.5)
  .option('--no-helper', 'skip helper file')
  .option('--no-color', 'lua target: omit per-cell color runs')
  .option('--no-bg', 'fully transparent background (sugar for --bg-threshold 1)')
  .option('--bg-threshold <n>', 'bg transparency threshold 0..1 (luma-gated)', (v) => parseFloat(v))
  .action(async (inPath: string, outDir: string, opts) => {
    const target = opts.target as ExportTarget;
    if (target !== 'go' && target !== 'lua' && target !== 'json') {
      throw new Error(`unknown target: ${opts.target} (want go|lua|json)`);
    }
    let threshold = 0;
    if (opts.bg === false) threshold = 1;
    if (typeof opts.bgThreshold === 'number' && !Number.isNaN(opts.bgThreshold)) {
      threshold = Math.min(1, Math.max(0, opts.bgThreshold));
    }
    const result = await exportFromFile(inPath, outDir, {
      target,
      width: opts.width,
      height: opts.height,
      mode: opts.mode as RenderMode,
      glyphSet: opts.symbols as GlyphSet,
      charAspect: opts.aspect,
      packageName: opts.package,
      withHelper: opts.helper !== false,
      color: opts.color !== false,
      backgroundThreshold: threshold,
    });
    process.stderr.write(
      `wrote ${result.files.length} file(s): ${result.frameCount} frames at ${result.cols}x${result.rows}\n`,
    );
    for (const f of result.files) process.stderr.write(`  ${f}\n`);
  });

program.parseAsync().catch((err) => {
  console.error('milli:', err.message);
  process.exit(1);
});
