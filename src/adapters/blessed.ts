import blessed from 'blessed';
import { AsciiPlayer } from '../player-api.js';

export interface AsciiVideoWidgetOptions {
  parent?: blessed.Widgets.Node;
  screen?: blessed.Widgets.Screen;
  src?: string;
  player?: AsciiPlayer;
  top?: number | string;
  left?: number | string;
  loop?: boolean;
  fps?: number;
  color?: boolean;
  autoplay?: boolean;
  onEnd?: () => void;
}

export interface AsciiVideoWidget {
  box: blessed.Widgets.BoxElement;
  player: AsciiPlayer | null;
  play: () => void;
  pause: () => void;
  seek: (frameIdx: number) => void;
  destroy: () => void;
}

export async function asciiVideoWidget(opts: AsciiVideoWidgetOptions): Promise<AsciiVideoWidget> {
  const player = opts.player ?? (opts.src ? await AsciiPlayer.load(opts.src) : null);
  if (!player) throw new Error('asciiVideoWidget: pass src or player');

  const box = blessed.box({
    parent: opts.parent,
    top: opts.top ?? 0,
    left: opts.left ?? 0,
    width: player.width,
    height: player.height,
    tags: false,
    style: { bg: 'black' },
  });

  let frameIdx = 0;
  let timer: NodeJS.Timeout | null = null;
  let playing = false;
  let destroyed = false;

  const color = opts.color ?? true;
  const loopFlag = opts.loop ?? player.loop;

  const paint = () => {
    box.setContent(player.renderAnsi(frameIdx, color));
    const screen = opts.screen ?? (box.screen as blessed.Widgets.Screen | undefined);
    screen?.render();
  };

  const tick = () => {
    if (destroyed || !playing) return;
    const fixedDelay = opts.fps ? Math.round(1000 / opts.fps) : null;
    const delay = fixedDelay ?? player.frameDelay(frameIdx) ?? 100;
    timer = setTimeout(() => {
      const next = frameIdx + 1;
      if (next >= player.frameCount) {
        if (loopFlag) {
          frameIdx = 0;
          paint();
          tick();
        } else {
          playing = false;
          opts.onEnd?.();
        }
      } else {
        frameIdx = next;
        paint();
        tick();
      }
    }, delay);
  };

  const api: AsciiVideoWidget = {
    box,
    player,
    play: () => {
      if (playing || destroyed) return;
      playing = true;
      paint();
      tick();
    },
    pause: () => {
      playing = false;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    seek: (i: number) => {
      frameIdx = Math.max(0, Math.min(player.frameCount - 1, i));
      paint();
    },
    destroy: () => {
      destroyed = true;
      playing = false;
      if (timer) clearTimeout(timer);
      box.destroy();
    },
  };

  paint();
  if (opts.autoplay !== false) api.play();

  return api;
}
