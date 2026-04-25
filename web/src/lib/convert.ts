import {
  decodeFile,
  frameToCells,
  fitGrid,
  encodeMilli,
  type Animation,
  type CellGrid,
  type RenderMode,
} from '@amansingh-afk/milli/web';

export interface ConvertOptions {
  width: number;
  mode: RenderMode;
  signal?: AbortSignal;
  onProgress?: (phase: string, pct: number) => void;
}

export interface RetuneOptions {
  width: number;
  mode: RenderMode;
  signal?: AbortSignal;
  onProgress?: (phase: string, pct: number) => void;
}

export interface ConvertResult {
  grids: CellGrid[];
  delays: number[];
  loop: boolean;
  width: number;
  height: number;
  source: { name: string; bytes: number; mime: string };
  mode: RenderMode;
  targetWidth: number;
  millBytes: number;
  encode: () => Uint8Array;
  // Re-render from the original decoded frames. Decode is skipped so only the
  // match/ramp/braille pass runs. Undefined when the source frames are not
  // retained (e.g. showcase entries baked from .milli with no raw pixels).
  retune?: (opts: RetuneOptions) => Promise<ConvertResult>;
}

export async function convertFile(file: File, opts: ConvertOptions): Promise<ConvertResult> {
  const { signal, onProgress } = opts;
  onProgress?.('DECODING', 0.1);
  const anim = await decodeFile(file);
  throwIfAborted(signal);

  return renderFromAnim(anim, file, opts);
}

async function renderFromAnim(
  anim: Animation,
  file: { name: string; size: number; type: string },
  opts: ConvertOptions,
): Promise<ConvertResult> {
  const { signal, onProgress } = opts;

  onProgress?.('FITTING', 0.2);
  const { cols, rows } = fitGrid(anim.width, anim.height, opts.width, 9999, 0.5);

  onProgress?.('MATCHING', 0.25);
  const grids: CellGrid[] = [];
  for (let i = 0; i < anim.frames.length; i++) {
    throwIfAborted(signal);
    const grid = frameToCells(anim.frames[i]!, {
      cols,
      rows,
      mode: opts.mode,
      glyphSet: 'all',
      color: true,
      invert: false,
      charAspect: 0.5,
    });
    grids.push(grid);
    const base = 0.25;
    const frac = (i + 1) / anim.frames.length;
    onProgress?.('MATCHING', base + frac * 0.6);
    if (anim.frames.length > 1 && i % 2 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const loop = anim.frames.length > 1;
  onProgress?.('ENCODING', 0.9);
  let cachedBytes: Uint8Array | null = null;
  const encode = () => {
    if (cachedBytes) return cachedBytes;
    cachedBytes = encodeMilli(grids, anim.delays, loop);
    return cachedBytes;
  };
  const millBytes = encode().byteLength;

  onProgress?.('DONE', 1);
  const result: ConvertResult = {
    grids,
    delays: anim.delays,
    loop,
    width: cols,
    height: rows,
    source: { name: file.name, bytes: file.size, mime: file.type },
    mode: opts.mode,
    targetWidth: opts.width,
    millBytes,
    encode,
    retune: (newOpts) => renderFromAnim(anim, file, newOpts),
  };
  return result;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
}
