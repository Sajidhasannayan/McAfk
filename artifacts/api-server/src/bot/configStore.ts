import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger";

export interface ServerOverrides {
  host?: string;
  port?: number;
  username?: string;
}

function dataDir(): string {
  return process.env["BOT_DATA_DIR"] || "/tmp";
}

function filePath(): string {
  return path.join(dataDir(), "afkbot-config.json");
}

export function readOverrides(): ServerOverrides {
  try {
    const raw = fs.readFileSync(filePath(), "utf8");
    const obj = JSON.parse(raw) as ServerOverrides;
    const out: ServerOverrides = {};
    if (typeof obj.host === "string" && obj.host.length > 0) out.host = obj.host;
    if (typeof obj.port === "number" && Number.isFinite(obj.port)) out.port = obj.port;
    if (typeof obj.username === "string" && obj.username.length > 0) out.username = obj.username;
    return out;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== "ENOENT") {
      logger.warn({ err: e.message }, "Failed to read overrides file");
    }
    return {};
  }
}

export function writeOverrides(next: ServerOverrides): void {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(filePath(), JSON.stringify(next, null, 2), "utf8");
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Failed to write overrides file");
    throw err;
  }
}

export function overridesPath(): string {
  return filePath();
}
