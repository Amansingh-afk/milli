import { decodeMilli, frameToGrid } from 'milli/web';
import type { ConvertResult } from './convert';

export interface ShowcaseEntry {
  file: string;
  label: string;
}

export async function loadShowcase(path: string): Promise<ConvertResult> {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`showcase fetch ${path}: ${resp.status} ${resp.statusText}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  const file = decodeMilli(buf);
  const grids = file.frames.map((_, i) => frameToGrid(file, i));
  const name = path.split('/').pop() ?? 'showcase';
  return {
    grids,
    delays: file.frames.map((f) => f.delay),
    loop: file.loop,
    width: file.width,
    height: file.height,
    source: { name, bytes: buf.byteLength, mime: 'application/octet-stream' },
    mode: 'match',
    targetWidth: file.width,
    millBytes: buf.byteLength,
    encode: () => buf,
  };
}
