import Papa from 'papaparse';
import type { LogEntry, PacketStatus, ParseResult, Packet } from '../types';

/* -------------------------------------------------------------------------- */
/*  Column mapping                                                            */
/* -------------------------------------------------------------------------- */

type Field = 'id' | 'lat' | 'lon' | 'alt' | 'temp' | 'status' | 'rssi' | 'snr' | 'ts' | 'battery' | 'raw';

const SYNONYMS: Record<Field, string[]> = {
  id: ['id', 'device', 'deviceid', 'iddevice', 'idperangkat', 'pendaki', 'hiker', 'node', 'nodeid', 'devid'],
  lat: ['lat', 'latitude', 'latitud', 'lintang'],
  lon: ['lon', 'lng', 'long', 'longitude', 'bujur'],
  alt: ['mdpl', 'altitude', 'alt', 'elevasi', 'elevation', 'ketinggian', 'ele'],
  temp: ['suhu', 'temp', 'temperature', 'temperatur', 'suhuc', 'tempc'],
  status: ['status', 'kondisi'],
  rssi: ['rssi'],
  snr: ['snr'],
  ts: ['timestamp', 'waktu', 'time', 'datetime', 'tanggal', 'date', 'tgl', 'receivedat', 'waktuterima'],
  battery: ['battery', 'baterai', 'batt', 'bat', 'batre', 'vbat'],
  raw: ['isidata', 'data', 'payload', 'raw', 'rawdata', 'message', 'pesan', 'packet', 'lora', 'isi'],
};

const HEADER_LOOKUP = new Map<string, Field>();
for (const [field, names] of Object.entries(SYNONYMS) as [Field, string[]][]) {
  for (const n of names) HEADER_LOOKUP.set(n, field);
}

const FIELD_LABEL: Record<Field, string> = {
  id: 'ID',
  lat: 'Lat',
  lon: 'Lon',
  alt: 'MDPL',
  temp: 'Temp',
  status: 'Status',
  rssi: 'RSSI',
  snr: 'SNR',
  ts: 'Timestamp',
  battery: 'Battery',
  raw: 'Raw payload',
};

interface ColMap {
  single: Partial<Record<Exclude<Field, 'ts'>, number>>;
  ts: number[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function mapHeader(cells: string[]): { map: ColMap; recognised: Set<Field>; labels: string[] } {
  const map: ColMap = { single: {}, ts: [] };
  const recognised = new Set<Field>();
  const labels: string[] = [];
  cells.forEach((cell, idx) => {
    const key = norm(cell);
    if (!key || /^-?\d/.test(key)) return;
    const field = HEADER_LOOKUP.get(key);
    if (!field) return;
    if (field === 'ts') {
      map.ts.push(idx);
      recognised.add(field);
      labels.push(`${FIELD_LABEL.ts} ← ${cell.trim()}`);
      return;
    }
    if (map.single[field] !== undefined) return;
    map.single[field] = idx;
    recognised.add(field);
    labels.push(`${FIELD_LABEL[field]} ← ${cell.trim()}`);
  });
  return { map, recognised, labels };
}

const POSITIONAL: ColMap = {
  single: { id: 0, lat: 1, lon: 2, alt: 3, temp: 4, status: 5, rssi: 6, snr: 7 },
  ts: [],
};

/* -------------------------------------------------------------------------- */
/*  Scalar parsers                                                            */
/* -------------------------------------------------------------------------- */

const NUM_RE = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;

/** Strict finite-number parser. Returns null for blank / garbled input (never 0 for ''). */
export function parseNum(input: string, allowUnits = false): number | null {
  let t = input.trim();
  if (!t) return null;
  if (allowUnits) t = t.replace(/\s*(?:°\s*c|dbm|db|mdpl|masl|m|v|%)$/i, '').trim();
  if (!NUM_RE.test(t)) return null;
  const v = Number(t.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

export function parseTimestamp(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d{10}$/.test(s)) return Number(s) * 1000;
  if (/^\d{13}$/.test(s)) return Number(s);
  if (/^\d{5}(?:\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 30000 && serial < 80000) return Math.round((serial - 25569) * 86400000) + new Date().getTimezoneOffset() * 60000;
  }
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    let d = Number(dmy[1]);
    let m = Number(dmy[2]);
    if (m > 12 && d <= 12) [d, m] = [m, d];
    const t = new Date(Number(dmy[3]), m - 1, d, Number(dmy[4] ?? 0), Number(dmy[5] ?? 0), Number(dmy[6] ?? 0)).getTime();
    return Number.isFinite(t) ? t : null;
  }
  const hms = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hms) {
    const d = new Date();
    d.setHours(Number(hms[1]), Number(hms[2]), Number(hms[3] ?? 0), 0);
    return d.getTime();
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

const SOS_WORDS = new Set(['SOS', 'DARURAT', 'EMERGENCY', 'BAHAYA', 'ALERT']);
const NORMAL_WORDS = new Set(['NORMAL', 'AMAN', 'OK', 'SAFE']);

function parseStatus(input: string, required: boolean): PacketStatus | null {
  const t = input.trim().toUpperCase();
  if (!t) return required ? null : 'NORMAL';
  if (SOS_WORDS.has(t)) return 'SOS';
  if (NORMAL_WORDS.has(t)) return 'NORMAL';
  return null;
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,31}$/;

/** Printable raw payload — control bytes are escaped so noise stays readable in the log. */
export function escapeRaw(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f-\u009f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

/* -------------------------------------------------------------------------- */
/*  Row validation                                                            */
/* -------------------------------------------------------------------------- */

interface RawFields {
  id: string;
  lat: string;
  lon: string;
  alt: string;
  temp: string;
  status: string;
  rssi: string;
  snr: string;
  battery: string;
  statusRequired: boolean;
}

type Built = { ok: true; packet: Omit<Packet, 'ts' | 'tsSource' | 'row'> } | { ok: false; reason: string };

function build(f: RawFields): Built {
  const id = f.id.trim();
  if (!ID_RE.test(id)) return { ok: false, reason: 'Corrupt delimiter/ID' };

  const lat = parseNum(f.lat);
  const lon = parseNum(f.lon);
  if (lat === null || lon === null) return { ok: false, reason: 'Invalid numeric coordinates' };
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return { ok: false, reason: 'Coordinates out of range' };
  if (lat === 0 && lon === 0) return { ok: false, reason: 'No GPS fix (0, 0)' };

  const alt = parseNum(f.alt, true);
  const temp = parseNum(f.temp, true);
  if (alt === null || temp === null) return { ok: false, reason: 'Invalid numeric MDPL / temperature' };
  if (alt < -500 || alt > 9000) return { ok: false, reason: 'MDPL out of range' };
  if (temp < -90 || temp > 70) return { ok: false, reason: 'Temperature out of range' };

  const status = parseStatus(f.status, f.statusRequired);
  if (!status) return { ok: false, reason: 'Unrecognized status flag' };

  let rssi: number | undefined;
  let snr: number | undefined;
  let battery: number | undefined;
  if (f.rssi.trim()) {
    const v = parseNum(f.rssi, true);
    if (v === null || v > 0 || v < -200) return { ok: false, reason: 'Invalid RSSI' };
    rssi = v;
  }
  if (f.snr.trim()) {
    const v = parseNum(f.snr, true);
    if (v === null || v < -60 || v > 60) return { ok: false, reason: 'Invalid SNR' };
    snr = v;
  }
  if (f.battery.trim()) {
    const v = parseNum(f.battery, true);
    if (v !== null) battery = v;
  }
  return { ok: true, packet: { id, lat, lon, alt, temp, status, rssi, snr, battery } };
}

/** Extracts "RAKSA_01|…" from strings like "ISI DATA: RAKSA_01|…". */
function extractPayload(cell: string): string {
  const first = cell.indexOf('|');
  if (first < 0) return cell;
  const head = cell.slice(0, first);
  const m = head.match(/([^\s:,;=]*)$/);
  return (m ? m[1] : head) + cell.slice(first);
}

function parsePipe(cell: string): Built {
  const fields = extractPayload(cell)
    .replace(/[\r\n]+$/g, '')
    .split('|')
    .map((s) => s.trim());
  while (fields.length > 6 && fields[fields.length - 1] === '') fields.pop();
  if (fields.length < 6 || fields.length > 8) {
    return { ok: false, reason: `Corrupt delimiter/ID (${fields.length} field${fields.length === 1 ? '' : 's'}, expected 6–8)` };
  }
  return build({
    id: fields[0],
    lat: fields[1],
    lon: fields[2],
    alt: fields[3],
    temp: fields[4],
    status: fields[5],
    rssi: fields[6] ?? '',
    snr: fields[7] ?? '',
    battery: '',
    statusRequired: true,
  });
}

/* -------------------------------------------------------------------------- */
/*  Table parser                                                              */
/* -------------------------------------------------------------------------- */

export type FallbackTs = (row: number, raw: string) => number;

const cellAt = (cells: string[], idx: number | undefined) => (idx === undefined ? '' : (cells[idx] ?? ''));

function joinTimestamp(cells: string[], cols: number[]): string {
  const parts = cols.map((c) => (cells[c] ?? '').trim()).filter(Boolean);
  if (parts.length > 1) parts[0] = parts[0].replace(/[ T]00:00:00(?:\.\d+)?Z?$/, '');
  return parts.join(' ');
}

const PRINTABLE_PREVIEW = 400;

export function parseTable(rows: string[][], fallbackTs: FallbackTs = () => Date.now()): ParseResult {
  // 1. header detection within the first rows
  let headerRow: number | null = null;
  let map: ColMap | null = null;
  let labels: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const { map: m, recognised, labels: l } = mapHeader(rows[i] ?? []);
    if (recognised.size >= 2 || (recognised.size === 1 && recognised.has('raw'))) {
      headerRow = i;
      map = m;
      labels = l;
      break;
    }
  }

  const entries: LogEntry[] = [];
  let valid = 0;
  let sos = 0;
  let corrupt = 0;

  for (let i = headerRow === null ? 0 : headerRow + 1; i < rows.length; i++) {
    const cells = (rows[i] ?? []).map((c) => c ?? '');
    if (cells.every((c) => !c.trim())) continue;
    const row = i + 1;
    const nonEmpty = cells.filter((c) => c.trim());
    const raw = escapeRaw(nonEmpty.join(nonEmpty.length > 1 ? ', ' : '')).slice(0, PRINTABLE_PREVIEW);

    let activeMap = map;
    const pipeCell = (() => {
      const viaRaw = map?.single.raw !== undefined ? cells[map.single.raw] : undefined;
      if (viaRaw && viaRaw.includes('|')) return viaRaw;
      return cells.find((c) => c.includes('|'));
    })();
    if (!activeMap && !pipeCell && cells.length >= 6) activeMap = POSITIONAL;

    let built: Built;
    const structured =
      activeMap &&
      [activeMap.single.id, activeMap.single.lat, activeMap.single.lon].some((idx) => cellAt(cells, idx).trim() !== '');

    if (structured && activeMap) {
      const g = (f: Exclude<Field, 'ts'>) => cellAt(cells, activeMap.single[f]);
      built = build({
        id: g('id'),
        lat: g('lat'),
        lon: g('lon'),
        alt: g('alt'),
        temp: g('temp'),
        status: g('status'),
        rssi: g('rssi'),
        snr: g('snr'),
        battery: g('battery'),
        statusRequired: false,
      });
    } else if (pipeCell) {
      built = parsePipe(pipeCell);
    } else {
      built = { ok: false, reason: 'Corrupt delimiter/ID (no payload delimiters)' };
    }

    if (!built.ok) {
      corrupt++;
      entries.push({ row, raw, kind: 'CORRUPT', reason: built.reason });
      continue;
    }

    const tsText = map ? joinTimestamp(cells, map.ts) : '';
    const parsedTs = tsText ? parseTimestamp(tsText) : null;
    const packet: Packet = {
      ...built.packet,
      row,
      ts: parsedTs ?? fallbackTs(row, raw),
      tsSource: parsedTs !== null ? 'sheet' : 'ingest',
    };
    valid++;
    if (packet.status === 'SOS') sos++;
    entries.push({ row, raw, kind: packet.status, packet });
  }

  const total = entries.length;
  return { entries, headerRow, mapping: labels, total, valid, sos, corrupt };
}

/* -------------------------------------------------------------------------- */
/*  Input normalisers (CSV text / JSON)                                       */
/* -------------------------------------------------------------------------- */

export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())} ${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function csvToRows(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const res = Papa.parse<string[]>(clean, { delimitersToGuess: [',', '\t', ';'], skipEmptyLines: false });
  return res.data.map((r) => r.map((c) => c ?? ''));
}

export function jsonToRows(json: unknown): string[][] {
  if (Array.isArray(json)) {
    if (json.length === 0) return [];
    if (json.every((r) => Array.isArray(r))) return (json as unknown[][]).map((r) => r.map(cellToString));
    if (json.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))) {
      const objs = json as Record<string, unknown>[];
      const keys: string[] = [];
      for (const o of objs) for (const k of Object.keys(o)) if (!keys.includes(k)) keys.push(k);
      return [keys, ...objs.map((o) => keys.map((k) => cellToString(o[k])))];
    }
    return json.map((r) => [cellToString(r)]);
  }
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    if (typeof o.error === 'string') throw new Error(`Endpoint error: ${o.error}`);
    for (const key of ['data', 'rows', 'values', 'items', 'result', 'records']) {
      if (Array.isArray(o[key])) return jsonToRows(o[key]);
    }
  }
  throw new Error('Unrecognised JSON structure — expected an array of rows or objects.');
}

/** Detects CSV vs JSON vs HTML (sign-in page) and returns raw rows. */
export function textToRows(text: string): string[][] {
  const head = text.replace(/^\uFEFF/, '').trimStart();
  if (head.startsWith('<')) {
    throw new Error('Received an HTML page instead of data. Share the sheet as "Anyone with the link — Viewer", publish it to the web, or deploy the Apps Script for "Anyone".');
  }
  if (head.startsWith('[') || head.startsWith('{')) {
    return jsonToRows(JSON.parse(head));
  }
  return csvToRows(head);
}
