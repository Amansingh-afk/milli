# milli

Pixel-perfect animated ASCII art. Images, GIFs, video frames — in your terminal, in the [browser playground](https://milli-five.vercel.app/), or baked into Go / Lua / JSON for embedding in TUIs and Neovim dashboards.

![demo](demo.gif)

[![Try in Browser](https://img.shields.io/badge/▸_try_in_browser-00ffe1?style=for-the-badge&labelColor=000000)](https://milli-five.vercel.app/)
[![npm](https://img.shields.io/npm/v/@amansingh-afk/milli?style=for-the-badge&color=cb3837&labelColor=000000&label=npm)](https://www.npmjs.com/package/@amansingh-afk/milli)
[![GitHub stars](https://img.shields.io/github/stars/Amansingh-afk/milli?style=for-the-badge&logo=github&color=181717&labelColor=000000)](https://github.com/Amansingh-afk/milli)
[![License](https://img.shields.io/github/license/Amansingh-afk/milli?style=for-the-badge&labelColor=000000)](./LICENSE)

> No install. Drop an image or GIF into the [web playground](https://milli-five.vercel.app/) and grab the ASCII / `.milli` / Go / Lua / JSON output instantly. Same engine as the CLI, all browser-side.

## Install

```bash
npm install -g @amansingh-afk/milli
```

Or one-shot without install:

```bash
npx @amansingh-afk/milli image pic.png
```

Requires Node 18+ and a terminal with truecolor (`COLORTERM=truecolor`). Most modern terminals qualify.

## Quick start

```bash
# render any image to ASCII
milli image pic.png

# animated GIF in the terminal
milli play anim.gif

# bake a GIF into a fast-loading .milli file (no sharp at playback time)
milli convert anim.gif anim.milli
milli play anim.milli

# export frames as Lua for Neovim dashboards (use with milli.nvim)
milli export anim.gif ./out -t lua -w 60 --no-bg

# export frames as Go for Bubbletea splashes
milli export anim.gif ./out -t go -p bootsplash -w 50
```

## Documentation

| Doc                                | What's in it                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| **[CLI reference](./docs/cli.md)** | All commands (`image` / `play` / `convert` / `export`), flags, render modes, export targets       |
| **[Recipes](./docs/recipes.md)**   | Neovim splash, terminal screensaver, shell MOTD, tmux pane, React embed, Bubbletea, animated fastfetch |
| **[Library API](./docs/api.md)**   | Programmatic API, `.milli` format spec, supported input formats                                    |
| **[FAQ](./docs/faq.md)**           | Performance, aspect ratio, transparency, browser usage, common gotchas                             |

## How it compares to chafa

[chafa](https://hpjansson.org/chafa/) is the quality floor for "image → terminal." milli adds:

- **Pre-baked format** — `.milli` for instant playback, ship with your app
- **Source export** — Go / Lua / JSON for embedding (chafa is a binary)
- **Programmatic API** — use as a Node library
- **Browser bundle** — decode + render `.milli` in React, no Node deps
- **Neovim integration** — first-party dashboard plugin
- **Truecolor glyph matching** — match mode uses per-glyph MSE, not just dominant color per cell

If you want a one-shot terminal render and chafa is installed — chafa is great. If you want to embed ASCII animation in your product (TUI splash, nvim dashboard, animated fastfetch, dashboard widget), milli is built for that.

## Non-goals

- **Not a terminal image protocol.** Sixel, kitty, iTerm2 inline images draw pixels. milli draws glyphs.
- **Not a TUI framework.** Use ink / blessed / bubbletea / ratatui. milli is a widget.
- **No streaming / webcam.** Offline clips only.

## License

MIT.
