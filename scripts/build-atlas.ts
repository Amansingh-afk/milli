import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ATLAS_W = 8;
const ATLAS_H = 16;
const SCALE = 4;
const RENDER_W = ATLAS_W * SCALE;
const RENDER_H = ATLAS_H * SCALE;
const FONT_FAMILY = 'JetBrainsMono';
const THRESHOLD = 96;

const GLYPHS: string[] = [
  ' ',
  '.', ',', '`', "'", ':', ';', '"',
  '-', '_', '=', '+', '*', '~', '^',
  '<', '>', '/', '\\', '|', '(', ')', '[', ']', '{', '}',
  '!', '?', 'i', 'l', 'I', 'L', 'T', 'Y', 'V', 'X',
  'o', 'O', 'c', 'C', '0', '8', '@', '#', '%', '&',
  '▀', '▄', '▌', '▐', '█',
  '▁', '▂', '▃', '▅', '▆', '▇',
  '▏', '▎', '▍', '▋', '▊', '▉',
  '▔', '▕',
  '▖', '▗', '▘', '▙', '▚', '▛', '▜', '▝', '▞', '▟',
  '░', '▒', '▓',
  '─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼',
  '╱', '╲', '╳',
  '◢', '◣', '◤', '◥',
  '●', '○', '◆', '◇',
];

function tryRegisterFont(): string {
  const candidates = [
    `${process.env.HOME}/.local/share/fonts/JetBrainsMonoNerdFont-Regular.ttf`,
    `${process.env.HOME}/.local/share/fonts/JetBrainsMono-Regular.ttf`,
    '/usr/share/fonts/jetbrains-mono-fonts/JetBrainsMono-Regular.ttf',
    '/usr/share/fonts/JetBrainsMono/JetBrainsMono-Regular.ttf',
    '/usr/share/fonts/TTF/JetBrainsMono-Regular.ttf',
    '/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
    '/usr/share/fonts/dejavu-sans-mono-fonts/DejaVuSansMono.ttf',
  ];
  for (const p of candidates) {
    try {
      GlobalFonts.registerFromPath(p, FONT_FAMILY);
      return p;
    } catch { /* next */ }
  }
  throw new Error('no monospace font found — install JetBrainsMono or DejaVu Sans Mono');
}

function renderGlyph(ch: string): number[] {
  if (ch === ' ') return new Array(ATLAS_W * ATLAS_H).fill(0);

  const canvas = createCanvas(RENDER_W, RENDER_H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, RENDER_W, RENDER_H);

  ctx.fillStyle = 'white';
  ctx.font = `${RENDER_H}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const metrics = ctx.measureText(ch);
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  const emH = ascent + descent;
  const yBaseline = (RENDER_H + emH) / 2 - descent;

  const glyphW = metrics.width;
  const xOffset = (RENDER_W - glyphW) / 2;

  ctx.fillText(ch, xOffset, yBaseline);

  const src = ctx.getImageData(0, 0, RENDER_W, RENDER_H).data;

  const down = new Float64Array(ATLAS_W * ATLAS_H);
  const counts = new Int32Array(ATLAS_W * ATLAS_H);
  for (let y = 0; y < RENDER_H; y++) {
    const ay = Math.floor(y / SCALE);
    for (let x = 0; x < RENDER_W; x++) {
      const ax = Math.floor(x / SCALE);
      const i = (y * RENDER_W + x) * 4;
      const lum = (0.2126 * src[i]! + 0.7152 * src[i + 1]! + 0.0722 * src[i + 2]!);
      down[ay * ATLAS_W + ax]! += lum;
      counts[ay * ATLAS_W + ax]!++;
    }
  }

  const mask: number[] = [];
  for (let i = 0; i < ATLAS_W * ATLAS_H; i++) {
    const avg = down[i]! / counts[i]!;
    mask.push(avg >= THRESHOLD ? 1 : 0);
  }
  return mask;
}

async function main() {
  const fontPath = tryRegisterFont();
  console.log(`using font: ${fontPath}`);

  const atlas = {
    width: ATLAS_W,
    height: ATLAS_H,
    glyphs: [] as Array<{ char: string; mask: number[]; coverage: number }>,
  };

  for (const ch of GLYPHS) {
    const mask = renderGlyph(ch);
    const coverage = mask.reduce((a, b) => a + b, 0) / mask.length;
    atlas.glyphs.push({ char: ch, mask, coverage });
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const out = resolve(here, '..', 'src', 'core', 'atlas.json');
  await writeFile(out, JSON.stringify(atlas));
  console.log(`wrote ${atlas.glyphs.length} glyphs (${ATLAS_W}x${ATLAS_H}) → ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
