import { useCallback, useRef, useState } from 'react';
import type { RenderMode } from 'milli/web';

export interface DropzoneProps {
  onFile: (file: File) => void;
  width: number;
  setWidth: (n: number) => void;
  mode: RenderMode;
  setMode: (m: RenderMode) => void;
  color: boolean;
  setColor: (b: boolean) => void;
}

export function Dropzone(props: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback(() => inputRef.current?.click(), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) props.onFile(f);
    },
    [props],
  );

  return (
    <section className="drop">
      <div
        className={`drop__zone ${dragging ? 'drop__zone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={pick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pick()}
      >
        <div className="drop__corner drop__corner--tl">╔</div>
        <div className="drop__corner drop__corner--tr">╗</div>
        <div className="drop__corner drop__corner--bl">╚</div>
        <div className="drop__corner drop__corner--br">╝</div>

        <div className="drop__inner">
          <div className="drop__glyph">
            {dragging ? '▼ RELEASE ▼' : '┌─  DROP  ─┐'}
          </div>
          <div className="drop__help">
            drag image · gif · or <span className="drop__link">click to browse</span>
          </div>
          <div className="drop__formats">PNG · JPG · WEBP · GIF</div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) props.onFile(f);
          }}
          style={{ display: 'none' }}
        />
      </div>

      <div className="controls">
        <div className="controls__row">
          <label className="controls__label">WIDTH</label>
          <input
            type="range"
            min={40}
            max={240}
            step={4}
            value={props.width}
            onChange={(e) => props.setWidth(+e.target.value)}
            className="controls__range"
          />
          <span className="controls__value">{props.width}</span>
        </div>
        <div className="controls__row">
          <label className="controls__label">MODE</label>
          <button
            className={`seg ${props.mode === 'match' ? 'seg--on' : ''}`}
            onClick={() => props.setMode('match')}
          >
            MATCH
          </button>
          <button
            className={`seg ${props.mode === 'ramp' ? 'seg--on' : ''}`}
            onClick={() => props.setMode('ramp')}
          >
            RAMP
          </button>
          <button
            className={`seg ${props.mode === 'braille' ? 'seg--on' : ''}`}
            onClick={() => props.setMode('braille')}
          >
            BRAILLE
          </button>
        </div>
        <div className="controls__row">
          <label className="controls__label">COLOR</label>
          <button
            className={`seg ${props.color ? 'seg--on' : ''}`}
            onClick={() => props.setColor(!props.color)}
          >
            {props.color ? 'TRUECOLOR' : 'MONO'}
          </button>
        </div>
      </div>
    </section>
  );
}
