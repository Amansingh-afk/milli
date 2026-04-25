# milli

Pixel-perfect animated ASCII art. Images, GIFs, video frames - in your terminal, in the [browser playground](https://milli-five.vercel.app/), or baked into Go / Lua / JSON for embedding in TUIs and Neovim dashboards.

![demo](demo.gif)

[![Try in Browser](https://img.shields.io/badge/▸_try_in_browser-00ffe1?style=for-the-badge&labelColor=000000)](https://milli-five.vercel.app/)
[![npm](https://img.shields.io/npm/v/@amansingh-afk/milli?style=for-the-badge&color=cb3837&labelColor=000000&label=npm)](https://www.npmjs.com/package/@amansingh-afk/milli)
[![GitHub stars](https://img.shields.io/github/stars/Amansingh-afk/milli?style=for-the-badge&logo=github&color=181717&labelColor=000000)](https://github.com/Amansingh-afk/milli)
[![License](https://img.shields.io/github/license/Amansingh-afk/milli?style=for-the-badge&labelColor=000000)](./LICENSE)

> No install. Drop an image or GIF into the [web playground](https://milli-five.vercel.app/) and grab the ASCII / `.milli` / Go / Lua / JSON output instantly. Same engine as the CLI, all browser-side.

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Commands](#commands)
  - [milli image](#milli-image)
  - [milli play](#milli-play)
  - [milli convert](#milli-convert)
  - [milli export](#milli-export)
- [Render modes](#render-modes)
- [Export targets](#export-targets)
  - [Go / Bubbletea](#go--bubbletea)
  - [Lua / Neovim](#lua--neovim)
  - [JSON](#json)
- [Library API](#library-api)
- [Recipes](#recipes)
  - [Neovim dashboard splash](#neovim-dashboard-splash)
  - [Terminal screensaver on idle](#terminal-screensaver-on-idle)
  - [Shell MOTD greeting](#shell-motd-greeting)
  - [tmux pane decoration](#tmux-pane-decoration)
  - [React / web embed](#react--web-embed)
  - [Bubbletea TUI splash](#bubbletea-tui-splash)
  - [Static logo for neofetch / fastfetch](#static-logo-for-neofetch--fastfetch)
- [.milli format](#milli-format)
- [Supported inputs](#supported-inputs)
- [FAQ](#faq)
- [Comparison with chafa](#comparison-with-chafa)
- [Non-goals](#non-goals)
- [License](#license)

## Install

```bash
npm install -g @amansingh-afk/milli
```

Or one-shot without install:

```bash
npx @amansingh-afk/milli image pic.png
```

Prefer no install? Use the [**web playground**](https://milli-five.vercel.app/) – drag an image / GIF, get ASCII + every export format in your browser.

Requires Node 18+ and a terminal with truecolor (`COLORTERM=truecolor`). Most modern terminals qualify.

## Quick start

```bash
# render any image to ASCII
milli image pic.png

# animated GIF in the terminal
milli play anim.gif

# bake GIF into a fast-loading .milli file (no sharp/ffmpeg at playback time)
milli convert anim.gif anim.milli
milli play anim.milli

# export frames as Lua for Neovim dashboards (use with milli.nvim)
milli export anim.gif ./out -t lua -w 60 --no-bg

# export frames as Go for Bubbletea splashes
milli export anim.gif ./out -t go -p bootsplash -w 50
```

## Commands

### `milli image`

Render a single image to ANSI-colored ASCII on stdout. The default command - `milli pic.png` is shorthand for `milli image pic.png`.

```bash
milli image <path> [options]
```

**Options:**


| Flag                  | Default             | Description                                           |
| --------------------- | ------------------- | ----------------------------------------------------- |
| `-w, --width <cols>`  | terminal width      | Columns (chars wide)                                  |
| `-h, --height <rows>` | terminal height - 2 | Rows (chars tall)                                     |
| `-m, --mode <mode>`   | `match`             | Render mode: `match`                                  |
| `-s, --symbols <set>` | `ascii`             | Ramp-mode glyph set: `ascii`                          |
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

### `milli play`

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

### `milli convert`

Bake an image or GIF into a `.milli` file - a gzipped, delta-encoded frame format. Playback needs only the core engine (no `sharp`, no image decoder), so `.milli` files start instantly and ship with your app.

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

### `milli export`

Emit frames as source code for another language/runtime. For Neovim, Go TUIs (Bubbletea), or any project where you want ASCII animation without a dependency on Node.

```bash
milli export <input> <outdir> [options]
```

**Options:**


| Flag                    | Default              | Description                                                                  |
| ----------------------- | -------------------- | ---------------------------------------------------------------------------- |
| `-t, --target <target>` | `go`                 | `go`                                                                         |
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

- `frames.go` - frame data (ANSI strings per frame, delays)
- `splash.go` - Bubbletea helper with `Tick`, `Render`, `TickMsg`, `DoneMsg`

Usage:

```go
import "myapp/internal/bootsplash"

func (m Model) Init() tea.Cmd { return bootsplash.Tick(0) }

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case bootsplash.TickMsg:
        m.splashFrame = msg.Index
        return m, bootsplash.Tick(msg.Index)
    case bootsplash.DoneMsg:
        m.splashing = false
    }
    return m, nil
}

func (m Model) View() string {
    if m.splashing { return bootsplash.Render(m.splashFrame, m.width, m.height) }
    return m.mainView()
}
```

### Lua / Neovim

```bash
milli export anim.gif ./out -t lua -w 60 --no-bg
```

Emits `frames.lua` - a data module with frame glyphs + per-cell color runs.

Use with **[milli.nvim](https://github.com/Amansingh-afk/milli.nvim)** - the companion plugin ships the runtime (paint, loop, extmark coloring) and dashboard presets. See its [Using your own splash](https://github.com/Amansingh-afk/milli.nvim#using-your-own-splash) section for the drop-in workflow.

### JSON

```bash
milli export anim.gif ./out -t json -w 50
```

Emits `frames.json` - full `{ cols, rows, delays, frames: [[{ glyph, fg, bg }]] }`. Use for custom runtimes (Python/textual, Rust/ratatui, web players, etc).

Want a first-class helper for your language? [Open an issue](https://github.com/Amansingh-afk/milli/issues/new) - if there's demand, we'll ship it (Go and Neovim already have dedicated paths).

## Library API

milli also ships a programmatic API for embedding in Node apps:

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

## Recipes

Real-world places to drop milli output. Examples are minimal - swap the splash file / size for your own.

### Neovim dashboard splash

Use **[milli.nvim](https://github.com/Amansingh-afk/milli.nvim)** - the companion plugin handles paint, looping, and dashboard host wiring (dashboard-nvim, alpha-nvim, mini.starter, snacks.nvim).

```lua
-- lazy.nvim
{
  "Amansingh-afk/milli.nvim",
  lazy = false,
  config = function()
    require("milli").dashboard({ splash = "fire", loop = true })
  end,
}
```

29 splashes ship bundled. Drop your own `frames.lua` from `milli export -t lua` into the plugin's `splashes/` directory and reference it by name.

### Terminal screensaver on idle

Bake once at fullscreen-friendly width, loop forever in a fullscreen terminal launched by your idle daemon.

```bash
milli convert your.gif ~/.config/milli/saver.milli -w 220 -m braille
```

`braille` mode is mono-per-cell with no background, so it overlays cleanly on any terminal theme. Bump `-w` until the rendered ASCII fills your screen at your terminal's font size.

**Wayland + Hyprland (hypridle)** — `~/.config/hypr/hypridle.conf`:

```
listener {
    timeout = 300
    on-timeout = alacritty --class milli-saver -e milli play ~/.config/milli/saver.milli
}
```

Pair with a windowrule in `~/.config/hypr/windowrules.conf` so it fullscreens borderless:

```
windowrulev2 = fullscreen, class:^(milli-saver)$
windowrulev2 = noborder, class:^(milli-saver)$
```

Add `exec-once = hypridle` to `hyprland.conf` to autostart.

> Skip `on-resume` to kill the saver — Hyprland's cursor unhide on window creation fires resume immediately and would kill the window before it renders. Close manually with your usual close binding.

**Wayland + sway / wlroots (swayidle)**:

```bash
swayidle -w timeout 300 'alacritty --class milli-saver -e milli play ~/.config/milli/saver.milli'
```

**X11 + xscreensaver** — in `~/.xscreensaver`, `programs:`:

```
"milli"  xterm -fullscreen -e milli play ~/.config/milli/saver.milli  \n\
```

**X11 + plain idle poll** — `xprintidle` + bash loop:

```bash
while true; do
  if [ "$(xprintidle)" -gt 300000 ]; then
    kitty --start-as fullscreen -e milli play ~/.config/milli/saver.milli
  fi
  sleep 5
done
```

**macOS** — no native terminal-screensaver hook. Use Hammerspoon (or similar) watching idle and launching iTerm / kitty fullscreen with `milli play`.

Tip: kitty / wezterm / alacritty with a fullscreen flag give a borderless canvas. ASCII looks much better with a tight cell-padded font.

### Shell MOTD greeting

Play a short clip on shell startup. Use `--no-loop` so it exits and drops you at the prompt.

```bash
# ~/.zshrc or ~/.bashrc
milli play ~/.config/milli/greet.milli --no-loop
```

Bake once for instant startup (no GIF decode on every shell):

```bash
milli convert greet.gif ~/.config/milli/greet.milli -w 60
```

For an instant single-frame logo (no animation), use `milli image`:

```bash
milli image ~/.config/milli/logo.png -w 60 --no-bg
```

### tmux pane decoration

Decorate a pane with a looping splash while you work in another.

```bash
# ~/.tmux.conf
bind-key M-m split-window -h -p 30 'milli play ~/.config/milli/decor.milli'
```

`Prefix + Alt-m` opens a 30%-wide pane on the right running the splash. Resize with prefix arrows; closing the pane stops playback.

### React / web embed

Render any `.milli` file in a React component using the published browser subpath.

```bash
npm install @amansingh-afk/milli
```

```tsx
import { useEffect, useRef } from 'react';
import { decodeMilli, frameToGrid } from '@amansingh-afk/milli/web';

export function Splash({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
      const file = decodeMilli(buf);
      const ctx = canvasRef.current!.getContext('2d')!;
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        const grid = frameToGrid(file, i);
        // ...your renderer (canvas / DOM / WebGL) draws grid[y][x] = { glyph, fg, bg }
        i = (i + 1) % file.frames.length;
        setTimeout(tick, file.delays[i] ?? 100);
      };
      tick();
    })();
    return () => { cancelled = true; };
  }, [src]);

  return <canvas ref={canvasRef} width={1200} height={630} />;
}
```

The web playground at [milli-five.vercel.app](https://milli-five.vercel.app/) uses this exact import.

### Bubbletea TUI splash

```bash
milli export anim.gif ./bootsplash -t go -p bootsplash -w 50
```

Wire the emitted helper into your model:

```go
import "myapp/internal/bootsplash"

func (m Model) Init() tea.Cmd { return bootsplash.Tick(0) }

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case bootsplash.TickMsg:
        m.splashFrame = msg.Index
        return m, bootsplash.Tick(msg.Index)
    case bootsplash.DoneMsg:
        m.splashing = false
    }
    return m, nil
}

func (m Model) View() string {
    if m.splashing { return bootsplash.Render(m.splashFrame, m.width, m.height) }
    return m.mainView()
}
```

The generated `splash.go` ships `Tick`, `Render`, `TickMsg`, `DoneMsg` - no extra dependency on milli at runtime.

### Static logo for neofetch / fastfetch

Caveat first: neofetch / fastfetch print their logo once and exit, so **animation isn't possible** in either tool. A single rendered frame as the logo works fine.

```bash
# render any image as a colored ASCII logo (40 cols is a good fastfetch fit)
milli image logo.png -w 40 -m match > ~/.config/fastfetch/logo.txt
```

`match` mode preserves source colors per cell (best for logos with brand colors). For a flatter look, use `-m ramp` (luminance to ASCII chars, no per-cell bg).

**fastfetch** — replace the default distro logo. In `~/.config/fastfetch/config.jsonc`, swap your existing `"logo"` block (typically `"type": "auto"`) with:

```jsonc
"logo": {
  "source": "~/.config/fastfetch/logo.txt",
  "type": "file-raw",
  "padding": { "top": 1, "left": 2, "right": 2 }
}
```

`file-raw` passes the ANSI escapes through unchanged — required for color. The plain `file` type strips escapes and you'll lose color. To test before editing config, override on the CLI:

```bash
fastfetch --logo ~/.config/fastfetch/logo.txt --logo-type file-raw
```

**neofetch** — in `~/.config/neofetch/config.conf`:

```bash
ascii_distro="off"
image_backend="ascii"
image_source="~/.config/fastfetch/logo.txt"
```

neofetch reads the file as-is but its layout assumes a fixed-width box. If colors look broken, drop to mono with `milli image logo.png -w 40 -m braille --no-color`.

**Animated logo (`milli play --inline`)** — a tiny wrapper composes static fastfetch info with a looping milli animation in the logo region.

```bash
# 1. bake a small .milli (50 cols × 18 rows is a good size)
milli convert clip.gif ~/.config/milli/anim.milli -w 50 -m match

# 2. blank placeholder so fastfetch reserves the logo column
python3 -c "print('\n'.join([' '*50]*18))" > ~/.config/fastfetch/blank-logo.txt
```

Save as `~/.local/bin/animfetch` and `chmod +x` it:

```bash
#!/usr/bin/env bash
set -e
clear
fastfetch --logo ~/.config/fastfetch/blank-logo.txt --logo-type file-raw
exec milli play ~/.config/milli/anim.milli --inline --at 3,2
```

`fastfetch` prints once and exits, leaving info on the right and an empty logo column on the left. `milli play --inline` then loops over that column without alt-screen or scroll. Ctrl+C exits and the cursor lands below the animation. Resize to fit your terminal — frames clip if smaller than baked dimensions.

Run with `animfetch`. To make it your default, alias in your shell rc:

```bash
# ~/.zshrc / ~/.bashrc
alias fastfetch=animfetch
```

Use `command fastfetch` (or `\fastfetch`) when you want the real one-shot fastfetch instead of the animated wrapper.

## `.milli` format

Compact animated ASCII format, optimized for instant playback:

- **Keyframe + delta** - every Nth frame is a full snapshot; intermediate frames store only changed cells (40% change threshold). Typical ~30-70% smaller than JSON.
- **Glyph dedupe** - shared glyph table across all frames
- **Gzipped** - pako deflate for an extra ~30% on top
- **Self-describing** - version, width, height, delays, loop flag baked in
- **Zero runtime deps** - decoder is pure JS, no `sharp` needed

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


Video (mp4/webm) is planned - for now, extract frames with `ffmpeg -i input.mp4 -r 12 frames/%04d.png` and process each.

## FAQ

**Is it fast?**  
Yes. The match-mode glyph search uses a pre-baked font atlas and sobel-weighted MSE over small regions. Decoding a 400×400 GIF at 80×32 cells runs at ~60fps on a laptop. Playback from `.milli` is essentially free - it's just pre-rendered ANSI strings with diff-based output.

**Why does my output look stretched?**  
Terminal cells are usually ~2:1 tall vs wide. Default `--aspect 0.5` compensates. If your font is different, override: `--aspect 0.45` (wider glyphs) or `--aspect 0.55` (narrower).

**How do I get a transparent background in Neovim?**  
Use `--no-bg` on export: `milli export anim.gif ./out -t lua --no-bg`. Or `--bg-threshold 0.3` to drop only dark backgrounds (luma-gated).

**Why don't my colors look right?**  
Make sure your terminal supports truecolor - check with `echo $COLORTERM` (should print `truecolor`). Fallback: `--no-color` for ASCII-only output.

**Can I use this in a browser?**  
The core engine is pure TS and browser-compatible. Right now the published npm package ships Node-only (requires `sharp` for decoding). A dedicated browser bundle is in development.

**What's the difference between `milli play anim.gif` and `milli play anim.milli`?**  
`.gif` decodes + renders frames on startup (1-3s for a big GIF). `.milli` is pre-baked and plays instantly.

**Where does the font atlas come from?**  
JetBrainsMono at 8×16. Regenerate with `npx tsx scripts/build-atlas.ts` if you want a different font - then rebuild.

**Can I customize the ASCII ramp characters?**  
Use `-s block` (`" ░▒▓█"`) or `-s braille` (`" ⠁⠃⠇⠏⠟⠿⣿"`) or `-s all` (unified dense set). Custom ramps are a roadmap item.

**How do I know it looks right before committing?**  
Pipe to `less -R`: `milli image pic.png -w 80 | less -R`. Or for animation, preview in your terminal - alt-screen restores cleanly on exit.

## Comparison with chafa

[chafa](https://hpjansson.org/chafa/) is the quality floor. milli offers:

- **Pre-baked format** - `.milli` for instant playback, ship with your app
- **Source export** - Go / Lua / JSON for embedding (chafa is a binary)
- **Programmatic API** - use as a Node library
- **Neovim integration** - first-party dashboard plugin
- **Truecolor glyph matching** - match mode uses per-glyph MSE, not just dominant color per cell

If you just want a one-shot terminal render and chafa is installed - chafa is great. If you want to embed ASCII animation in your product (TUI splash, nvim dashboard, TUI game asset), milli is built for that.

## Non-goals

- **Not a terminal image protocol.** Sixel, kitty, iTerm2 inline images draw pixels. milli draws glyphs.
- **Not a TUI framework.** Use ink / blessed / bubbletea / ratatui. milli is a widget.
- **No streaming / webcam.** Offline clips only.

## License

MIT.