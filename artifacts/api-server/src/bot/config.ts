export interface BotConfig {
  host: string;
  port: number;
  username: string;
  version: string | false;
  auth: "offline" | "microsoft" | "mojang";
  viewDistance: "tiny" | "short" | "normal" | "far";
  chatMessages: string[];
  chatIntervalMs: number;
  reconnectMinMs: number;
  reconnectMaxMs: number;
  chunkPruneIntervalMs: number;
  chunkPruneRadius: number;
  memoryReportIntervalMs: number;
  memoryGcThresholdMb: number;
  antiAfkIntervalMs: number;
}

function envStr(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function loadBotConfig(): BotConfig {
  const rawMessages = envStr("BOT_CHAT_MESSAGES", "");
  const chatMessages = rawMessages
    .split("|")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);

  return {
    host: envStr("MC_HOST", "localhost"),
    port: envInt("MC_PORT", 25565),
    username: envStr("MC_USERNAME", "AFKBot"),
    version: envStr("MC_VERSION", "false") === "false" ? false : envStr("MC_VERSION", "1.20.4"),
    auth: envStr("MC_AUTH", "offline") as BotConfig["auth"],
    viewDistance: envStr("MC_VIEW_DISTANCE", "tiny") as BotConfig["viewDistance"],
    chatMessages,
    chatIntervalMs: envInt("BOT_CHAT_INTERVAL_MS", 60_000),
    reconnectMinMs: envInt("BOT_RECONNECT_MIN_MS", 10_000),
    reconnectMaxMs: envInt("BOT_RECONNECT_MAX_MS", 120_000),
    chunkPruneIntervalMs: envInt("BOT_CHUNK_PRUNE_INTERVAL_MS", 30_000),
    chunkPruneRadius: envInt("BOT_CHUNK_PRUNE_RADIUS", 2),
    memoryReportIntervalMs: envInt("BOT_MEMORY_REPORT_INTERVAL_MS", 60_000),
    memoryGcThresholdMb: envInt("BOT_MEMORY_GC_THRESHOLD_MB", 200),
    antiAfkIntervalMs: envInt("BOT_ANTI_AFK_INTERVAL_MS", 20_000),
  };
}
