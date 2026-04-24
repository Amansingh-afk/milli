import sharp from 'sharp';
import type { Frame } from '../core/types.js';

export interface Animation {
  width: number;
  height: number;
  frames: Frame[];
  delays: number[];
}

export async function decodeImage(path: string): Promise<Frame> {
  const { data, info } = await sharp(path)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    width: info.width,
    height: info.height,
    rgb: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
  };
}

export async function decodeAnimation(path: string): Promise<Animation> {
  const img = sharp(path, { animated: true });
  const meta = await img.metadata();
  const pages = meta.pages ?? 1;
  const pageHeight = meta.pageHeight ?? meta.height ?? 0;
  const width = meta.width ?? 0;
  const delays = Array.isArray(meta.delay) ? meta.delay.slice() : new Array(pages).fill(100);

  if (pages <= 1) {
    const single = await decodeImage(path);
    return { width: single.width, height: single.height, frames: [single], delays: [0] };
  }

  const { data } = await sharp(path, { animated: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const frames: Frame[] = [];
  const frameBytes = width * pageHeight * 3;
  for (let p = 0; p < pages; p++) {
    const start = p * frameBytes;
    const slice = new Uint8ClampedArray(frameBytes);
    slice.set(data.subarray(start, start + frameBytes));
    frames.push({ width, height: pageHeight, rgb: slice });
  }

  const normalizedDelays = delays.map((d) => (d && d > 0 ? d : 100));
  return { width, height: pageHeight, frames, delays: normalizedDelays };
}
