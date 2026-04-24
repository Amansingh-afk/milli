import JSZip from 'jszip';
import {
  cellsToAnsi,
  emitGoData,
  emitGoHelper,
  emitJson,
  emitLuaData,
} from 'milli/web';
import type { ConvertResult } from './convert';

export type ExportTarget = 'milli' | 'ansi' | 'json' | 'lua' | 'go';

export interface ExportSettings {
  color: boolean;
  backgroundThreshold: number;
  // Used as Go package name and lua module folder label.
  baseName: string;
}

export interface ExportBundle {
  data: Blob;
  filename: string;
}

export async function buildExport(
  target: ExportTarget,
  result: ConvertResult,
  settings: ExportSettings,
): Promise<ExportBundle> {
  const { color, backgroundThreshold, baseName } = settings;
  switch (target) {
    case 'milli':
      return {
        data: new Blob([result.encode() as BlobPart], { type: 'application/octet-stream' }),
        filename: `${baseName}.milli`,
      };
    case 'ansi': {
      const txt = result.grids
        .map((g) => cellsToAnsi(g, { color, background: true, bgThreshold: backgroundThreshold }))
        .join('\n');
      return {
        data: new Blob([txt], { type: 'text/plain' }),
        filename: `${baseName}.ans`,
      };
    }
    case 'json':
      return {
        data: new Blob(
          [emitJson(result.grids, result.delays, result.width, result.height)],
          { type: 'application/json' },
        ),
        filename: `${baseName}.json`,
      };
    case 'lua': {
      const data = emitLuaData(
        result.grids,
        result.delays,
        result.width,
        result.height,
        color,
        backgroundThreshold,
      );
      const blob = new Blob([data], { type: 'text/x-lua' });
      return { data: blob, filename: `${baseName}.lua` };
    }
    case 'go': {
      const zip = new JSZip();
      const pkg = safeGoIdent(baseName);
      zip.file(
        'frames.go',
        emitGoData(result.grids, result.delays, result.width, result.height, pkg, backgroundThreshold),
      );
      zip.file('splash.go', emitGoHelper(pkg));
      const blob = await zip.generateAsync({ type: 'blob' });
      return { data: blob, filename: `${baseName}-go.zip` };
    }
  }
}

export function downloadBundle(bundle: ExportBundle): void {
  const url = URL.createObjectURL(bundle.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = bundle.filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeGoIdent(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleaned.length === 0) return 'splash';
  if (/^[0-9]/.test(cleaned)) return 'p' + cleaned;
  return cleaned;
}
