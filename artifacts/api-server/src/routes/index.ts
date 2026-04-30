import { Router, type IRouter } from "express";
import { state } from "../bot/state";
import { restartBot, sendChatNow, startBot, stopBot } from "../bot/bot";
import { getChatMessages } from "../bot/chat";
import { checkPassword, issueToken, tokenFromHeader, verifyToken } from "../bot/auth";
import { loadBotConfig } from "../bot/config";
import {
  type BotConfigOverrides,
  mergeOverrides,
  readOverrides,
  writeOverrides,
} from "../bot/configStore";

const router: IRouter = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", botStatus: state.status, uptime: Date.now() - state.startedAt });
});

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/status", (_req, res) => {
  // Public status — strip logs so server messages, kick reasons, etc.
  // are only visible to authenticated admins.
  const { logs: _logs, ...publicState } = state;
  res.json(publicState);
});

router.get("/admin/logs", (req, res) => {
  const token = tokenFromHeader(req.headers["authorization"]);
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ logs: state.logs });
});

router.get("/chat/messages", (_req, res) => {
  res.json({ messages: getChatMessages() });
});

router.post("/chat/login", (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!checkPassword(password)) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  res.json({ token: issueToken() });
});

router.post("/chat/send", (req, res) => {
  const token = tokenFromHeader(req.headers["authorization"]);
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    res.status(400).json({ error: "Empty message" });
    return;
  }
  if (message.length > 256) {
    res.status(400).json({ error: "Message too long (max 256 chars)" });
    return;
  }
  const ok = sendChatNow(message);
  if (!ok) {
    res.status(503).json({ error: "Bot is not online" });
    return;
  }
  res.json({ ok: true });
});

router.get("/config", (_req, res) => {
  const o = readOverrides();
  res.json({
    host: o.host ?? state.serverHost,
    port: o.port ?? state.serverPort,
    username: o.username ?? state.username,
    overridden: {
      host: o.host !== undefined,
      port: o.port !== undefined,
      username: o.username !== undefined,
    },
  });
});

type ValidationResult =
  | { ok: true; patch: BotConfigOverrides }
  | { ok: false; error: string };

const VIEW_DISTANCES = ["tiny", "short", "normal", "far"] as const;
const AUTO_EAT_PRIORITIES = ["saturation", "foodPoints"] as const;

function asInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

function validateConfigBody(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;
  const out: BotConfigOverrides = {};

  if (b["host"] !== undefined) {
    const v = typeof b["host"] === "string" ? b["host"].trim() : "";
    if (!v || v.length > 253) return { ok: false, error: "Host is required (max 253 chars)" };
    out.host = v;
  }
  if (b["port"] !== undefined) {
    const n = asInt(b["port"]);
    if (n === null || n < 1 || n > 65535) return { ok: false, error: "Port must be an integer 1-65535" };
    out.port = n;
  }
  if (b["username"] !== undefined) {
    const v = typeof b["username"] === "string" ? b["username"].trim() : "";
    if (!v || v.length > 16 || !/^[A-Za-z0-9_]+$/.test(v)) {
      return { ok: false, error: "Username must be 1-16 chars (letters, digits, underscore)" };
    }
    out.username = v;
  }
  if (b["viewDistance"] !== undefined) {
    if (!VIEW_DISTANCES.includes(b["viewDistance"] as typeof VIEW_DISTANCES[number])) {
      return { ok: false, error: `viewDistance must be one of ${VIEW_DISTANCES.join(", ")}` };
    }
    out.viewDistance = b["viewDistance"] as BotConfigOverrides["viewDistance"];
  }

  if (b["chatMessages"] !== undefined) {
    if (!Array.isArray(b["chatMessages"])) return { ok: false, error: "chatMessages must be an array of strings" };
    const arr = b["chatMessages"]
      .filter((m): m is string => typeof m === "string")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
    if (arr.length > 50) return { ok: false, error: "chatMessages: max 50 entries" };
    if (arr.some((m) => m.length > 256)) return { ok: false, error: "Each chat message must be <= 256 chars" };
    out.chatMessages = arr;
  }

  const intRanges: Array<[keyof BotConfigOverrides, number, number]> = [
    ["chatIntervalMs", 5_000, 3_600_000],
    ["reconnectMinMs", 1_000, 600_000],
    ["reconnectMaxMs", 1_000, 3_600_000],
    ["chunkPruneIntervalMs", 5_000, 600_000],
    ["chunkPruneRadius", 1, 16],
    ["memoryReportIntervalMs", 5_000, 600_000],
    ["memoryGcThresholdMb", 50, 8_192],
    ["antiAfkIntervalMs", 5_000, 600_000],
    ["autoEatThreshold", 1, 20],
  ];
  for (const [key, min, max] of intRanges) {
    if (b[key] === undefined) continue;
    const n = asInt(b[key]);
    if (n === null || n < min || n > max) {
      return { ok: false, error: `${String(key)} must be an integer between ${min} and ${max}` };
    }
    (out as Record<string, unknown>)[key] = n;
  }

  if (b["autoEatEnabled"] !== undefined) {
    if (typeof b["autoEatEnabled"] !== "boolean") {
      return { ok: false, error: "autoEatEnabled must be a boolean" };
    }
    out.autoEatEnabled = b["autoEatEnabled"];
  }
  if (b["autoEatPriority"] !== undefined) {
    if (!AUTO_EAT_PRIORITIES.includes(b["autoEatPriority"] as typeof AUTO_EAT_PRIORITIES[number])) {
      return { ok: false, error: `autoEatPriority must be one of ${AUTO_EAT_PRIORITIES.join(", ")}` };
    }
    out.autoEatPriority = b["autoEatPriority"] as BotConfigOverrides["autoEatPriority"];
  }

  return { ok: true, patch: out };
}

router.post("/config", (req, res) => {
  const token = tokenFromHeader(req.headers["authorization"]);
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const result = validateConfigBody(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  try {
    writeOverrides({ ...readOverrides(), ...result.patch });
  } catch (err) {
    res.status(500).json({ error: `Failed to save: ${(err as Error).message}` });
    return;
  }
  restartBot();
  res.json({ ok: true });
});

/**
 * Admin: read the full effective bot configuration, including which fields
 * are user-overridden. The frontend uses this to populate the admin form.
 */
router.get("/admin/config", (req, res) => {
  const token = tokenFromHeader(req.headers["authorization"]);
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const overrides = readOverrides();
  const effective = loadBotConfig();
  res.json({
    effective: {
      host: effective.host,
      port: effective.port,
      username: effective.username,
      viewDistance: effective.viewDistance,
      chatMessages: effective.chatMessages,
      chatIntervalMs: effective.chatIntervalMs,
      reconnectMinMs: effective.reconnectMinMs,
      reconnectMaxMs: effective.reconnectMaxMs,
      chunkPruneIntervalMs: effective.chunkPruneIntervalMs,
      chunkPruneRadius: effective.chunkPruneRadius,
      memoryReportIntervalMs: effective.memoryReportIntervalMs,
      memoryGcThresholdMb: effective.memoryGcThresholdMb,
      antiAfkIntervalMs: effective.antiAfkIntervalMs,
      autoEatEnabled: effective.autoEatEnabled,
      autoEatThreshold: effective.autoEatThreshold,
      autoEatPriority: effective.autoEatPriority,
    },
    overrides,
  });
});

/**
 * Admin: PATCH-style — accept any subset of fields, validate, merge into
 * persisted overrides, and restart the bot to pick them up.
 */
router.post("/admin/config", (req, res) => {
  const token = tokenFromHeader(req.headers["authorization"]);
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const result = validateConfigBody(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  let merged: BotConfigOverrides;
  try {
    merged = mergeOverrides(result.patch);
  } catch (err) {
    res.status(500).json({ error: `Failed to save: ${(err as Error).message}` });
    return;
  }
  restartBot();
  res.json({ ok: true, overrides: merged });
});

/** Admin: reset all overrides back to env / built-in defaults. */
router.post("/admin/config/reset", (req, res) => {
  const token = tokenFromHeader(req.headers["authorization"]);
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    writeOverrides({});
  } catch (err) {
    res.status(500).json({ error: `Failed to reset: ${(err as Error).message}` });
    return;
  }
  restartBot();
  res.json({ ok: true });
});

router.post("/start", (req, res) => {
  const token = tokenFromHeader(req.headers["authorization"]);
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  startBot();
  res.json({ ok: true, status: state.status });
});

router.post("/stop", (req, res) => {
  const token = tokenFromHeader(req.headers["authorization"]);
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  stopBot();
  res.json({ ok: true, status: state.status });
});

router.post("/restart", (req, res) => {
  const token = tokenFromHeader(req.headers["authorization"]);
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  restartBot();
  res.json({ ok: true });
});

export default router;
