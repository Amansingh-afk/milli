# CLI reference

Full command reference for the `milli` CLI. For setup recipes (Neovim splash, terminal screensaver, fastfetch, etc.) see [recipes.md](./recipes.md). For the library API and `.milli` format, see [api.md](./api.md).

- [milli image](#milli-image)
- [milli play](#milli-play)
- [milli convert](#milli-convert)
- [milli export](#milli-export)
- [milli fastfetch](#milli-fastfetch)
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

## `milli fastfetch`

Run `fastfetch` with an animated `.milli` logo. Wraps the `--inline` paint trick into a single command — no shell wrapper, no manually-sized blank-logo file.

```bash
milli fastfetch <path.milli> [options]
```

**Options:**

| Flag                  | Default | Description                                                       |
| --------------------- | ------- | ----------------------------------------------------------------- |
| `--at <pos>`          | `3,2`   | Inline anchor as `x,y` (1-based). Match your fastfetch logo padding. |
| `--ff-args <args>`    | -       | Extra args passed through to `fastfetch` (whitespace-split).      |

**What it does:**

1. Reads the `.milli` header → derives the logo column dimensions (cols × rows).
2. Writes a blank-spaces placeholder file to `$TMPDIR` so `fastfetch` reserves the logo column.
3. Spawns `fastfetch --logo <tmp> --logo-type file-raw [your --ff-args]`. Fastfetch prints info on the right and exits.
4. Loops the animation in the reserved column via inline play (no alt-screen). Ctrl+C exits and the cursor lands below.

**Examples:**

```bash
# bake once, then run
milli convert clip.gif ~/.config/milli/anim.milli -w 50 -m match
milli fastfetch ~/.config/milli/anim.milli

# pass a custom fastfetch config
milli fastfetch ~/.config/milli/anim.milli --ff-args "--config minimal.jsonc"

# tweak inline anchor (default 3,2 matches padding top:1 left:2)
milli fastfetch ~/.config/milli/anim.milli --at 4,3
```

**Make it your default fastfetch:**

```bash
# ~/.zshrc / ~/.bashrc
alias fastfetch='milli fastfetch ~/.config/milli/anim.milli'
```

Use `command fastfetch` (or `\fastfetch`) when you want the real one-shot fastfetch.

Requires `fastfetch` on `$PATH` — install from [fastfetch-cli/fastfetch](https://github.com/fastfetch-cli/fastfetch).

## `milli text`

Animate any text with a procedural effect. No source image — frames are computed from a built-in block font, so it works offline, loops forever live, and bakes to any export target.

```bash
milli text <string> [options]
```

**Options:**

| Flag                   | Default   | Description                                                          |
| ---------------------- | --------- | -------------------------------------------------------------------- |
| `-e, --effect <name>`  | `fire`    | `fire` / `glitch` / `wave` / `matrix` / `dissolve` / `typewriter` / `pulse` / `rainbow` |
| `-c, --color <hex>`    | `#00ffbe` | Base color (effects that take one: glitch, dissolve, typewriter, pulse) |
| `--fps <n>`            | `30`      | Frame rate                                                            |
| `--scale <n>`          | `2`       | Horizontal cells per font pixel (vertical is half; bigger = larger text) |
| `--seed <n>`           | `1337`    | Random seed — same seed, same animation                               |
| `--seconds <n>`        | forever   | Stop live playback after n seconds                                    |
| `-o, --export <outdir>`| -         | Bake frames to files instead of playing                               |
| `-t, --target <t>`     | `lua`     | Export target: `lua` / `go` / `json` / `milli`                        |
| `--frames <n>`         | one loop  | Baked frame count (default: the effect's clean loop period)           |
| `-p, --package <name>` | slug      | Go package name (go target)                                           |

**Examples:**

```bash
# flaming text in your terminal, right now
milli text "MILLI" -e fire

# glitchy banner, custom color
milli text "SYSTEM ONLINE" -e glitch -c "#ff0044"

# bake a matrix-rain reveal of your name for your nvim dashboard
milli text "NEOVIM" -e matrix -o ./out -t lua
cp ./out/neovim-matrix.lua ~/.config/nvim/lua/milli/splashes/myname.lua

# ship a .milli for fastfetch / play
milli text "YOLO" -e wave -o ./out -t milli
milli play ./out/yolo-wave.milli
```

Effect cheat sheet: `fire` burns the letters (DOOM-style heat sim), `glitch` does RGB channel-split + row tearing, `wave` ripples with a hue sweep, `matrix` reveals the text behind falling rain, `dissolve` blows letters into particles and reassembles, `typewriter` types with a blinking cursor, `pulse` breathes with a neon glow halo, `rainbow` scrolls a gradient.

## `milli shader`

Run a real-time procedural shader in the terminal. Pure math — no assets, never repeats, fills whatever size you give it.

```bash
milli shader <name> [options]
```

Shaders: `plasma`, `rain` (matrix rain), `doomfire`, `starfield`, `tunnel`, `waves`.

**Options:**

| Flag                   | Default       | Description                                            |
| ---------------------- | ------------- | ------------------------------------------------------- |
| `-w, --width <cols>`   | terminal      | Columns                                                 |
| `-h, --height <rows>`  | terminal      | Rows                                                    |
| `--fps <n>`            | `30`          | Frame rate                                              |
| `--hue <deg>`          | per-shader    | Base hue 0-360 (recolor rain, plasma, tunnel, waves, starfield) |
| `--seed <n>`           | `1337`        | Random seed                                             |
| `--seconds <n>`        | forever       | Stop after n seconds (screensaver-with-timeout)         |
| `-o, --export <outdir>`| -             | Bake frames instead of playing                          |
| `-t, --target <t>`     | `lua`         | `lua` / `go` / `json` / `milli`                         |
| `--frames <n>`         | loop period   | Baked frame count                                       |

**Examples:**

```bash
# fullscreen matrix rain — instant screensaver
milli shader rain

# purple plasma, 10-second burst
milli shader plasma --hue 280 --seconds 10

# bake DOOM fire into a .milli for fastfetch
milli shader doomfire -w 50 -h 14 -o ./out -t milli
milli fastfetch ./out/doomfire.milli
```

> milli.nvim ships native Lua ports of `plasma`, `rain`, `doomfire`, and `starfield` — those run live inside Neovim with zero baked frames (`:MilliShader rain`). Baking is for the other targets or fixed-size loops.

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
