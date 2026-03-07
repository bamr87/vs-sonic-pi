export enum ConnectionState {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
  Disconnecting = "disconnecting",
}

export interface ConnectionInfo {
  state: ConnectionState;
  host: string;
  sendPort: number;
  listenPort: number;
  daemonPort: number;
  token: number;
}

export interface PortMap {
  daemon: number;
  guiListenToServer: number;
  guiSendToServer: number;
  scsynth: number;
  oscCues: number;
  tauApi: number;
  tauPhx: number;
  token: number;
}

export type LogLevel = "debug" | "info" | "warning" | "error";

export interface SonicPiConfig {
  osc: {
    host: string;
    sendPort: number;
    listenPort: number;
    daemonPort: number;
  };
  autoConnect: boolean;
  heartbeatInterval: number;
  sonicPiPath: string;
  logLevel: LogLevel;
}

export interface OptInfo {
  doc: string;
  default: string | number;
  constraints?: string;
  slidable?: boolean;
  dynamic?: boolean;
}

export interface SynthEntry {
  key: string;
  name: string;
  doc: string;
  opts: Record<string, OptInfo>;
}

export interface FxEntry {
  key: string;
  name: string;
  doc: string;
  opts: Record<string, OptInfo>;
}

export interface SampleEntry {
  name: string;
}

export interface FunctionEntry {
  name: string;
  doc: string;
  category: string;
  summary?: string;
  args?: string[];
  opts?: Record<string, string>;
  examples?: string[];
  introduced?: string;
}

export interface ScaleEntry {
  name: string;
  intervals: number[];
}

export interface ChordEntry {
  name: string;
  intervals: number[];
}

export type NoteMap = Record<string, number>;

export interface SonicPiData {
  synths: SynthEntry[];
  fx: FxEntry[];
  samples: Record<string, SampleEntry[]>;
  functions: FunctionEntry[];
  scales: ScaleEntry[];
  chords: ChordEntry[];
  notes: NoteMap;
}
