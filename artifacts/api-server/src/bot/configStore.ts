import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger";

export type ViewDistance = "tiny" | "short" | "normal" | "far";
export type AutoEatPriority = "saturation" | "foodPoints";

/**
 * Every field is optional. When unset, the value falls back to the matching
 * env var, then to the built-in default. Settings written here always win.
 */
export interface BotConfigOverrides {
  // Connection
  host?: string;
  port?: number;
  username?: string;
  viewDistance?: ViewDistance;

  // Random in-game chat
  chatMessages?: string[];
  chatIntervalMs?: number;

  // Reconnect
  reconnectMinMs?: number;
  reconnectMaxMs?: number;

  // Chunk pruning
  chunkPruneIntervalMs?: number;
  chunkPruneRadius?: number;

  // Memory
  memoryReportIntervalMs?: number;
  memoryGcThresholdMb?: number;

  // Anti-AFK
  antiAfkIntervalMs?: number;

  // Auto-eat
  autoEatEnabled?: boolean;
  autoEatThreshold?: number;
  autoEatPriority?: AutoEatPriority;
}

/** @deprecated Use BotConfigOverrides — kept for backward compat. */
export type ServerOverrides = BotConfigOverrides;

const VIEW_DISTANCES: ViewDistance[] = ["tiny", "short", "normal", "far"];
const AUTO_EAT_PRIORITIES: AutoEatPriority[] = ["saturation", "foodPoints"];

function dataDir(): string {
  return process.env["BOT_DATA_DIR"] || "/tmp";
}

function filePath(): string {
  return path.join(dataDir(), "afkbot-config.json");
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Read overrides from disk. Unknown / invalid keys are silently dropped so a
 * partially-corrupt file never crashes the bot.
 */
export function readOverrides(): BotConfigOverrides {
  let parsed: unknown;
  try {
    const raw = fs.readFileSync(filePath(), "utf8");
    parsed = JSON.parse(raw);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== "ENOENT") {
      logger.warn({ err: e.message }, "Failed to read overrides file");
    }
    return {};
  }

  if (!parsed || typeof parsed !== "object") return {};
  const obj = parsed as Record<string, unknown>;
  const out: BotConfigOverrides = {};

  if (typeof obj["host"] === "string" && obj["host"].length > 0) out.host = obj["host"];
  if (isFiniteNumber(obj["port"])) out.port = obj["port"];
  if (typeof obj["username"] === "string" && obj["username"].length > 0) out.username = obj["username"];
  if (typeof obj["viewDistance"] === "string" &&
    VIEW_DISTANCES.includes(obj["viewDistance"] as ViewDistance)) {
    out.viewDistance = obj["viewDistance"] as ViewDistance;
  }

  if (Array.isArray(obj["chatMessages"])) {
    out.chatMessages = obj["chatMessages"]
      .filter((m): m is string => typeof m === "string")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
  }
  if (isFiniteNumber(obj["chatIntervalMs"])) out.chatIntervalMs = obj["chatIntervalMs"];
  if (isFiniteNumber(obj["reconnectMinMs"])) out.reconnectMinMs = obj["reconnectMinMs"];
  if (isFiniteNumber(obj["reconnectMaxMs"])) out.reconnectMaxMs = obj["reconnectMaxMs"];
  if (isFiniteNumber(obj["chunkPruneIntervalMs"])) out.chunkPruneIntervalMs = obj["chunkPruneIntervalMs"];
  if (isFiniteNumber(obj["chunkPruneRadius"])) out.chunkPruneRadius = obj["chunkPruneRadius"];
  if (isFiniteNumber(obj["memoryReportIntervalMs"])) out.memoryReportIntervalMs = obj["memoryReportIntervalMs"];
  if (isFiniteNumber(obj["memoryGcThresholdMb"])) out.memoryGcThresholdMb = obj["memoryGcThresholdMb"];
  if (isFiniteNumber(obj["antiAfkIntervalMs"])) out.antiAfkIntervalMs = obj["antiAfkIntervalMs"];

  if (typeof obj["autoEatEnabled"] === "boolean") out.autoEatEnabled = obj["autoEatEnabled"];
  if (isFiniteNumber(obj["autoEatThreshold"])) out.autoEatThreshold = obj["autoEatThreshold"];
  if (typeof obj["autoEatPriority"] === "string" &&
    AUTO_EAT_PRIORITIES.includes(obj["autoEatPriority"] as AutoEatPriority)) {
    out.autoEatPriority = obj["autoEatPriority"] as AutoEatPriority;
  }

  return out;
}

/** Write the full overrides object, replacing any prior content. */
export function writeOverrides(next: BotConfigOverrides): void {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(filePath(), JSON.stringify(next, null, 2), "utf8");
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Failed to write overrides file");
    throw err;
  }
}

/** Merge `patch` into the current overrides and persist. */
export function mergeOverrides(patch: BotConfigOverrides): BotConfigOverrides {
  const current = readOverrides();
  const next: BotConfigOverrides = { ...current, ...patch };
  writeOverrides(next);
  return next;
}

export function overridesPath(): string {
  return filePath();
}
