import { useState } from 'react';
import type { ConvertResult } from '../lib/convert';
import { buildExport, downloadBundle, type ExportTarget } from '../lib/export';

const TARGETS: Array<{ id: ExportTarget; label: string; hint: string }> = [
  { id: 'milli', label: '.milli', hint: 'binary for milli play' },
  { id: 'ansi', label: 'ansi .ans', hint: 'raw terminal escape codes' },
  { id: 'json', label: '.json', hint: 'per-cell glyph + rgb' },
  { id: 'lua', label: 'lua .zip', hint: 'nvim splash (frames + init)' },
  { id: 'go', label: 'go .zip', hint: 'bubbletea splash (frames + helper)' },
];

export interface ExportProps {
  result: ConvertResult;
  color: boolean;
  bgThreshold: number;
}

export function Export({ result, color, bgThreshold }: ExportProps) {
  const [target, setTarget] = useState<ExportTarget>('milli');
  const [busy, setBusy] = useState(false);

  const baseName = result.source.name.replace(/\.[^.]+$/, '') || 'milli';

  const onDownload = async () => {
    setBusy(true);
    try {
      const bundle = await buildExport(target, result, {
        color,
        backgroundThreshold: bgThreshold,
        baseName,
      });
      downloadBundle(bundle);
    } finally {
      setBusy(false);
    }
  };

  const current = TARGETS.find((t) => t.id === target)!;

  return (
    <section className="export">
      <div className="export__title">// EXPORT</div>
      <div className="export__row">
        <label className="controls__label">TARGET</label>
        <select
          className="export__select"
          value={target}
          onChange={(e) => setTarget(e.target.value as ExportTarget)}
          disabled={busy}
        >
          {TARGETS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button className="btn" onClick={onDownload} disabled={busy}>
          {busy ? '[ …BUILDING ]' : '[ ⤓ DOWNLOAD ]'}
        </button>
      </div>
      <div className="export__hint">{current.hint}</div>
    </section>
  );
}
