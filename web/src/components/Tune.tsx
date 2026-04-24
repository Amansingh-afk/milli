import { useEffect, useRef, useState } from 'react';
import type { RenderMode } from 'milli/web';
import type { ConvertResult } from '../lib/convert';

export interface TuneProps {
  result: ConvertResult;
  color: boolean;
  setColor: (b: boolean) => void;
  bgThreshold: number;
  setBgThreshold: (n: number) => void;
  onRetune: (opts: { width: number; mode: RenderMode }) => void;
  busy: boolean;
}

export function Tune({
  result,
  color,
  setColor,
  bgThreshold,
  setBgThreshold,
  onRetune,
  busy,
}: TuneProps) {
  const [width, setWidth] = useState(result.targetWidth);
  const [mode, setMode] = useState<RenderMode>(result.mode);
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    setWidth(result.targetWidth);
    setMode(result.mode);
  }, [result.targetWidth, result.mode]);

  const canRetune = !!result.retune;

  const fireRetune = (nextWidth: number, nextMode: RenderMode) => {
    if (!canRetune) return;
    if (nextWidth !== result.targetWidth || nextMode !== result.mode) {
      onRetune({ width: nextWidth, mode: nextMode });
    }
  };

  const scheduleWidthRetune = (nextWidth: number, nextMode: RenderMode) => {
    if (!canRetune) return;
    if (pendingRef.current) window.clearTimeout(pendingRef.current);
    pendingRef.current = window.setTimeout(() => {
      pendingRef.current = null;
      fireRetune(nextWidth, nextMode);
    }, 150);
  };

  const pickWidth = (n: number) => {
    if (!canRetune) return;
    setWidth(n);
    scheduleWidthRetune(n, mode);
  };
  const pickMode = (m: RenderMode) => {
    if (!canRetune) return;
    if (pendingRef.current) {
      window.clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }
    setMode(m);
    fireRetune(width, m);
  };

  return (
    <section className="tune">
      <div className="tune__title">
        // TUNE {busy ? '· RE-RENDERING…' : ''}
        {!canRetune && <span className="tune__locked"> · baked · width/mode locked</span>}
      </div>
      <div className="controls">
        <div className="controls__row">
          <label className="controls__label">WIDTH</label>
          <input
            type="range"
            min={40}
            max={240}
            step={4}
            value={width}
            onChange={(e) => pickWidth(+e.target.value)}
            className="controls__range"
            disabled={!canRetune}
          />
          <span className="controls__value">{width}</span>
        </div>
        <div className="controls__row">
          <label className="controls__label">MODE</label>
          <button
            className={`seg ${mode === 'match' ? 'seg--on' : ''}`}
            onClick={() => pickMode('match')}
            disabled={!canRetune}
          >
            MATCH
          </button>
          <button
            className={`seg ${mode === 'ramp' ? 'seg--on' : ''}`}
            onClick={() => pickMode('ramp')}
            disabled={!canRetune}
          >
            RAMP
          </button>
          <button
            className={`seg ${mode === 'braille' ? 'seg--on' : ''}`}
            onClick={() => pickMode('braille')}
            disabled={!canRetune}
          >
            BRAILLE
          </button>
        </div>
        <div className="controls__row">
          <label className="controls__label">BG</label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(bgThreshold * 100)}
            onChange={(e) => setBgThreshold(+e.target.value / 100)}
            className="controls__range"
          />
          <span className="controls__value">
            {bgThreshold <= 0 ? 'FULL' : bgThreshold >= 1 ? 'NONE' : Math.round(bgThreshold * 100) + '%'}
          </span>
        </div>
        <div className="controls__row">
          <label className="controls__label">COLOR</label>
          <button
            className={`seg ${color ? 'seg--on' : ''}`}
            onClick={() => setColor(!color)}
          >
            {color ? 'TRUECOLOR' : 'MONO'}
          </button>
        </div>
      </div>
    </section>
  );
}
