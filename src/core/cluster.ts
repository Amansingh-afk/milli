import type { RGB } from './types.js';

export interface ClusterResult {
  fg: RGB;
  bg: RGB;
  mask: Uint8Array;
  contrast: number;
}

export function clusterPatch(
  pixels: Uint8ClampedArray,
  pxW: number,
  pxH: number,
  atlasW: number,
  atlasH: number,
): ClusterResult {
  const n = pxW * pxH;
  if (n === 0) {
    return { fg: [0, 0, 0], bg: [0, 0, 0], mask: new Uint8Array(atlasW * atlasH), contrast: 0 };
  }

  let minLum = Infinity, maxLum = -Infinity;
  let minIdx = 0, maxIdx = 0;
  for (let i = 0; i < n; i++) {
    const r = pixels[i * 3]!;
    const g = pixels[i * 3 + 1]!;
    const b = pixels[i * 3 + 2]!;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < minLum) { minLum = lum; minIdx = i; }
    if (lum > maxLum) { maxLum = lum; maxIdx = i; }
  }

  let c0r = pixels[minIdx * 3]!, c0g = pixels[minIdx * 3 + 1]!, c0b = pixels[minIdx * 3 + 2]!;
  let c1r = pixels[maxIdx * 3]!, c1g = pixels[maxIdx * 3 + 1]!, c1b = pixels[maxIdx * 3 + 2]!;

  const assign = new Uint8Array(n);
  for (let iter = 0; iter < 4; iter++) {
    let s0r = 0, s0g = 0, s0b = 0, n0 = 0;
    let s1r = 0, s1g = 0, s1b = 0, n1 = 0;
    for (let i = 0; i < n; i++) {
      const r = pixels[i * 3]!;
      const g = pixels[i * 3 + 1]!;
      const b = pixels[i * 3 + 2]!;
      const d0 = (r - c0r) ** 2 + (g - c0g) ** 2 + (b - c0b) ** 2;
      const d1 = (r - c1r) ** 2 + (g - c1g) ** 2 + (b - c1b) ** 2;
      if (d1 < d0) {
        assign[i] = 1;
        s1r += r; s1g += g; s1b += b; n1++;
      } else {
        assign[i] = 0;
        s0r += r; s0g += g; s0b += b; n0++;
      }
    }
    if (n0 > 0) { c0r = s0r / n0; c0g = s0g / n0; c0b = s0b / n0; }
    if (n1 > 0) { c1r = s1r / n1; c1g = s1g / n1; c1b = s1b / n1; }
  }

  const lum0 = 0.2126 * c0r + 0.7152 * c0g + 0.0722 * c0b;
  const lum1 = 0.2126 * c1r + 0.7152 * c1g + 0.0722 * c1b;
  let bg: RGB, fg: RGB, fgLabel: number;
  if (lum1 > lum0) {
    bg = [Math.round(c0r), Math.round(c0g), Math.round(c0b)];
    fg = [Math.round(c1r), Math.round(c1g), Math.round(c1b)];
    fgLabel = 1;
  } else {
    bg = [Math.round(c1r), Math.round(c1g), Math.round(c1b)];
    fg = [Math.round(c0r), Math.round(c0g), Math.round(c0b)];
    fgLabel = 0;
  }

  const mask = new Uint8Array(atlasW * atlasH);
  for (let ay = 0; ay < atlasH; ay++) {
    const y0 = Math.floor(ay * pxH / atlasH);
    const y1 = Math.max(y0 + 1, Math.floor((ay + 1) * pxH / atlasH));
    for (let ax = 0; ax < atlasW; ax++) {
      const x0 = Math.floor(ax * pxW / atlasW);
      const x1 = Math.max(x0 + 1, Math.floor((ax + 1) * pxW / atlasW));
      let on = 0, total = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (assign[y * pxW + x] === fgLabel) on++;
          total++;
        }
      }
      mask[ay * atlasW + ax] = on * 2 >= total ? 1 : 0;
    }
  }

  const contrast = Math.abs(lum1 - lum0);
  return { fg, bg, mask, contrast };
}
