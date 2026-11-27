import { parseTable, textToRows, type FallbackTs } from './parser';
import type { ParseResult } from '../types';

export type SheetUrlKind = 'sheet-share' | 'sheet-published' | 'apps-script' | 'generic';

export interface ResolvedSheetUrl {
  kind: SheetUrlKind;
  url: string;
  label: string;
}

/**
 * Converts any supported Google Sheets URL into a fetchable endpoint:
 *  - `/spreadsheets/d/{ID}/edit#gid=N`   → `/export?format=csv&gid=N`
 *  - `/spreadsheets/d/e/{PUBID}/pub…`    → `/pub?output=csv`
 *  - `script.google.com/macros/s/…/exec` → used as-is (JSON)
 */
export function resolveSheetUrl(input: string): ResolvedSheetUrl | null {
  const raw = input.trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;

  if (u.hostname === 'docs.google.com') {
    const pub = u.pathname.match(/^\/spreadsheets\/d\/e\/([^/]+)\/pub/);
    if (pub) {
      const out = new URL(`https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub`);
      const gid = u.searchParams.get('gid');
      if (gid) out.searchParams.set('gid', gid);
      const single = u.searchParams.get('single');
      if (single) out.searchParams.set('single', single);
      out.searchParams.set('output', 'csv');
      return { kind: 'sheet-published', url: out.toString(), label: 'Published CSV' };
    }
    const m = u.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (m && m[1] !== 'e') {
      const hashGid = u.hash.match(/gid=(\d+)/)?.[1];
      const gid = u.searchParams.get('gid') ?? hashGid ?? '0';
      return {
        kind: 'sheet-share',
        url: `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`,
        label: 'Google Sheets share link',
      };
    }
    return null;
  }

  if (u.hostname === 'script.google.com' || u.hostname === 'script.googleusercontent.com') {
    return { kind: 'apps-script', url: u.toString(), label: 'Apps Script Web App (JSON)' };
  }

  return { kind: 'generic', url: u.toString(), label: 'Direct CSV / JSON endpoint' };
}

export interface FetchedSheet {
  result: ParseResult;
  latencyMs: number;
}

export async function fetchSheet(url: string, fallbackTs: FallbackTs, signal?: AbortSignal): Promise<FetchedSheet> {
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', signal, redirect: 'follow' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new Error('Network or CORS failure. Check connectivity, and that the sheet is public or published (Anyone with the link).');
  }
  if (!res.ok) {
    throw new Error(
      res.status === 403 || res.status === 401
        ? `HTTP ${res.status} — access denied. Set sharing to "Anyone with the link".`
        : `HTTP ${res.status} ${res.statusText}`.trim(),
    );
  }
  const text = await res.text();
  const latencyMs = performance.now() - t0;
  const rows = textToRows(text);
  return { result: parseTable(rows, fallbackTs), latencyMs };
}

export async function parseFile(file: File, fallbackTs: FallbackTs): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
    const text = await file.text();
    return parseTable(textToRows(text), fallbackTs);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm') || name.endsWith('.ods')) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '', blankrows: true });
      const rows = aoa.map((r) =>
        r.map((c) => {
          if (c instanceof Date) {
            const p = (n: number) => String(n).padStart(2, '0');
            return `${c.getFullYear()}-${p(c.getMonth() + 1)}-${p(c.getDate())} ${p(c.getHours())}:${p(c.getMinutes())}:${p(c.getSeconds())}`;
          }
          return c === null || c === undefined ? '' : String(c);
        }),
      );
      const result = parseTable(rows, fallbackTs);
      if (result.total > 0) return result;
    }
    return parseTable([], fallbackTs);
  }
  throw new Error('Unsupported file type. Use .xlsx, .xls or .csv.');
}
