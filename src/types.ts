export type PacketStatus = 'NORMAL' | 'SOS';
export type HikerStatus = PacketStatus | 'OFFLINE';

export interface Packet {
  id: string;
  lat: number;
  lon: number;
  /** MDPL — metres above sea level */
  alt: number;
  /** °C */
  temp: number;
  status: PacketStatus;
  /** dBm */
  rssi?: number;
  /** dB */
  snr?: number;
  battery?: number;
  /** epoch ms */
  ts: number;
  /** 'sheet' = timestamp carried in the data; 'ingest' = first time this row was seen by the dashboard */
  tsSource: 'sheet' | 'ingest';
  /** 1-based spreadsheet row number */
  row: number;
}

export type LogKind = 'NORMAL' | 'SOS' | 'CORRUPT';

export interface LogEntry {
  row: number;
  raw: string;
  kind: LogKind;
  reason?: string;
  packet?: Packet;
}

export interface ParseResult {
  entries: LogEntry[];
  headerRow: number | null;
  /** Human readable column mapping, e.g. "ID ← Device" */
  mapping: string[];
  total: number;
  valid: number;
  sos: number;
  corrupt: number;
}

export type NodeType = 'basecamp' | 'pos' | 'relay';

export interface RelayNode {
  id: string;
  name: string;
  type: NodeType;
  lat: number;
  lon: number;
  elevation?: number;
  gain?: number;
  active: boolean;
}

export interface Pairing {
  leader: string;
  groupSize?: number;
  contact: string;
  /** HH:MM, local time */
  descentTime: string;
}

export interface Hiker {
  id: string;
  latest: Packet;
  track: Packet[];
  status: HikerStatus;
  /** ms since the latest packet */
  silentMs: number;
  /** Identifies the current SOS episode (for acknowledgement), only when status === 'SOS' */
  sosKey?: string;
  sosSince?: number;
}

export type BasemapId = 'topo' | 'satellite' | 'osm';
export type AppView = 'dashboard' | 'nodes' | 'log';
export type SidebarFilter = 'all' | 'sos' | 'normal' | 'offline';
export type SourceMode = 'none' | 'sheet' | 'file';
