import { useEffect, useRef, useState } from 'react';
import { decodeMilli, frameToGrid, cellsToCanvas, measureCanvas } from '@amansingh-afk/milli/web';
import type { CellGrid } from '@amansingh-afk/milli/web';

interface Loaded {
  grids: CellGrid[];
  delays: number[];
  loop: boolean;
  metrics: { pixelWidth: number; pixelHeight: number };
}

export function AsciiBackground({ src = '/jellyfish.milli' }: { src?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(src);
        if (!resp.ok) return;
        const buf = new Uint8Array(await resp.arrayBuffer());
        const file = decodeMilli(buf);
        const grids = file.frames.map((_, i) => frameToGrid(file, i));
        const metrics = measureCanvas(grids[0]!, { cellWidth: 8, cellHeight: 16 });
        if (cancelled) return;
        setData({
          grids,
          delays: file.frames.map((f) => f.delay),
          loop: file.loop,
          metrics,
        });
      } catch {
        // background is decorative; swallow failures silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (!data) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    canvas.width = data.metrics.pixelWidth;
    canvas.height = data.metrics.pixelHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    let timer: number | null = null;
    let i = 0;
    let visible = true;

    const drawCurrent = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cellsToCanvas(data.grids[i]!, ctx, {
        cellWidth: 8,
        cellHeight: 16,
        color: true,
        background: true,
        bgThreshold: 0,
      });
    };

    const tick = () => {
      if (cancelled || !visible) return;
      drawCurrent();
      const delay = data.delays[i] || 100;
      const next = i + 1;
      if (next >= data.grids.length) {
        if (!data.loop) return;
        i = 0;
      } else {
        i = next;
      }
      timer = window.setTimeout(tick, delay);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const wasVisible = visible;
        visible = entries[0]?.isIntersecting ?? false;
        if (visible && !wasVisible) {
          tick();
        } else if (!visible && timer != null) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0 },
    );
    io.observe(wrap);

    tick();

    return () => {
      cancelled = true;
      io.disconnect();
      if (timer != null) clearTimeout(timer);
    };
  }, [data]);

  return (
    <div ref={wrapRef} className="ascii-bg" aria-hidden>
      <canvas ref={canvasRef} className="ascii-bg__canvas" />
    </div>
  );
}
