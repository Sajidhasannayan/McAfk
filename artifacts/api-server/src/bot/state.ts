export type BotStatus = "idle" | "connecting" | "online" | "reconnecting" | "stopped";

export interface LogEntry {
  ts: number;
  level: "info" | "warn" | "error";
  message: string;
}

export interface BotState {
  status: BotStatus;
  startedAt: number;
  connectedAt: number | null;
  disconnectedAt: number | null;
  reconnectCount: number;
  reconnectAttempt: number;
  nextReconnectAt: number | null;
  lastError: string | null;
  serverHost: string;
  serverPort: number;
  username: string;
  position: { x: number; y: number; z: number } | null;
  health: number | null;
  food: number | null;
  dimension: string | null;
  loadedChunks: number;
  prunedChunksTotal: number;
  lastPruneAt: number | null;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
    lastGcAt: number | null;
    gcRuns: number;
  };
  logs: LogEntry[];
}

const MAX_LOGS = 200;

export const state: BotState = {
  status: "idle",
  startedAt: Date.now(),
  connectedAt: null,
  disconnectedAt: null,
  reconnectCount: 0,
  reconnectAttempt: 0,
  nextReconnectAt: null,
  lastError: null,
  serverHost: "",
  serverPort: 0,
  username: "",
  position: null,
  health: null,
  food: null,
  dimension: null,
  loadedChunks: 0,
  prunedChunksTotal: 0,
  lastPruneAt: null,
  memory: {
    rssMb: 0,
    heapUsedMb: 0,
    heapTotalMb: 0,
    externalMb: 0,
    lastGcAt: null,
    gcRuns: 0,
  },
  logs: [],
};

export function pushLog(level: LogEntry["level"], message: string): void {
  state.logs.push({ ts: Date.now(), level, message });
  if (state.logs.length > MAX_LOGS) {
    state.logs.splice(0, state.logs.length - MAX_LOGS);
  }
}
