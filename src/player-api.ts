import { readFile } from 'node:fs/promises';
import { AsciiPlayerCore } from './core/player.js';
import { decodeMilli } from './core/format.js';
import { play } from './render/player.js';
import { ANSI, cellsToAnsi, cellsToAnsiDiff } from './render/ansi.js';

export interface PlayFullscreenOptions {
  loop?: boolean;
  fps?: number;
  stream?: NodeJS.WriteStream;
  color?: boolean;
  diff?: boolean;
}

export class AsciiPlayer extends AsciiPlayerCore {
  static async load(path: string): Promise<AsciiPlayer> {
    const buf = await readFile(path);
    return new AsciiPlayer(decodeMilli(buf));
  }

  static override fromBuffer(buf: Uint8Array): AsciiPlayer {
    return new AsciiPlayer(decodeMilli(buf));
  }

  async play(opts: PlayFullscreenOptions = {}): Promise<void> {
    const color = opts.color ?? true;
    const useDiff = opts.diff ?? this.frameCount > 1;
    const delays = opts.fps
      ? new Array(this.frameCount).fill(Math.round(1000 / opts.fps))
      : this.delays();
    const loop = opts.loop ?? this.loop;

    if (!useDiff || this.frameCount <= 1) {
      const rendered = this.allFrames(color);
      await play({ frames: rendered, delays, loop, stream: opts.stream });
      return;
    }

    const rendered: string[] = new Array(this.frameCount);
    let prev = this.frame(0);
    rendered[0] = ANSI.home + cellsToAnsi(prev, { color, background: true });
    for (let i = 1; i < this.frameCount; i++) {
      const cur = this.frame(i);
      const diff = cellsToAnsiDiff(prev, cur, { color, background: true });
      const halfChanged = diff.changed * 2 > diff.total;
      rendered[i] = halfChanged
        ? ANSI.home + cellsToAnsi(cur, { color, background: true })
        : diff.ansi;
      prev = cur;
    }
    await play({ frames: rendered, delays, loop, stream: opts.stream, cursorHome: false });
  }
}
