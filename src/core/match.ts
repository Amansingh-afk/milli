import type { Atlas, Glyph } from './atlas.js';

export interface MatchResult {
  glyph: string;
  invert: boolean;
  score: number;
}

let suffixBuf: Int32Array | null = null;

export function matchGlyph(
  mask: Uint8Array,
  atlas: Atlas,
  allowInvert = true,
  weights?: Uint8Array,
): MatchResult {
  const n = mask.length;
  let best: Glyph = atlas.glyphs[0]!;
  let bestScore = Infinity;
  let bestInvert = false;

  let total = n;
  if (weights) {
    total = 0;
    for (let i = 0; i < n; i++) total += weights[i]!;
  }

  if (!suffixBuf || suffixBuf.length < n + 1) suffixBuf = new Int32Array(n + 1);
  const suffix = suffixBuf;
  suffix[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    suffix[i] = suffix[i + 1]! + (weights ? weights[i]! : 1);
  }

  for (const g of atlas.glyphs) {
    let diff = 0;
    const gm = g.mask;
    let pruned = false;

    if (weights) {
      for (let i = 0; i < n; i++) {
        if (mask[i] !== gm[i]) diff += weights[i]!;
        if ((i & 15) === 15) {
          const rem = suffix[i + 1]!;
          const lbInv = total - diff - rem;
          const lb = allowInvert ? (diff < lbInv ? diff : lbInv) : diff;
          if (lb >= bestScore) { pruned = true; break; }
        }
      }
    } else {
      for (let i = 0; i < n; i++) {
        if (mask[i] !== gm[i]) diff++;
        if ((i & 15) === 15) {
          const rem = suffix[i + 1]!;
          const lbInv = total - diff - rem;
          const lb = allowInvert ? (diff < lbInv ? diff : lbInv) : diff;
          if (lb >= bestScore) { pruned = true; break; }
        }
      }
    }

    if (pruned) continue;

    if (diff < bestScore) {
      bestScore = diff;
      best = g;
      bestInvert = false;
    }

    if (allowInvert) {
      const diffInv = total - diff;
      if (diffInv < bestScore) {
        bestScore = diffInv;
        best = g;
        bestInvert = true;
      }
    }
  }

  return { glyph: best.char, invert: bestInvert, score: bestScore };
}

export function edgeWeights(
  mask: Uint8Array,
  w: number,
  h: number,
  boost = 3,
): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const s = mask[i]!;
      let diff = 0;
      if (x > 0 && mask[i - 1] !== s) diff++;
      if (x < w - 1 && mask[i + 1] !== s) diff++;
      if (y > 0 && mask[i - w] !== s) diff++;
      if (y < h - 1 && mask[i + w] !== s) diff++;
      out[i] = 1 + diff * boost;
    }
  }
  return out;
}
