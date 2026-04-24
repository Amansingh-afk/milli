import type { ConvertResult } from '../lib/convert';

export function HUD({ result }: { result: ConvertResult }) {
  const totalMs = result.delays.reduce((a, b) => a + b, 0);
  const rows: [string, string][] = [
    ['SRC', result.source.name],
    ['SRC_SIZE', fmtBytes(result.source.bytes)],
    ['DIMS', `${result.width} × ${result.height}`],
    ['FRAMES', String(result.grids.length)],
    ['DUR', totalMs > 0 ? `${(totalMs / 1000).toFixed(2)}s` : '-'],
    ['MILLI_SIZE', fmtBytes(result.millBytes)],
    ['RATIO', result.source.bytes ? `${((result.millBytes / result.source.bytes) * 100).toFixed(1)}%` : '-'],
    ['LOOP', result.loop ? 'YES' : 'NO'],
  ];
  return (
    <aside className="hud">
      <div className="hud__title">// SYSTEM</div>
      <div className="hud__grid">
        {rows.map(([k, v]) => (
          <div key={k} className="hud__row">
            <span className="hud__k">{k}</span>
            <span className="hud__dot" />
            <span className="hud__v">{v}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
