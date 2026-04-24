import { decodeMilli, frameToGrid, type MilliFile } from './format.js';
import { cellsToAnsi, cellsToAnsiPlaced, type PlacedAnsiOptions } from '../render/ansi.js';
import type { CellGrid } from './types.js';

export class AsciiPlayerCore {
  readonly width: number;
  readonly height: number;
  readonly frameCount: number;
  readonly totalDuration: number;
  readonly loop: boolean;
  protected readonly file: MilliFile;
  private readonly cumDelays: number[];

  constructor(file: MilliFile) {
    this.file = file;
    this.width = file.width;
    this.height = file.height;
    this.frameCount = file.frames.length;
    this.loop = file.loop;

    this.cumDelays = [0];
    let acc = 0;
    for (const f of file.frames) {
      acc += f.delay;
      this.cumDelays.push(acc);
    }
    this.totalDuration = acc;
  }

  static fromBuffer(buf: Uint8Array): AsciiPlayerCore {
    return new AsciiPlayerCore(decodeMilli(buf));
  }

  frameIndexAt(tMs: number): number {
    if (this.totalDuration === 0) return 0;
    const t = this.loop ? tMs % this.totalDuration : Math.min(tMs, this.totalDuration - 1);
    let lo = 0;
    let hi = this.frameCount - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (this.cumDelays[mid]! <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  frameAt(tMs: number): CellGrid {
    return frameToGrid(this.file, this.frameIndexAt(tMs));
  }

  frame(idx: number): CellGrid {
    const i = Math.max(0, Math.min(this.frameCount - 1, idx));
    return frameToGrid(this.file, i);
  }

  frameDelay(idx: number): number {
    const i = Math.max(0, Math.min(this.frameCount - 1, idx));
    return this.file.frames[i]?.delay ?? 0;
  }

  renderAnsi(idx: number, color = true): string {
    return cellsToAnsi(this.frame(idx), { color, background: true });
  }

  renderAnsiAt(tMs: number, color = true): string {
    return this.renderAnsi(this.frameIndexAt(tMs), color);
  }

  renderPlaced(idx: number, opts: PlacedAnsiOptions): string {
    return cellsToAnsiPlaced(this.frame(idx), {
      color: opts.color ?? true,
      background: opts.background ?? true,
      termX: opts.termX,
      termY: opts.termY,
      region: opts.region,
    });
  }

  renderPlacedAt(tMs: number, opts: PlacedAnsiOptions): string {
    return this.renderPlaced(this.frameIndexAt(tMs), opts);
  }

  allFrames(color = true): string[] {
    const out: string[] = [];
    for (let i = 0; i < this.frameCount; i++) out.push(this.renderAnsi(i, color));
    return out;
  }

  delays(): number[] {
    return this.file.frames.map((f) => f.delay);
  }
}
