import { ANSI } from './ansi.js';

export interface PlayOptions {
  frames: string[];
  delays: number[];
  loop: boolean;
  stream?: NodeJS.WriteStream;
  cursorHome?: boolean;
}

export async function play(opts: PlayOptions): Promise<void> {
  const stream = opts.stream ?? process.stdout;
  const { frames, delays, loop } = opts;
  if (frames.length === 0) return;

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
    const prefix = opts.cursorHome === false ? '' : ANSI.home;
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
