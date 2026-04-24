import { useEffect, useRef, useState } from 'react';
import { cellsToCanvas, measureCanvas } from 'milli/web';
import { loadShowcase, type ShowcaseEntry } from '../lib/showcase';
import type { ConvertResult } from '../lib/convert';

const ENTRIES: ShowcaseEntry[] = [
  { file: 'fire.milli', label: 'fire' },
  { file: 'test3.milli', label: 'test3' },
  { file: 'test5.milli', label: 'test5' },
  { file: 'test6.milli', label: 'test6' },
  { file: 'test7.milli', label: 'test7' },
  { file: 'tet7.milli', label: 'tet7' },
  { file: 'test8.milli', label: 'test8' },
  { file: 'tesst10.milli', label: 'tesst10' },
  { file: 'test12.milli', label: 'test12' },
  { file: 'test13.milli', label: 'test13' },
  { file: 'test15.milli', label: 'test15' },
  { file: 'test16.milli', label: 'test16' },
  { file: 'test17.milli', label: 'test17' },
  { file: 'test26.milli', label: 'test26' },
  { file: 'test27.milli', label: 'test27' },
  { file: 'test28.milli', label: 'test28' },
  { file: 'test29.milli', label: 'test29' },
  { file: 'test31.milli', label: 'test31' },
  { file: 'test37.milli', label: 'test37' },
  { file: 'test38.milli', label: 'test38' },
];

const THUMB_CELL = 5;
const THUMB_CELL_H = 10;

export interface ShowcaseProps {
  onPick: (result: ConvertResult) => void;
}

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

function ShowcaseTile({ entry, onPick }: { entry: ShowcaseEntry; onPick: (r: ConvertResult) => void }) {
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
      onClick={() => resultRef.current && onPick(resultRef.current)}
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
