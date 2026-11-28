export type PacketStatus = 'NORMAL' | 'SOS';
export type HikerStatus = PacketStatus | 'OFFLINE';
export type LinkState = 'LIVE' | 'DELAYED' | 'OFFLINE';

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
  /** 'firebase' = timestamp carried in the data; 'ingest' = time received by the dashboard */
  tsSource: 'firebase' | 'ingest';
  /** Stream sequence number */
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
  /** Condition reported by the device (NORMAL / SOS). Never overwritten by connection state. */
  status: PacketStatus;
  /** Connection state derived from `updated_at` age: LIVE / DELAYED / OFFLINE. */
  link: LinkState;
  /** ms since the latest packet */
  silentMs: number;
  /** Identifies the current SOS episode (for acknowledgement), only when status === 'SOS' */
  sosKey?: string;
  sosSince?: number;
}

export type BasemapId = 'topo' | 'satellite' | 'osm';
export type AppView = 'overview' | 'dashboard' | 'hikers' | 'analytics' | 'nodes' | 'log';
export type SidebarFilter = 'all' | 'live' | 'delayed' | 'offline' | 'sos';
