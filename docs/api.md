# Library API & format

Programmatic API for embedding milli in Node / browser projects, plus the binary `.milli` format spec.

- [Library API](#library-api)
- [`.milli` format](#milli-format)
- [Supported inputs](#supported-inputs)

## Library API

milli ships a programmatic API for embedding in Node apps:

```ts
import { AsciiPlayer } from '@amansingh-afk/milli';

const p = await AsciiPlayer.load('./logo.milli');

// fullscreen playback with auto-cleanup on Ctrl+C
await p.play({ loop: true, fps: 30 });

// or drive manually (for custom scheduling):
const t0 = Date.now();
setInterval(() => {
  const ansi = p.renderAnsiAt(Date.now() - t0); // time-based, loop-aware
  process.stdout.write(ansi);
}, 33);

// or pull raw cells for your own renderer:
const grid = p.frame(0); // grid[y][x] = { glyph: 'X', fg: [r,g,b], bg: [r,g,b] }
```

Lower-level exports (engine, format, renderers):

```ts
import {
  frameToCells, fitGrid,                 // engine: pixel data → cells
  encodeMilli, decodeMilli, frameToGrid, // format: .milli encode/decode
  cellsToAnsi, cellsToAnsiDiff,          // ANSI rendering
  play,                                  // fullscreen player
} from '@amansingh-afk/milli';
```

### Browser subpath

For browser / React projects use the `/web` subpath — Node-only modules (`sharp`, `node:fs`) are excluded:

```ts
import { decodeMilli, frameToGrid } from '@amansingh-afk/milli/web';
```

See [recipes.md#react--web-embed](./recipes.md#react--web-embed) for a worked React example.

## `.milli` format

Compact animated ASCII format, optimized for instant playback:

- **Keyframe + delta** — every Nth frame is a full snapshot; intermediate frames store only changed cells (40% change threshold). Typical ~30-70% smaller than JSON.
- **Glyph dedupe** — shared glyph table across all frames
- **Gzipped** — pako deflate for an extra ~30% on top
- **Self-describing** — version, width, height, delays, loop flag baked in
- **Zero runtime deps** — decoder is pure JS, no `sharp` needed

Use cases:

- Ship a pre-baked splash with your CLI (`require('my-cli/splash.milli')`)
- Load-once, play-many (web apps, TUIs)
- Network-friendly (small over the wire)

## Supported inputs

Backed by [sharp](https://sharp.pixelplumbing.com/) for image decoding:

| Format           | `image` | `play` | `convert` | `export` |
| ---------------- | ------- | ------ | --------- | -------- |
| PNG              | ✓       | -      | ✓         | ✓        |
| JPEG             | ✓       | -      | ✓         | ✓        |
| WebP (animated)  | ✓       | ✓      | ✓         | ✓        |
| GIF              | ✓       | ✓      | ✓         | ✓        |
| APNG             | ✓       | ✓      | ✓         | ✓        |
| TIFF             | ✓       | -      | ✓         | ✓        |
| AVIF / HEIF      | ✓       | -      | ✓         | ✓        |
| SVG (rasterized) | ✓       | -      | ✓         | ✓        |
| `.milli`         | -       | ✓      | -         | -        |

Video (mp4/webm) is planned — for now, extract frames with `ffmpeg -i input.mp4 -r 12 frames/%04d.png` and process each.
