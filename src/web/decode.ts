import { parseGIF, decompressFrames } from 'gifuct-js';
import type { Frame } from '../core/types.js';

export interface Animation {
  width: number;
  height: number;
  frames: Frame[];
  delays: number[];
}

export async function decodeImageBlob(blob: Blob): Promise<Frame> {
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('decodeImageBlob: no 2d context');
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close?.();
  return { width: bmp.width, height: bmp.height, rgb: rgbaToRgb(img.data) };
}

export async function decodeGifBuffer(buf: ArrayBuffer): Promise<Animation> {
  const gif = parseGIF(buf);
  const frames = decompressFrames(gif, true);
  if (frames.length === 0) throw new Error('decodeGifBuffer: no frames');

  const width = gif.lsd.width;
  const height = gif.lsd.height;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('decodeGifBuffer: no 2d context');

  const outFrames: Frame[] = [];
  const delays: number[] = [];

  for (const f of frames) {
    const disposal = f.disposalType ?? 0;
    const { width: fw, height: fh, left, top } = f.dims;

    let savedState: ImageData | null = null;
    if (disposal === 3) {
      savedState = ctx.getImageData(0, 0, width, height);
    }

    const patchCanvas = new OffscreenCanvas(fw, fh);
    const patchCtx = patchCanvas.getContext('2d');
    if (!patchCtx) throw new Error('decodeGifBuffer: patch ctx');
    const patchImage = patchCtx.createImageData(fw, fh);
    patchImage.data.set(f.patch);
    patchCtx.putImageData(patchImage, 0, 0);

    ctx.drawImage(patchCanvas, left, top);

    const full = ctx.getImageData(0, 0, width, height);
    outFrames.push({ width, height, rgb: rgbaToRgb(full.data) });
    delays.push(f.delay && f.delay > 0 ? f.delay : 100);

    if (disposal === 2) {
      ctx.clearRect(left, top, fw, fh);
    } else if (disposal === 3 && savedState) {
      ctx.putImageData(savedState, 0, 0);
    }
  }

  return { width, height, frames: outFrames, delays };
}

export async function decodeFile(file: File | Blob): Promise<Animation> {
  const type = (file as File).name?.toLowerCase() ?? '';
  const mime = file.type ?? '';

  if (mime === 'image/gif' || type.endsWith('.gif')) {
    const buf = await file.arrayBuffer();
    return decodeGifBuffer(buf);
  }

  const frame = await decodeImageBlob(file);
  return { width: frame.width, height: frame.height, frames: [frame], delays: [0] };
}

function rgbaToRgb(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const n = rgba.length / 4;
  const out = new Uint8ClampedArray(n * 3);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[i * 3] = rgba[j]!;
    out[i * 3 + 1] = rgba[j + 1]!;
    out[i * 3 + 2] = rgba[j + 2]!;
  }
  return out;
}
