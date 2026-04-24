import React, { useEffect, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import { AsciiPlayer } from '../player-api.js';

export interface AsciiVideoProps {
  src?: string;
  player?: AsciiPlayer;
  loop?: boolean;
  fps?: number;
  color?: boolean;
  paused?: boolean;
  onEnd?: () => void;
}

export function AsciiVideo(props: AsciiVideoProps): React.ReactElement | null {
  const [player, setPlayer] = useState<AsciiPlayer | null>(props.player ?? null);
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (props.player) {
      setPlayer(props.player);
      return;
    }
    if (!props.src) return;
    let cancelled = false;
    AsciiPlayer.load(props.src).then((p) => {
      if (!cancelled) setPlayer(p);
    });
    return () => { cancelled = true; };
  }, [props.src, props.player]);

  const lastTickRef = useRef<number>(Date.now());
  useEffect(() => {
    if (!player || props.paused) return;

    let cancelled = false;
    const loop = props.loop ?? player.loop;
    const fixedDelay = props.fps ? Math.round(1000 / props.fps) : null;

    const scheduleNext = (i: number) => {
      if (cancelled) return;
      const delay = fixedDelay ?? player.frameDelay(i) ?? 100;
      const timeout = setTimeout(() => {
        if (cancelled) return;
        const next = i + 1;
        if (next >= player.frameCount) {
          if (loop) {
            setFrameIdx(0);
            scheduleNext(0);
          } else {
            props.onEnd?.();
          }
        } else {
          setFrameIdx(next);
          scheduleNext(next);
        }
      }, delay);
      lastTickRef.current = Date.now() + delay;
      return () => clearTimeout(timeout);
    };

    let cleanup: (() => void) | undefined;
    cleanup = scheduleNext(frameIdx);
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [player, props.paused, props.loop, props.fps]);

  if (!player) return null;

  const ansi = player.renderAnsi(frameIdx, props.color ?? true);
  return (
    <Box flexDirection="column" height={player.height} width={player.width}>
      <Text>{ansi}</Text>
    </Box>
  );
}
