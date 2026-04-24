import { useEffect, useMemo, useRef, useState } from 'react';
import { cellsToCanvas, measureCanvas } from 'milli/web';
import type { ConvertResult } from '../lib/convert';

export interface PlayerProps {
  result: ConvertResult;
  color: boolean;
  bgThreshold: number;
  overlay?: { phase: string; pct: number } | null;
}

export function Player({ result, color, bgThreshold, overlay }: PlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [scale, setScale] = useState(1);

  const metrics = useMemo(
    () => measureCanvas(result.grids[0]!, { cellWidth: 8, cellHeight: 16 }),
    [result],
  );

  useEffect(() => {
    setFrameIdx((i) => Math.min(i, result.grids.length - 1));
  }, [result]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = metrics.pixelWidth;
    canvas.height = metrics.pixelHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    cellsToCanvas(result.grids[frameIdx]!, ctx, {
      cellWidth: 8,
      cellHeight: 16,
      color,
      background: true,
      bgThreshold,
    });
  }, [frameIdx, result, metrics, color, bgThreshold]);

  useEffect(() => {
    if (paused || result.grids.length <= 1) return;
    let cancelled = false;
    let t: number;
    const tick = (i: number) => {
      if (cancelled) return;
      const delay = result.delays[i] || 100;
      t = window.setTimeout(() => {
        const next = (i + 1) % result.grids.length;
        setFrameIdx(next);
        tick(next);
      }, delay);
    };
    tick(frameIdx);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [paused, result, frameIdx]);

  return (
    <section className="player">
      <div className="player__screen">
        <div className="player__frame">
          <canvas
            ref={canvasRef}
            className="player__canvas"
            style={{
              width: metrics.pixelWidth * scale,
              height: metrics.pixelHeight * scale,
              imageRendering: 'pixelated',
            }}
          />
          {overlay && (
            <div className="player__overlay">
              <div className="player__overlay-phase">:: {overlay.phase} ::</div>
              <div className="player__overlay-bar">
                <div
                  className="player__overlay-bar-fill"
                  style={{ width: `${overlay.pct * 100}%` }}
                />
              </div>
              <div className="player__overlay-pct">{Math.round(overlay.pct * 100)}%</div>
            </div>
          )}
        </div>
      </div>

      <div className="player__controls">
        <button className="btn" onClick={() => setPaused((p) => !p)}>
          {paused ? '[ ▶  PLAY ]' : '[ ‖  PAUSE ]'}
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => setFrameIdx((i) => (i - 1 + result.grids.length) % result.grids.length)}
          disabled={!paused}
        >
          [ ◀ ]
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => setFrameIdx((i) => (i + 1) % result.grids.length)}
          disabled={!paused}
        >
          [ ▶ ]
        </button>
        <div className="spacer" />
        <label className="controls__label">ZOOM</label>
        <button className={`seg ${scale === 1 ? 'seg--on' : ''}`} onClick={() => setScale(1)}>
          1×
        </button>
        <button className={`seg ${scale === 2 ? 'seg--on' : ''}`} onClick={() => setScale(2)}>
          2×
        </button>
      </div>

      <div className="player__scrub">
        <input
          type="range"
          min={0}
          max={result.grids.length - 1}
          value={frameIdx}
          onChange={(e) => {
            setPaused(true);
            setFrameIdx(+e.target.value);
          }}
          disabled={result.grids.length <= 1}
          className="scrub"
        />
        <span className="scrub__label">
          {String(frameIdx + 1).padStart(3, '0')} / {String(result.grids.length).padStart(3, '0')}
        </span>
      </div>
    </section>
  );
}
