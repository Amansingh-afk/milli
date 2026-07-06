// Live playback loop for procedural generators (text FX, shaders): frames are
// computed on the fly, so this runs forever until SIGINT instead of cycling a
// pre-rendered list like render/player.ts.

import { ANSI, cellsToAnsi } from './ansi.js';
import type { CellGrid } from '../core/types.js';

export interface LivePlayOptions {
  frame(i: number): CellGrid;
  fps: number;
  color?: boolean;
  seconds?: number; // stop after this long; omit = run until SIGINT
  stream?: NodeJS.WriteStream;
}

export async function playLive(opts: LivePlayOptions): Promise<void> {
  const stream = opts.stream ?? process.stdout;
  const delay = Math.max(15, Math.round(1000 / opts.fps));
  const maxFrames = opts.seconds ? Math.ceil(opts.seconds * opts.fps) : Infinity;

  let stopping = false;
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    stream.write(ANSI.reset + ANSI.showCursor + ANSI.altScreenExit);
  };
  const onSignal = () => {
    stopping = true;
    cleanup();
    process.exit(0);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  process.on('exit', cleanup);

  stream.write(ANSI.altScreenEnter + ANSI.hideCursor + ANSI.home);
  try {
    for (let i = 0; i < maxFrames && !stopping; i++) {
      const started = Date.now();
      const grid = opts.frame(i);
      stream.write(ANSI.home + cellsToAnsi(grid, { color: opts.color !== false, background: false }));
      const elapsed = Date.now() - started;
      await sleep(Math.max(0, delay - elapsed));
    }
  } finally {
    cleanup();
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    process.off('exit', cleanup);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
