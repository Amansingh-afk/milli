export type RGB = readonly [number, number, number];

export interface Frame {
  width: number;
  height: number;
  rgb: Uint8ClampedArray;
}

export interface Cell {
  glyph: string;
  fg: RGB;
  bg: RGB;
}

export type CellGrid = Cell[][];

export type GlyphSet = 'ascii' | 'block' | 'braille' | 'all';
export type RenderMode = 'ramp' | 'match' | 'braille';

export interface EngineOptions {
  cols: number;
  rows: number;
  mode: RenderMode;
  glyphSet: GlyphSet;
  color: boolean;
  invert: boolean;
  charAspect: number;
  dither?: boolean;
}

export const DEFAULT_OPTIONS: EngineOptions = {
  cols: 100,
  rows: 40,
  mode: 'match',
  glyphSet: 'ascii',
  color: true,
  invert: false,
  charAspect: 0.5,
  dither: false,
};
