import atlasData from './atlas.json' with { type: 'json' };

export interface Glyph {
  char: string;
  mask: Uint8Array;
  coverage: number;
}

export interface Atlas {
  width: number;
  height: number;
  glyphs: Glyph[];
}

let cached: Atlas | null = null;

export function loadAtlas(): Atlas {
  if (cached) return cached;
  cached = {
    width: atlasData.width,
    height: atlasData.height,
    glyphs: atlasData.glyphs.map((g) => ({
      char: g.char,
      mask: new Uint8Array(g.mask),
      coverage: g.coverage,
    })),
  };
  return cached;
}
