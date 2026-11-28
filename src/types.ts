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
export type AppView = 'overview' | 'dashboard' | 'emergencies' | 'hikers' | 'analytics' | 'nodes' | 'log' | 'users';
export type SidebarFilter = 'all' | 'live' | 'delayed' | 'offline' | 'sos';

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';
export type AuthStatus = 'loading' | 'unauthenticated' | 'unauthorized' | 'authorized';

export type SosIncidentState = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface SosIncident {
  device_id: string;
  incident_id: string;
  state: 'ACTIVE' | 'ACKNOWLEDGED';
  triggered_at: number;
  last_sos_at: number;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  temperature: number | null;
  rssi?: number | null;
  snr?: number | null;
  acknowledged_at: number | null;
  acknowledged_by: string | null;
  acknowledged_by_uid?: string | null;
  resolved_at: null;
  resolved_by: null;
  resolution_note: null;
}

export interface SosHistoryIncident {
  device_id: string;
  incident_id: string;
  state: 'RESOLVED';
  triggered_at: number;
  last_sos_at?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  temperature?: number | null;
  rssi?: number | null;
  snr?: number | null;
  acknowledged_at?: number | null;
  acknowledged_by?: string | null;
  acknowledged_by_uid?: string | null;
  resolved_at: number;
  resolved_by: string;
  resolved_by_uid?: string | null;
  resolution_note?: string | null;
}

export interface OperatorUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  /** Where the verified role was sourced from (Firebase custom claims or protected RTDB /users). */
  roleSource: 'claims' | 'database';
  accountStatus: 'ACTIVE';
}

export interface DirectoryUserRecord {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface BasecampDeviceRecord {
  uid: string;
  label: string;
  active: boolean;
  email?: string;
}
