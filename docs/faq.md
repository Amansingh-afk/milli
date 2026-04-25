# FAQ

**Is it fast?**
Yes. The match-mode glyph search uses a pre-baked font atlas and sobel-weighted MSE over small regions. Decoding a 400×400 GIF at 80×32 cells runs at ~60fps on a laptop. Playback from `.milli` is essentially free — it's just pre-rendered ANSI strings with diff-based output.

**Why does my output look stretched?**
Terminal cells are usually ~2:1 tall vs wide. Default `--aspect 0.5` compensates. If your font is different, override: `--aspect 0.45` (wider glyphs) or `--aspect 0.55` (narrower).

**How do I get a transparent background in Neovim?**
Use `--no-bg` on export: `milli export anim.gif ./out -t lua --no-bg`. Or `--bg-threshold 0.3` to drop only dark backgrounds (luma-gated).

**Why don't my colors look right?**
Make sure your terminal supports truecolor — check with `echo $COLORTERM` (should print `truecolor`). Fallback: `--no-color` for ASCII-only output.

**Can I use this in a browser?**
Yes — import from `@amansingh-afk/milli/web` for a Node-free browser bundle (decoder + frame-to-grid). The web playground at [milli-five.vercel.app](https://milli-five.vercel.app/) uses it. Conversion (image / GIF → ASCII) still requires the full Node-side `sharp` pipeline; the browser bundle is decode + render only.

**What's the difference between `milli play anim.gif` and `milli play anim.milli`?**
`.gif` decodes + renders frames on startup (1-3s for a big GIF). `.milli` is pre-baked and plays instantly.

**Where does the font atlas come from?**
JetBrainsMono at 8×16. Regenerate with `npx tsx scripts/build-atlas.ts` if you want a different font — then rebuild.

**Can I customize the ASCII ramp characters?**
Use `-s block` (`" ░▒▓█"`) or `-s braille` (`" ⠁⠃⠇⠏⠟⠿⣿"`) or `-s all` (unified dense set). Custom ramps are a roadmap item.

**How do I know it looks right before committing?**
Pipe to `less -R`: `milli image pic.png -w 80 | less -R`. Or for animation, preview in your terminal — alt-screen restores cleanly on exit.

**My terminal scrolls / breaks during inline play.**
`--inline` mode positions cursor absolutely — if the baked frame is larger than your terminal it'll clip (with a stderr warning). Re-bake at smaller dimensions (`milli convert ... -w 50`) for compositional use cases like animated fastfetch.
