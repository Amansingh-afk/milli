import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Dropzone } from '../components/Dropzone';
import { Player } from '../components/Player';
import { HUD } from '../components/HUD';
import { Footer } from '../components/Footer';
import { Tune } from '../components/Tune';
import { Export } from '../components/Export';
import type { RenderMode } from '@amansingh-afk/milli/web';
import { convertFile, type ConvertResult } from '../lib/convert';
import { loadShowcase } from '../lib/showcase';

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; phase: string; pct: number }
  | { kind: 'ready'; result: ConvertResult }
  | { kind: 'error'; message: string };

export function Create() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [width, setWidth] = useState(120);
  const [mode, setMode] = useState<RenderMode>('match');
  const [color, setColor] = useState(true);
  const [bgThreshold, setBgThreshold] = useState(0);
  const [retuneProgress, setRetuneProgress] = useState<{ phase: string; pct: number } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setStatus({ kind: 'working', phase: 'DECODING', pct: 0 });
      try {
        const result = await convertFile(file, {
          width,
          mode,
          signal: ac.signal,
          onProgress: (phase, pct) => setStatus({ kind: 'working', phase, pct }),
        });
        if (ac.signal.aborted) return;
        setStatus({ kind: 'ready', result });
      } catch (e) {
        if (ac.signal.aborted) return;
        setStatus({ kind: 'error', message: (e as Error).message });
      }
    },
    [width, mode],
  );

  const handleRetune = useCallback(
    async (opts: { width: number; mode: RenderMode }) => {
      if (status.kind !== 'ready' || !status.result.retune) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setRetuneProgress({ phase: 'MATCHING', pct: 0 });
      try {
        const next = await status.result.retune({
          width: opts.width,
          mode: opts.mode,
          signal: ac.signal,
          onProgress: (phase, pct) => {
            if (!ac.signal.aborted) setRetuneProgress({ phase, pct });
          },
        });
        if (ac.signal.aborted) return;
        setWidth(opts.width);
        setMode(opts.mode);
        setStatus({ kind: 'ready', result: next });
      } catch (e) {
        if (ac.signal.aborted) return;
        setStatus({ kind: 'error', message: (e as Error).message });
      } finally {
        setRetuneProgress(null);
      }
    },
    [status],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus({ kind: 'idle' });
    if (params.get('showcase')) {
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // preload showcase entry from query param
  useEffect(() => {
    const name = params.get('showcase');
    if (!name) return;
    let cancelled = false;
    setStatus({ kind: 'working', phase: 'LOADING', pct: 0 });
    loadShowcase(`/showcase/${name}.milli`)
      .then((result) => {
        if (cancelled) return;
        setStatus({ kind: 'ready', result });
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus({ kind: 'error', message: (e as Error).message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="shell shell--create">
      <div className="scanlines" aria-hidden />
      <div className="noise" aria-hidden />

      <nav className="topnav">
        <Link to="/" className="topnav__back">[ ◂ back ]</Link>
        <span className="topnav__brand">milli :: create</span>
        <a
          href="https://github.com/Amansingh-afk/milli"
          target="_blank"
          rel="noopener"
          className="topnav__link"
        >
          [ github ]
        </a>
      </nav>

      <main className="main main--create">
        {status.kind === 'idle' && (
          <Dropzone
            onFile={handleFile}
            width={width}
            setWidth={setWidth}
            mode={mode}
            setMode={setMode}
            color={color}
            setColor={setColor}
          />
        )}

        {status.kind === 'working' && (
          <div className="working">
            <pre className="working__banner">{bannerFor(status.phase)}</pre>
            <div className="working__phase">{status.phase}</div>
            <div className="working__bar">
              <div className="working__bar-fill" style={{ width: `${status.pct * 100}%` }} />
            </div>
            <div className="working__pct">{Math.round(status.pct * 100)}%</div>
            <button className="btn btn--ghost" onClick={reset}>
              [ ABORT ]
            </button>
          </div>
        )}

        {status.kind === 'ready' && (
          <div className="ready">
            <Player
              result={status.result}
              color={color}
              bgThreshold={bgThreshold}
              overlay={retuneProgress}
            />
            <HUD result={status.result} />
            <Tune
              result={status.result}
              color={color}
              setColor={setColor}
              bgThreshold={bgThreshold}
              setBgThreshold={setBgThreshold}
              onRetune={handleRetune}
              busy={!!retuneProgress}
            />
            <Export result={status.result} color={color} bgThreshold={bgThreshold} />
            <div className="ready__actions">
              <button className="btn" onClick={reset}>
                [ NEW FILE ]
              </button>
            </div>
          </div>
        )}

        {status.kind === 'error' && (
          <div className="error">
            <div className="error__title">:: FATAL ::</div>
            <div className="error__msg">{status.message}</div>
            <button className="btn" onClick={reset}>
              [ RETRY ]
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function bannerFor(phase: string): string {
  const pad = phase.padEnd(12);
  return [
    '╔══════════════════════════╗',
    `║  ${pad}          ║`,
    '╚══════════════════════════╝',
  ].join('\n');
}
