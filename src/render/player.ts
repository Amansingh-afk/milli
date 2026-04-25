import { ANSI } from './ansi.js';

export interface PlayOptions {
  frames: string[];
  delays: number[];
  loop: boolean;
  stream?: NodeJS.WriteStream;
  cursorHome?: boolean;
  // Paint in-place without entering alt-screen. Frames must be pre-rendered
  // with absolute cursor positioning (use `cellsToAnsiPlaced`). On exit,
  // cursor is moved to row `atY + height` so the next prompt sits below.
  inline?: boolean;
  atY?: number;
  height?: number;
}

export async function play(opts: PlayOptions): Promise<void> {
  const stream = opts.stream ?? process.stdout;
  const { frames, delays, loop, inline } = opts;
  if (frames.length === 0) return;

  let stopping = false;
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (inline) {
      const exitY = (opts.atY ?? 1) + (opts.height ?? 0);
      stream.write(ANSI.reset + ANSI.showCursor + `\x1b[${exitY};1H`);
    } else {
      stream.write(ANSI.reset + ANSI.showCursor + ANSI.altScreenExit);
    }
  };

  const onSignal = () => {
    stopping = true;
    cleanup();
    process.exit(0);
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  process.on('exit', cleanup);

  if (inline) {
    stream.write(ANSI.hideCursor);
  } else {
    stream.write(ANSI.altScreenEnter + ANSI.hideCursor + ANSI.home);
  }

  try {
    const prefix = inline ? '' : (opts.cursorHome === false ? '' : ANSI.home);
    do {
      for (let i = 0; i < frames.length; i++) {
        if (stopping) return;
        stream.write(prefix + frames[i]!);
        await sleep(delays[i] ?? 100);
      }
    } while (loop && !stopping);
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
