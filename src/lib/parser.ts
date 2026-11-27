import type { LogEntry, Packet, PacketStatus } from '../types';

const NUM_RE = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,31}$/;
const SOS_WORDS = new Set(['SOS', 'DARURAT', 'EMERGENCY', 'BAHAYA', 'ALERT']);
const NORMAL_WORDS = new Set(['NORMAL', 'AMAN', 'OK', 'SAFE']);

export function parseNum(input: string, allowUnits = false): number | null {
  let value = input.trim();
  if (!value) return null;
  if (allowUnits) value = value.replace(/\s*(?:°\s*c|dbm|db|mdpl|masl|m|v|%)$/i, '').trim();
  if (!NUM_RE.test(value)) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseTimestamp(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  if (/^\d{10}$/.test(value)) return Number(value) * 1000;
  if (/^\d{13}$/.test(value)) return Number(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStatus(input: string): PacketStatus | null {
  const value = input.trim().toUpperCase();
  if (!value) return 'NORMAL';
  if (SOS_WORDS.has(value)) return 'SOS';
  if (NORMAL_WORDS.has(value)) return 'NORMAL';
  return null;
}

function escapeRaw(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, (char) => `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

type RawFields = {
  id: string;
  lat: string;
  lon: string;
  alt: string;
  temp: string;
  status: string;
  rssi: string;
  snr: string;
  battery: string;
};

type Built = { ok: true; packet: Omit<Packet, 'ts' | 'tsSource' | 'row'> } | { ok: false; reason: string };

function build(fields: RawFields): Built {
  const id = fields.id.trim();
  if (!ID_RE.test(id)) return { ok: false, reason: 'Invalid device ID' };

  const lat = parseNum(fields.lat);
  const lon = parseNum(fields.lon);
  if (lat === null || lon === null) return { ok: false, reason: 'Invalid numeric coordinates' };
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return { ok: false, reason: 'Coordinates out of range' };
  if (lat === 0 && lon === 0) return { ok: false, reason: 'No GPS fix (0, 0)' };

  const alt = parseNum(fields.alt, true);
  const temp = parseNum(fields.temp, true);
  if (alt === null || temp === null) return { ok: false, reason: 'Invalid numeric MDPL / temperature' };
  if (alt < -500 || alt > 9000) return { ok: false, reason: 'MDPL out of range' };
  if (temp < -90 || temp > 70) return { ok: false, reason: 'Temperature out of range' };

  const status = parseStatus(fields.status);
  if (!status) return { ok: false, reason: 'Unrecognized status flag' };

  let rssi: number | undefined;
  let snr: number | undefined;
  let battery: number | undefined;
  if (fields.rssi.trim()) {
    const value = parseNum(fields.rssi, true);
    if (value === null || value > 0 || value < -200) return { ok: false, reason: 'Invalid RSSI' };
    rssi = value;
  }
  if (fields.snr.trim()) {
    const value = parseNum(fields.snr, true);
    if (value === null || value < -60 || value > 60) return { ok: false, reason: 'Invalid SNR' };
    snr = value;
  }
  if (fields.battery.trim()) {
    const value = parseNum(fields.battery, true);
    if (value !== null) battery = value;
  }
  return { ok: true, packet: { id, lat, lon, alt, temp, status, rssi, snr, battery } };
}

function field(record: Record<string, unknown>, names: string[], fallback = ''): string {
  for (const name of names) {
    const value = record[name];
    if (value !== undefined && value !== null) return String(value);
  }
  return fallback;
}

function failure(row: number, raw: string, reason: string): LogEntry {
  return { row, raw: escapeRaw(raw).slice(0, 400), kind: 'CORRUPT', reason };
}

function resultFromBuilt(built: Built, row: number, raw: string, timestamp: unknown): LogEntry {
  if (!built.ok) return failure(row, raw, built.reason);
  const parsedTs = timestamp === undefined || timestamp === null ? null : parseTimestamp(String(timestamp));
  const packet: Packet = {
    ...built.packet,
    ts: parsedTs ?? Date.now(),
    tsSource: parsedTs === null ? 'ingest' : 'firebase',
    row,
  };
  return { row, raw: escapeRaw(raw).slice(0, 400), kind: packet.status, packet };
}

function parsePipe(value: string, fallbackId: string): Built {
  const firstDelimiter = value.indexOf('|');
  if (firstDelimiter < 0) return { ok: false, reason: 'Raw payload has no pipe delimiters' };
  const head = value.slice(0, firstDelimiter);
  const prefix = head.match(/([^\s:,;=]*)$/);
  const parts = `${prefix?.[1] ?? head}${value.slice(firstDelimiter)}`.replace(/[\r\n]+$/g, '').split('|').map((part) => part.trim());
  while (parts.length > 6 && parts[parts.length - 1] === '') parts.pop();
  if (parts.length < 6 || parts.length > 9) return { ok: false, reason: `Invalid payload field count (${parts.length}; expected 6–9)` };
  return build({
    id: parts[0] || fallbackId,
    lat: parts[1] ?? '',
    lon: parts[2] ?? '',
    alt: parts[3] ?? '',
    temp: parts[4] ?? '',
    status: parts[5] ?? '',
    rssi: parts[6] ?? '',
    snr: parts[7] ?? '',
    battery: parts[8] ?? '',
  });
}

/** Converts a structured Firebase snapshot or raw LoRa payload into one audited packet. */
export function parseFirebasePacket(value: unknown, fallbackId: string, row: number): LogEntry {
  if (typeof value === 'string') {
    const built = parsePipe(value, fallbackId);
    return resultFromBuilt(built, row, value, undefined);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return failure(row, String(value ?? ''), 'Expected a telemetry object or raw LoRa payload');
  }

  const record = value as Record<string, unknown>;
  const rawPayload = field(record, ['payload', 'raw', 'rawData', 'data', 'message']);
  if (rawPayload.includes('|')) {
    return resultFromBuilt(parsePipe(rawPayload, fallbackId), row, rawPayload, record.timestamp ?? record.ts ?? record.time);
  }

  const built = build({
    id: field(record, ['id', 'deviceId', 'device_id'], fallbackId),
    lat: field(record, ['lat', 'latitude']),
    lon: field(record, ['lon', 'lng', 'longitude']),
    alt: field(record, ['mdpl', 'altitude', 'alt', 'elevation']),
    temp: field(record, ['suhu', 'temp', 'temperature']),
    status: field(record, ['status', 'kondisi']),
    rssi: field(record, ['rssi']),
    snr: field(record, ['snr']),
    battery: field(record, ['battery', 'baterai']),
  });
  return resultFromBuilt(built, row, JSON.stringify(record), record.timestamp ?? record.ts ?? record.time);
}
