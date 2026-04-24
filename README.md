# milli

pixel-perfect animated ascii art. images, gifs. CLI.

quality floor: [chafa](https://hpjansson.org/chafa/). above that: pre-baked format, drop-in exports for your own tui / nvim dashboard.

```
    ███╗   ███╗██╗██╗     ██╗     ██╗
    ████╗ ████║██║██║     ██║     ██║
    ██╔████╔██║██║██║     ██║     ██║
    ██║╚██╔╝██║██║██║     ██║     ██║
    ██║ ╚═╝ ██║██║███████╗███████╗██║
    ╚═╝     ╚═╝╚═╝╚══════╝╚══════╝╚═╝
```

## install

```bash
npm install -g @amansingh-afk/milli
```

or one-shot via `npx @amansingh-afk/milli <cmd>`.

## cli

```bash
milli image pic.png                  # default: pixel-perfect match
milli image pic.png -m ramp --dither # naive ramp + floyd-steinberg
milli play anim.gif                  # animated gif in terminal
milli convert anim.gif anim.milli    # bake once, play anywhere
milli play anim.milli                # no sharp/ffmpeg needed
```

flags live in `--help`. common ones: `-w/--width`, `-m/--mode {match|ramp|braille}`, `--no-color`, `--fps`, `--no-loop`, `--dither`, `--no-bg`, `--bg-threshold <0..1>`.

player takes alt-screen, hides cursor, restores on ctrl+c. diff-render under the hood — only changed cells get rewritten, cheap over ssh.

## export

bake an animation into drop-in source files for other runtimes. output goes under `<outdir>/`.

```bash
# go — for bubbletea / any go tui. emits frames.go + splash.go helper
milli export anim.gif ./out -t go -p bootsplash -w 50

# lua — for nvim dashboards / any lua runtime. emits frames.lua + init.lua helper
milli export anim.gif ./out -t lua -w 50

# json — generic. emits frames.json with full { glyph, fg, bg } grid per frame
milli export anim.gif ./out -t json -w 50
```

flags: `-p/--package NAME` (go package name), `--no-helper` (data file only), `--no-color` (mono), `--no-bg` (transparent bg), `--bg-threshold <n>` (luma-gated transparency), `-m/--mode`, `-s/--symbols`, `-w/--width`, `-h/--height`, `--aspect`.

### using a go export (bubbletea)

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

### using a lua export (nvim)

use **[milli.nvim](https://github.com/Amansingh-afk/milli.nvim)** — drop the generated lua file in `lua/milli/splashes/` and wire it into dashboard-nvim / alpha-nvim / snacks.nvim / mini.starter / raw `VimEnter`. handles extmarks, highlight groups, animation loop.

standalone (no plugin): generate with `milli export -t lua ...` — produces `frames.lua` + `init.lua` driver. put on nvim runtime path and require.

## library

```ts
import { AsciiPlayer } from '@amansingh-afk/milli';

const p = await AsciiPlayer.load('./logo.milli');
await p.play({ loop: true, fps: 30 });

// or drive yourself:
const ansi = p.renderAnsiAt(Date.now() - t0);
process.stdout.write(ansi);

// or pull raw cells:
const grid = p.frame(0); // grid[y][x] = { glyph, fg, bg }
```

## .milli format

gzipped json. keyframes + delta frames (only changed cells per frame, 40% threshold). glyph dedupe table. version 2.

playback needs only the core engine — no image decoder at runtime.

## status

- [x] match mode (glyph-aware, sobel-weighted)
- [x] ramp mode + floyd-steinberg dither
- [x] braille mode
- [x] gif playback
- [x] `.milli` v2 with delta frames
- [x] diff-render for ssh
- [x] export to go / lua / json
- [x] `milli.nvim` (sibling plugin)
- [ ] video (mp4 → ascii)

## non-goals

- not a terminal image protocol (sixel/kitty/iterm2) — those draw pixels, we draw glyphs.
- not a tui framework — use ink / blessed / bubbletea. milli is a widget.
- no streaming / webcam. offline clips only.

## license

mit.
