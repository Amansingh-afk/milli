import { useEffect, useRef, useState } from 'react';
import { cellsToCanvas, measureCanvas } from '@amansingh-afk/milli/web';
import { loadShowcase, type ShowcaseEntry } from '../lib/showcase';
import type { ConvertResult } from '../lib/convert';

export interface ShowcaseProps {
  onPick: (name: string) => void;
}

const ENTRIES: ShowcaseEntry[] = [
  { file: 'jellyfish.milli', label: 'jellyfish' },
  { file: 'fire.milli', label: 'fire' },
  { file: 'nebula.milli', label: 'nebula' },
  { file: 'glitch.milli', label: 'glitch' },
  { file: 'vapor.milli', label: 'vapor' },
  { file: 'drift.milli', label: 'drift' },
  { file: 'pulse.milli', label: 'pulse' },
  { file: 'neon.milli', label: 'neon' },
  { file: 'signal.milli', label: 'signal' },
  { file: 'void.milli', label: 'void' },
  { file: 'ghost.milli', label: 'ghost' },
  { file: 'scan.milli', label: 'scan' },
  { file: 'orbit.milli', label: 'orbit' },
  { file: 'prism.milli', label: 'prism' },
  { file: 'comet.milli', label: 'comet' },
  { file: 'flux.milli', label: 'flux' },
  { file: 'echo.milli', label: 'echo' },
  { file: 'aurora.milli', label: 'aurora' },
  { file: 'static.milli', label: 'static' },
  { file: 'chrome.milli', label: 'chrome' },
  { file: 'matrix.milli', label: 'matrix' },
];

const THUMB_CELL = 5;
const THUMB_CELL_H = 10;

export function Showcase({ onPick }: ShowcaseProps) {
  return (
    <section className="showcase">
      <div className="showcase__title">// SHOWCASE · click to load</div>
      <div className="showcase__grid">
        {ENTRIES.map((e) => (
          <ShowcaseTile key={e.file} entry={e} onPick={onPick} />
        ))}
      </div>
    </section>
  );
}

function ShowcaseTile({ entry, onPick }: { entry: ShowcaseEntry; onPick: (name: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const resultRef = useRef<ConvertResult | null>(null);
  const tileRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state !== 'idle') return;
    const el = tileRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const obs of entries) {
          if (obs.isIntersecting) {
            io.disconnect();
            setState('loading');
            loadShowcase(`/showcase/${entry.file}`)
              .then((r) => {
                resultRef.current = r;
                setState('ready');
                paint(r);
              })
              .catch(() => setState('error'));
          }
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [entry.file, state]);

  function paint(r: ConvertResult) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { pixelWidth, pixelHeight } = measureCanvas(r.grids[0]!, {
      cellWidth: THUMB_CELL,
      cellHeight: THUMB_CELL_H,
    });
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    cellsToCanvas(r.grids[0]!, ctx, {
      cellWidth: THUMB_CELL,
      cellHeight: THUMB_CELL_H,
      color: true,
      background: true,
    });
  }

  const kb = resultRef.current ? (resultRef.current.millBytes / 1024).toFixed(0) : '';
  const frames = resultRef.current ? resultRef.current.grids.length : 0;
  const dims = resultRef.current
    ? `${resultRef.current.width}×${resultRef.current.height}`
    : '';

  return (
    <button
      ref={tileRef}
      className={`showcase__tile showcase__tile--${state}`}
      onClick={() => resultRef.current && onPick(entry.label)}
      disabled={state !== 'ready'}
      title={`${entry.label}${dims ? ' · ' + dims : ''}${frames ? ' · ' + frames + 'f' : ''}${kb ? ' · ' + kb + 'KB' : ''}`}
    >
      <div className="showcase__frame">
        <canvas ref={canvasRef} className="showcase__canvas" />
        {state === 'loading' && <div className="showcase__status">::  LOADING  ::</div>}
        {state === 'error' && <div className="showcase__status">:: MISSING ::</div>}
        {state === 'idle' && <div className="showcase__status">· · ·</div>}
      </div>
      <div className="showcase__label">
        <span>{entry.label}</span>
        {state === 'ready' && <span className="showcase__meta">{frames}f · {kb}KB</span>}
      </div>
    </button>
  );
}
