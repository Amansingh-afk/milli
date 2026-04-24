export const RAMPS: Record<string, string> = {
  ascii: ' .:-=+*#%@',
  asciiLong: " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  block: ' ░▒▓█',
  braille: ' ⠁⠃⠇⠏⠟⠿⡿⣿',
};

export function pickGlyph(luminance: number, ramp: string, invert: boolean): string {
  const l = invert ? 1 - luminance : luminance;
  const idx = Math.min(ramp.length - 1, Math.max(0, Math.floor(l * ramp.length)));
  return ramp[idx]!;
}

export function rampFor(set: string): string {
  switch (set) {
    case 'ascii': return RAMPS.asciiLong!;
    case 'block': return RAMPS.block!;
    case 'braille': return RAMPS.braille!;
    case 'all': return RAMPS.asciiLong! + RAMPS.block!;
    default: return RAMPS.ascii!;
  }
}
