import { readFile, writeFile } from 'node:fs/promises';
import { decodeMilli, frameToGrid } from '../src/core/format.js';
import { emitLuaData } from '../src/core/emit.js';

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error('usage: milli-to-lua <in.milli> <out.lua>');
  process.exit(1);
}

const buf = await readFile(input);
const file = decodeMilli(new Uint8Array(buf));
const grids = file.frames.map((_, i) => frameToGrid(file, i));
const delays = file.frames.map((f) => f.delay);
const lua = emitLuaData(grids, delays, file.loop);
await writeFile(output, lua);
console.log(`${input} -> ${output}`);
