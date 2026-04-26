# Recipes

Real-world places to drop milli output. Examples are minimal — swap the splash file / size for your own.

- [Neovim dashboard splash](#neovim-dashboard-splash)
- [Terminal screensaver on idle](#terminal-screensaver-on-idle)
- [Shell MOTD greeting](#shell-motd-greeting)
- [tmux pane decoration](#tmux-pane-decoration)
- [React / web embed](#react--web-embed)
- [Bubbletea TUI splash](#bubbletea-tui-splash)
- [Static logo for fastfetch](#static-logo-for-fastfetch)
- [Animated logo for fastfetch](#animated-logo-for-fastfetch)

## Neovim dashboard splash

Use **[milli.nvim](https://github.com/Amansingh-afk/milli.nvim)** — the companion plugin handles paint, looping, and dashboard host wiring (dashboard-nvim, alpha-nvim, mini.starter, snacks.nvim).

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

## Terminal screensaver on idle

Bake once at fullscreen-friendly width, loop forever in a fullscreen terminal launched by your idle daemon.

```bash
milli convert your.gif ~/.config/milli/saver.milli -w 220 -m braille
```

`braille` mode is mono-per-cell with no background, so it overlays cleanly on any terminal theme. Bump `-w` until the rendered ASCII fills your screen at your terminal's font size.

### Wayland + Hyprland (hypridle)

`~/.config/hypr/hypridle.conf`:

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

### Wayland + sway / wlroots (swayidle)

```bash
swayidle -w timeout 300 'alacritty --class milli-saver -e milli play ~/.config/milli/saver.milli'
```

### X11 + xscreensaver

In `~/.xscreensaver`, `programs:`:

```
"milli"  xterm -fullscreen -e milli play ~/.config/milli/saver.milli  \n\
```

### X11 + plain idle poll

`xprintidle` + bash loop:

```bash
while true; do
  if [ "$(xprintidle)" -gt 300000 ]; then
    kitty --start-as fullscreen -e milli play ~/.config/milli/saver.milli
  fi
  sleep 5
done
```

### macOS

No native terminal-screensaver hook. Use Hammerspoon (or similar) watching idle and launching iTerm / kitty fullscreen with `milli play`.

> Tip: kitty / wezterm / alacritty with a fullscreen flag give a borderless canvas. ASCII looks much better with a tight cell-padded font.

## Shell MOTD greeting

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

## tmux pane decoration

Decorate a pane with a looping splash while you work in another.

```bash
# ~/.tmux.conf
bind-key M-m split-window -h -p 30 'milli play ~/.config/milli/decor.milli'
```

`Prefix + Alt-m` opens a 30%-wide pane on the right running the splash. Resize with prefix arrows; closing the pane stops playback.

## React / web embed

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

## Bubbletea TUI splash

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

The generated `splash.go` ships `Tick`, `Render`, `TickMsg`, `DoneMsg` — no extra dependency on milli at runtime.

## Static logo for fastfetch

A single rendered frame as the fastfetch logo. For animation, see [the next recipe](#animated-logo-for-fastfetch).

```bash
# render any image as a colored ASCII logo (40 cols is a good fastfetch fit)
milli image logo.png -w 40 -m match > ~/.config/fastfetch/logo.txt
```

`match` mode preserves source colors per cell (best for logos with brand colors). For a flatter look, use `-m ramp` (luminance to ASCII chars, no per-cell bg).

In `~/.config/fastfetch/config.jsonc`, swap your existing `"logo"` block (typically `"type": "auto"`) with:

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

## Animated logo for fastfetch

`milli fastfetch` (added in 0.0.6) composes static fastfetch info with a looping milli animation in the logo region. One command, no shell wrapper, no manually-sized blank-logo file.

![fastfetch-jellyfish](https://raw.githubusercontent.com/Amansingh-afk/milli/media/fastfetch-jellyfish.gif)

Try it instantly with the bundled samples (`fire` and `jellyfish` ship with the npm package):

```bash
# --no-bg makes look animation cleaner. you can skip it if you want. 
milli fastfetch jellyfish --no-bg
milli fastfetch fire --no-bg
```

![fastfetch-fire](https://raw.githubusercontent.com/Amansingh-afk/milli/media/fastfetch-fire.gif)

Use your own animation by baking a `.milli` first:

```bash
# 1. bake a small .milli (50 cols × 18 rows is a good size)
milli convert clip.gif ~/.config/milli/anim.milli -w 50 -m match

# 2. run
milli fastfetch ~/.config/milli/anim.milli
```

Fastfetch prints info on the right and exits. milli loops the animation in the reserved logo column via inline paint (no alt-screen, no scroll). Ctrl+C exits and the cursor lands below.

To make it your default fastfetch, alias in your shell rc:

```bash
# ~/.zshrc / ~/.bashrc
alias fastfetch='milli fastfetch ~/.config/milli/anim.milli'
```

Use `command fastfetch` (or `\fastfetch`) when you want the real one-shot fastfetch.

**Optional flags:**

- `--at x,y` — inline anchor (default `3,2`, matches fastfetch padding `top:1 left:2`)
- `--ff-args "..."` — passthrough to fastfetch, e.g. `--ff-args "--config minimal.jsonc"`

Resize your terminal to fit — frames clip with a stderr warning if smaller than baked dimensions.
