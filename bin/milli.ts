#!/usr/bin/env node
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { decodeAnimation, decodeImage } from '../src/cli/decode.js';
import { exportFromFile, type ExportTarget } from '../src/cli/export.js';
import { emitGoData, emitJson, emitLuaData } from '../src/core/emit.js';
import { fitGrid, frameToCells } from '../src/core/engine.js';
import { decodeMilli, encodeMilli, frameToGrid } from '../src/core/format.js';
import { createTextFx, FX_NAMES, type FxName } from '../src/core/fx.js';
import { createShader, SHADER_NAMES, type ShaderName } from '../src/core/shader.js';
import { cellsToAnsi, cellsToAnsiPlaced } from '../src/render/ansi.js';
import { playLive } from '../src/render/live.js';
import { play } from '../src/render/player.js';
import type { CellGrid, EngineOptions, GlyphSet, RenderMode, RGB } from '../src/core/types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = join(HERE, '..', '..', 'samples');

function resolveMilliPath(input: string): string {
  if (existsSync(input)) return input;
  const bundled = join(SAMPLES_DIR, `${input}.milli`);
  if (existsSync(bundled)) return bundled;
  throw new Error(
    `not found: "${input}" (no file at path, no bundled sample named "${input}"). Try one of: fire, jellyfish`,
  );
}

const program = new Command();

program
  .name('milli')
  .description('Pixel-perfect ASCII art. Images now, video soon.')
  .version('0.0.6');

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
  .option('--no-bg', 'skip background color (transparent over terminal background)')
  .option('--no-loop', 'play once and exit')
  .option('--fps <n>', 'override fps', (v) => parseFloat(v))
  .option('--aspect <ratio>', 'char w/h ratio', (v) => parseFloat(v), 0.5)
  .option('--inline', 'paint in-place (no alt-screen) for composition with other output', false)
  .option('--at <pos>', 'inline anchor as "x,y" 1-based terminal cell', '1,1')
  .action(async (path: string, opts) => {
    let atX = 1;
    let atY = 1;
    if (opts.inline) {
      const m = String(opts.at).match(/^(\d+),(\d+)$/);
      if (!m) {
        process.stderr.write('--at expects "x,y" (1-based, e.g. --at 2,1)\n');
        process.exit(1);
      }
      atX = parseInt(m[1]!, 10);
      atY = parseInt(m[2]!, 10);
    }

    const isPath = path.includes('/') || path.includes('.');
    if (!isPath) path = resolveMilliPath(path);

    if (path.endsWith('.milli')) {
      const buf = await readFile(path);
      const file = decodeMilli(buf);
      let clipW = file.width;
      let clipH = file.height;
      if (opts.inline) {
        const termCols = process.stdout.columns ?? 0;
        const termRows = process.stdout.rows ?? 0;
        if (termCols && termRows) {
          const availW = Math.max(1, termCols - atX + 1);
          const availH = Math.max(1, termRows - atY + 1);
          if (file.width > availW || file.height > availH) {
            process.stderr.write(`warning: animation ${file.width}x${file.height} larger than available ${availW}x${availH} from (${atX},${atY}); clipping\n`);
          }
          clipW = Math.min(file.width, availW);
          clipH = Math.min(file.height, availH);
        }
      }
      const bg = opts.bg !== false;
      const rendered = file.frames.map((_, i) => {
        const grid = frameToGrid(file, i);
        return opts.inline
          ? cellsToAnsiPlaced(grid, {
              color: opts.color,
              background: bg,
              termX: atX,
              termY: atY,
              region: { x: 0, y: 0, w: clipW, h: clipH },
            })
          : cellsToAnsi(grid, { color: opts.color, background: bg });
      });
      const delays = opts.fps
        ? new Array(file.frames.length).fill(Math.round(1000 / opts.fps))
        : file.frames.map((f) => f.delay);
      const loop = opts.loop && file.loop;
      await play({ frames: rendered, delays, loop, inline: opts.inline, atY, height: clipH });
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
    const bg = (mode === 'match') && (opts.bg !== false);

    let clipW = cols;
    let clipH = rows;
    if (opts.inline) {
      const availW = Math.max(1, termCols - atX + 1);
      const availH = Math.max(1, termRows - atY + 1);
      if (cols > availW || rows > availH) {
        process.stderr.write(`warning: animation ${cols}x${rows} larger than available ${availW}x${availH} from (${atX},${atY}); clipping\n`);
      }
      clipW = Math.min(cols, availW);
      clipH = Math.min(rows, availH);
    }

    process.stderr.write(`decoding ${anim.frames.length} frames at ${cols}x${rows}...\n`);
    const rendered = anim.frames.map((f) => {
      const grid = frameToCells(f, engineOpts);
      return opts.inline
        ? cellsToAnsiPlaced(grid, {
            color: opts.color,
            background: bg,
            termX: atX,
            termY: atY,
            region: { x: 0, y: 0, w: clipW, h: clipH },
          })
        : cellsToAnsi(grid, { color: opts.color, background: bg });
    });

    const delays = opts.fps
      ? new Array(anim.frames.length).fill(Math.round(1000 / opts.fps))
      : anim.delays;

    await play({ frames: rendered, delays, loop: opts.loop, inline: opts.inline, atY, height: clipH });
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
  .option('--no-helper', 'skip helper file (go target only; lua emits data-only)')
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

program
  .command('fastfetch <path>')
  .description('Run fastfetch with an animated milli logo (composes static fastfetch info with looping animation)')
  .option('--at <pos>', 'inline anchor as "x,y" 1-based terminal cell', '3,2')
  .option('--no-bg', 'skip background color (transparent over terminal background)')
  .option('--ff-args <args>', 'extra args passed to fastfetch (whitespace-split)', '')
  .action(async (path: string, opts) => {
    const isPath = path.includes('/') || path.includes('.');
    if (!isPath) path = resolveMilliPath(path);

    if (!path.endsWith('.milli')) {
      process.stderr.write('milli fastfetch requires a .milli file. Bake one with: milli convert <input> <output.milli>\n');
      process.exit(1);
    }

    const m = String(opts.at).match(/^(\d+),(\d+)$/);
    if (!m) {
      process.stderr.write('--at expects "x,y" (1-based, e.g. --at 3,2)\n');
      process.exit(1);
    }
    const atX = parseInt(m[1]!, 10);
    const atY = parseInt(m[2]!, 10);

    const buf = await readFile(path);
    const file = decodeMilli(buf);

    const tmpPath = join(tmpdir(), `milli-fastfetch-${process.pid}-${Date.now()}.txt`);
    const blank = (' '.repeat(file.width) + '\n').repeat(file.height);
    await writeFile(tmpPath, blank);

    const cleanupTmp = () => {
      try { unlinkSync(tmpPath); } catch {}
    };
    process.on('exit', cleanupTmp);
    process.on('SIGINT', () => { cleanupTmp(); process.exit(0); });
    process.on('SIGTERM', () => { cleanupTmp(); process.exit(0); });

    process.stdout.write('\x1b[2J\x1b[H');
    const ffArgs = ['--logo', tmpPath, '--logo-type', 'file-raw'];
    if (opts.ffArgs) ffArgs.push(...String(opts.ffArgs).split(/\s+/).filter(Boolean));
    const result = spawnSync('fastfetch', ffArgs, { stdio: 'inherit' });
    if (result.error) {
      const err = result.error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        process.stderr.write('fastfetch not found on PATH. Install fastfetch first: https://github.com/fastfetch-cli/fastfetch\n');
      } else {
        process.stderr.write(`fastfetch failed: ${err.message}\n`);
      }
      process.exit(1);
    }

    const termCols = process.stdout.columns ?? 0;
    const termRows = process.stdout.rows ?? 0;
    let clipW = file.width;
    let clipH = file.height;
    if (termCols && termRows) {
      const availW = Math.max(1, termCols - atX + 1);
      const availH = Math.max(1, termRows - atY + 1);
      if (file.width > availW || file.height > availH) {
        process.stderr.write(`warning: animation ${file.width}x${file.height} larger than available ${availW}x${availH} from (${atX},${atY}); clipping\n`);
      }
      clipW = Math.min(file.width, availW);
      clipH = Math.min(file.height, availH);
    }

    const bg = opts.bg !== false;
    const rendered = file.frames.map((_, i) => {
      const grid = frameToGrid(file, i);
      return cellsToAnsiPlaced(grid, {
        color: true,
        background: bg,
        termX: atX,
        termY: atY,
        region: { x: 0, y: 0, w: clipW, h: clipH },
      });
    });
    const delays = file.frames.map((f) => f.delay);
    await play({ frames: rendered, delays, loop: file.loop, inline: true, atY, height: clipH });
  });

function parseHexColor(s: string): RGB {
  const m = s.replace(/^#/, '').match(/^([0-9a-f]{6})$/i);
  if (!m) throw new Error(`bad color: "${s}" (want hex like #00ffbe)`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

interface Bakeable {
  cols: number;
  rows: number;
  period: number;
  frame(i: number): CellGrid;
}

// Bake a procedural generator into files. Target 'milli' writes a single
// .milli file; go/lua/json reuse the standard emitters.
async function bakeProcedural(
  gen: Bakeable,
  outDir: string,
  target: string,
  fps: number,
  frameCount: number | undefined,
  slug: string,
  pkg: string | undefined,
): Promise<void> {
  const n = frameCount ?? gen.period;
  const grids: CellGrid[] = [];
  for (let i = 0; i < n; i++) grids.push(gen.frame(i));
  const delays = new Array<number>(n).fill(Math.round(1000 / fps));

  await mkdir(outDir, { recursive: true });
  const files: string[] = [];
  // Procedural output is drawn on pure black; drop those backgrounds so
  // exports sit transparently on dashboards/terminals.
  const threshold = 0.01;
  switch (target) {
    case 'lua': {
      const p = join(outDir, `${slug}.lua`);
      await writeFile(p, emitLuaData(grids, delays, gen.cols, gen.rows, true, threshold));
      files.push(p);
      break;
    }
    case 'go': {
      const p = join(outDir, 'frames.go');
      await writeFile(p, emitGoData(grids, delays, gen.cols, gen.rows, pkg ?? slug, threshold));
      files.push(p);
      break;
    }
    case 'json': {
      const p = join(outDir, `${slug}.json`);
      await writeFile(p, emitJson(grids, delays, gen.cols, gen.rows));
      files.push(p);
      break;
    }
    case 'milli': {
      const p = join(outDir, `${slug}.milli`);
      await writeFile(p, encodeMilli(grids, delays, true));
      files.push(p);
      break;
    }
    default:
      throw new Error(`unknown target: ${target} (want lua|go|json|milli)`);
  }
  process.stderr.write(`wrote ${n} frames at ${gen.cols}x${gen.rows}:\n`);
  for (const f of files) process.stderr.write(`  ${f}\n`);
}

program
  .command('text <string>')
  .description(`Animate text with a procedural effect (${FX_NAMES.join('|')})`)
  .option('-e, --effect <name>', `effect: ${FX_NAMES.join('|')}`, 'fire')
  .option('-c, --color <hex>', 'base color for color-taking effects', '#00ffbe')
  .option('--fps <n>', 'frames per second', (v) => parseInt(v, 10), 30)
  .option('--scale <n>', 'horizontal cells per font pixel (vertical is half)', (v) => parseInt(v, 10), 2)
  .option('--seed <n>', 'random seed (exports are reproducible)', (v) => parseInt(v, 10), 1337)
  .option('--seconds <n>', 'stop live playback after n seconds', (v) => parseFloat(v))
  .option('-o, --export <outdir>', 'bake frames to files instead of playing')
  .option('-t, --target <target>', 'export target: lua|go|json|milli', 'lua')
  .option('-p, --package <name>', 'Go package name (go target)')
  .option('--frames <n>', 'baked frame count (default: one clean loop)', (v) => parseInt(v, 10))
  .action(async (text: string, opts) => {
    const effect = opts.effect as FxName;
    if (!FX_NAMES.includes(effect)) {
      throw new Error(`unknown effect: ${opts.effect} (want ${FX_NAMES.join('|')})`);
    }
    const scaleX = Math.max(1, opts.scale);
    const fx = createTextFx(text, effect, {
      color: parseHexColor(opts.color),
      fps: opts.fps,
      seed: opts.seed,
      mask: { scaleX, scaleY: Math.max(1, Math.round(scaleX / 2)) },
    });
    if (opts.export) {
      const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'text';
      await bakeProcedural(fx, opts.export, opts.target, opts.fps, opts.frames, `${slug}-${effect}`, opts.package);
      return;
    }
    await playLive({ frame: (i) => fx.frame(i), fps: opts.fps, seconds: opts.seconds });
  });

program
  .command('shader <name>')
  .description(`Run a live procedural shader (${SHADER_NAMES.join('|')})`)
  .option('-w, --width <cols>', 'columns (default: terminal width)', (v) => parseInt(v, 10))
  .option('-h, --height <rows>', 'rows (default: terminal height)', (v) => parseInt(v, 10))
  .option('--fps <n>', 'frames per second', (v) => parseInt(v, 10), 30)
  .option('--seed <n>', 'random seed', (v) => parseInt(v, 10), 1337)
  .option('--hue <deg>', 'base hue 0-360 (rain/starfield/tunnel/waves/plasma)', (v) => parseFloat(v))
  .option('--seconds <n>', 'stop live playback after n seconds', (v) => parseFloat(v))
  .option('-o, --export <outdir>', 'bake frames to files instead of playing')
  .option('-t, --target <target>', 'export target: lua|go|json|milli', 'lua')
  .option('-p, --package <name>', 'Go package name (go target)')
  .option('--frames <n>', 'baked frame count (default: one loop period)', (v) => parseInt(v, 10))
  .action(async (name: string, opts) => {
    const shaderName = name as ShaderName;
    if (!SHADER_NAMES.includes(shaderName)) {
      throw new Error(`unknown shader: ${name} (want ${SHADER_NAMES.join('|')})`);
    }
    const cols = opts.width ?? process.stdout.columns ?? 80;
    const rows = opts.height ?? (process.stdout.rows ? process.stdout.rows - 1 : 24);
    const sh = createShader(shaderName, {
      cols,
      rows,
      fps: opts.fps,
      seed: opts.seed,
      hue: typeof opts.hue === 'number' && !Number.isNaN(opts.hue) ? (opts.hue % 360) / 360 : undefined,
    });
    if (opts.export) {
      await bakeProcedural(sh, opts.export, opts.target, opts.fps, opts.frames, shaderName, opts.package);
      return;
    }
    await playLive({ frame: (i) => sh.frame(i), fps: opts.fps, seconds: opts.seconds });
  });

program.parseAsync().catch((err) => {
  console.error('milli:', err.message);
  process.exit(1);
});
