# CLI reference

Full command reference for the `milli` CLI. For setup recipes (Neovim splash, terminal screensaver, fastfetch, etc.) see [recipes.md](./recipes.md). For the library API and `.milli` format, see [api.md](./api.md).

- [milli image](#milli-image)
- [milli play](#milli-play)
- [milli convert](#milli-convert)
- [milli export](#milli-export)
- [Render modes](#render-modes)
- [Export targets](#export-targets)

## `milli image`

Render a single image to ANSI-colored ASCII on stdout. The default command — `milli pic.png` is shorthand for `milli image pic.png`.

```bash
milli image <path> [options]
```

**Options:**

| Flag                  | Default             | Description                                           |
| --------------------- | ------------------- | ----------------------------------------------------- |
| `-w, --width <cols>`  | terminal width      | Columns (chars wide)                                  |
| `-h, --height <rows>` | terminal height - 2 | Rows (chars tall)                                     |
| `-m, --mode <mode>`   | `match`             | Render mode (`match` / `ramp` / `braille`)            |
| `-s, --symbols <set>` | `ascii`             | Ramp-mode glyph set (`ascii` / `block` / `braille` / `all`) |
| `--no-color`          | off                 | Monochrome output                                     |
| `--bg`                | auto (match mode)   | Render background color per cell                      |
| `--invert`            | off                 | Invert luminance ramp                                 |
| `--dither`            | off                 | Floyd-Steinberg dithering (ramp mode only)            |
| `--aspect <ratio>`    | `0.5`               | Char width/height ratio (tune if output is stretched) |

**Examples:**

```bash
milli image pic.png                              # auto-fit to terminal
milli image pic.png -w 60                        # fixed width
milli image pic.png -m ramp --dither             # classic ASCII, dithered
milli image pic.png -m braille --no-color        # monochrome braille
milli image pic.png > out.ansi                   # pipe to file
```

## `milli play`

Play a GIF (or pre-baked `.milli` file) as a terminal animation. Alt-screen, hidden cursor, Ctrl+C restores cleanly. Only changed cells are rewritten each frame, so it's cheap over SSH.

```bash
milli play <path> [options]
```

**Options:**

| Flag                  | Default             | Description                                                |
| --------------------- | ------------------- | ---------------------------------------------------------- |
| `-w, --width <cols>`  | terminal width      | Columns                                                    |
| `-h, --height <rows>` | terminal height - 2 | Rows                                                       |
| `-m, --mode <mode>`   | `match`             | Render mode                                                |
| `-s, --symbols <set>` | `ascii`             | Ramp-mode glyph set                                        |
| `--no-color`          | off                 | Monochrome                                                 |
| `--no-loop`           | loops by default    | Play once and exit                                         |
| `--fps <n>`           | source delays       | Override framerate                                         |
| `--aspect <ratio>`    | `0.5`               | Char w/h ratio                                             |
| `--inline`            | off                 | Paint in-place (no alt-screen) for composition with other output |
| `--at <x,y>`          | `1,1`               | Inline anchor as 1-based terminal cell                     |

**Examples:**

```bash
milli play anim.gif                              # loops forever, Ctrl+C to exit
milli play anim.gif --no-loop                    # play once
milli play anim.gif -w 80 -m ramp --fps 12
milli play anim.milli                            # pre-baked, instant start
milli play anim.milli --inline --at 5,3          # animate at col 5 row 3, no alt-screen
```

`--inline` is the building block for the [animated fastfetch recipe](./recipes.md#animated-logo-for-fastfetch) and any composition where you want milli to paint into a specific region without taking over the whole terminal.

## `milli convert`

Bake an image or GIF into a `.milli` file — a gzipped, delta-encoded frame format. Playback needs only the core engine (no `sharp`, no image decoder), so `.milli` files start instantly and ship with your app.

```bash
milli convert <input> <output.milli> [options]
```

**Options:**

| Flag                  | Default          | Description         |
| --------------------- | ---------------- | ------------------- |
| `-w, --width <cols>`  | `100`            | Target columns      |
| `-h, --height <rows>` | `40`             | Target rows         |
| `-m, --mode <mode>`   | `match`          | Render mode         |
| `-s, --symbols <set>` | `ascii`          | Ramp-mode glyph set |
| `--no-loop`           | loops by default | Mark as play-once   |
| `--aspect <ratio>`    | `0.5`            | Char w/h ratio      |

**Examples:**

```bash
milli convert hero.gif hero.milli -w 80 -m match
milli convert logo.png logo.milli -w 40             # single-frame .milli is fine
```

For format details (keyframe + delta encoding, glyph dedupe, etc.) see [api.md#milli-format](./api.md#milli-format).

## `milli export`

Emit frames as source code for another language/runtime. For Neovim, Go TUIs (Bubbletea), or any project where you want ASCII animation without a dependency on Node.

```bash
milli export <input> <outdir> [options]
```

**Options:**

| Flag                    | Default              | Description                                                                  |
| ----------------------- | -------------------- | ---------------------------------------------------------------------------- |
| `-t, --target <target>` | `go`                 | `go` / `lua` / `json`                                                        |
| `-w, --width <cols>`    | `80`                 | Columns                                                                      |
| `-h, --height <rows>`   | -                    | Rows cap (optional)                                                          |
| `-m, --mode <mode>`     | `match`              | Render mode                                                                  |
| `-s, --symbols <set>`   | `ascii`              | Ramp-mode glyph set                                                          |
| `-p, --package <name>`  | outdir basename      | Go package name                                                              |
| `--aspect <ratio>`      | `0.5`                | Char w/h ratio                                                               |
| `--no-helper`           | helper on            | Skip helper file (Go target only; Lua is always data-only)                   |
| `--no-color`            | Lua target: color on | Omit per-cell color runs (smaller file)                                      |
| `--no-bg`               | bg kept              | Fully transparent background (sugar for `--bg-threshold 1`)                  |
| `--bg-threshold <n>`    | `0`                  | Luma-gated transparency `0..1` (drop bg when cell's bg luma below threshold) |

**Examples:**

```bash
# Go: frames.go + splash.go (Tick/Render helper for Bubbletea)
milli export anim.gif ./out -t go -p bootsplash -w 50

# Lua: emits frames.lua (data-only). Drop into milli.nvim's splashes dir.
milli export anim.gif ./out -t lua -w 60 --no-bg

# JSON: frames.json with full { glyph, fg, bg } grid per frame
milli export anim.gif ./out -t json -w 50
```

## Render modes

| Mode      | What it does                                                                                                                                                                                                  | Best for                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `match`   | Pixel-perfect glyph matching: for each cell, picks the glyph + fg/bg pair whose rendered pixels best approximate the source region (sobel-weighted MSE over a pre-baked font atlas). Color is essential here. | Photos, screenshots, logos where detail matters    |
| `ramp`    | Classic luminance ramp: maps brightness to a gradient of characters (`" .:-=+*#%@"` by default). Pair with `--dither` for Floyd-Steinberg error diffusion.                                                    | Stylized / retro look, monochrome, low-res         |
| `braille` | Treats each cell as a 2×4 sub-pixel grid using Unicode braille characters. Higher effective resolution, mono-colored per cell.                                                                                | High-detail line art, dashboard splashes, diagrams |

**Tip:** for nvim dashboards and TUIs, `braille` + `--no-bg` produces a clean look that blends with any colorscheme.

## Export targets

### Go / Bubbletea

```bash
milli export anim.gif ./bootsplash -t go -p bootsplash -w 50
```

Emits:

- `frames.go` — frame data (ANSI strings per frame, delays)
- `splash.go` — Bubbletea helper with `Tick`, `Render`, `TickMsg`, `DoneMsg`

For wiring into a Bubbletea model, see [recipes.md#bubbletea-tui-splash](./recipes.md#bubbletea-tui-splash).

### Lua / Neovim

```bash
milli export anim.gif ./out -t lua -w 60 --no-bg
```

Emits `frames.lua` — a data module with frame glyphs + per-cell color runs.

Use with **[milli.nvim](https://github.com/Amansingh-afk/milli.nvim)** — the companion plugin ships the runtime (paint, loop, extmark coloring) and dashboard presets. See [recipes.md#neovim-dashboard-splash](./recipes.md#neovim-dashboard-splash).

### JSON

```bash
milli export anim.gif ./out -t json -w 50
```

Emits `frames.json` — full `{ cols, rows, delays, frames: [[{ glyph, fg, bg }]] }`. Use for custom runtimes (Python/textual, Rust/ratatui, web players, etc).

Want a first-class helper for your language? [Open an issue](https://github.com/Amansingh-afk/milli/issues/new) — if there's demand, we'll ship it (Go and Neovim already have dedicated paths).
