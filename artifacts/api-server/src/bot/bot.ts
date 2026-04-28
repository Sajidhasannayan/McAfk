import mineflayer, { type Bot } from "mineflayer";
import { logger } from "../lib/logger";
import { type BotConfig, loadBotConfig } from "./config";
import { pushLog, state } from "./state";

let currentBot: Bot | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let chunkPruneTimer: NodeJS.Timeout | null = null;
let memoryTimer: NodeJS.Timeout | null = null;
let chatTimer: NodeJS.Timeout | null = null;
let antiAfkTimer: NodeJS.Timeout | null = null;
let chatIndex = 0;
let stopped = false;
let config: BotConfig;

function log(level: "info" | "warn" | "error", message: string): void {
  pushLog(level, message);
  logger[level](message);
}

function clearTimers(): void {
  if (chunkPruneTimer) clearInterval(chunkPruneTimer);
  if (memoryTimer) clearInterval(memoryTimer);
  if (chatTimer) clearInterval(chatTimer);
  if (antiAfkTimer) clearInterval(antiAfkTimer);
  chunkPruneTimer = memoryTimer = chatTimer = antiAfkTimer = null;
}

function pruneChunks(bot: Bot): void {
  try {
    const world = bot.world as unknown as {
      columns?: Record<string, unknown>;
      unloadColumn?: (x: number, z: number) => void;
    };
    const columns = world.columns;
    if (!columns || typeof world.unloadColumn !== "function") return;

    const radius = config.chunkPruneRadius;
    const px = Math.floor(bot.entity.position.x / 16);
    const pz = Math.floor(bot.entity.position.z / 16);

    let pruned = 0;
    for (const key of Object.keys(columns)) {
      const [cxStr, czStr] = key.split(",");
      const cx = Number(cxStr);
      const cz = Number(czStr);
      if (!Number.isFinite(cx) || !Number.isFinite(cz)) continue;
      if (Math.abs(cx - px) > radius || Math.abs(cz - pz) > radius) {
        world.unloadColumn(cx, cz);
        pruned++;
      }
    }

    state.loadedChunks = Object.keys(columns).length;
    state.lastPruneAt = Date.now();
    if (pruned > 0) {
      state.prunedChunksTotal += pruned;
      log("info", `Pruned ${pruned} far chunks (radius ${radius}); ${state.loadedChunks} remain`);
    }
  } catch (err) {
    log("warn", `Chunk prune failed: ${(err as Error).message}`);
  }
}

function reportMemory(): void {
  const mem = process.memoryUsage();
  const toMb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10;
  state.memory.rssMb = toMb(mem.rss);
  state.memory.heapUsedMb = toMb(mem.heapUsed);
  state.memory.heapTotalMb = toMb(mem.heapTotal);
  state.memory.externalMb = toMb(mem.external);

  if (state.memory.heapUsedMb >= config.memoryGcThresholdMb) {
    const gc = (globalThis as { gc?: () => void }).gc;
    if (typeof gc === "function") {
      gc();
      state.memory.gcRuns++;
      state.memory.lastGcAt = Date.now();
      const after = process.memoryUsage();
      log(
        "info",
        `Forced GC at ${state.memory.heapUsedMb}MB heap; now ${toMb(after.heapUsed)}MB`,
      );
      state.memory.heapUsedMb = toMb(after.heapUsed);
      state.memory.heapTotalMb = toMb(after.heapTotal);
      state.memory.rssMb = toMb(after.rss);
    }
  }
}

function antiAfkTick(bot: Bot): void {
  try {
    const yaw = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * 0.5;
    bot.look(yaw, pitch, true).catch(() => {});

    bot.setControlState("jump", true);
    setTimeout(() => bot.setControlState("jump", false), 250);

    const dirs: Array<"forward" | "back" | "left" | "right"> = [
      "forward",
      "back",
      "left",
      "right",
    ];
    const dir = dirs[Math.floor(Math.random() * dirs.length)]!;
    bot.setControlState(dir, true);
    setTimeout(() => bot.setControlState(dir, false), 600);

    bot.swingArm("right");
  } catch (err) {
    log("warn", `Anti-AFK tick failed: ${(err as Error).message}`);
  }
}

function sendNextChat(bot: Bot): void {
  if (config.chatMessages.length === 0) return;
  const msg = config.chatMessages[chatIndex % config.chatMessages.length]!;
  chatIndex++;
  try {
    bot.chat(msg);
    log("info", `Chat sent: ${msg}`);
  } catch (err) {
    log("warn", `Chat send failed: ${(err as Error).message}`);
  }
}

function scheduleReconnect(): void {
  if (stopped) return;
  state.reconnectAttempt++;
  const backoff = Math.min(
    config.reconnectMaxMs,
    config.reconnectMinMs * Math.pow(1.5, state.reconnectAttempt - 1),
  );
  const jitter = Math.random() * 0.3 * backoff;
  const delay = Math.round(backoff + jitter);
  state.status = "reconnecting";
  state.nextReconnectAt = Date.now() + delay;
  log("info", `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${state.reconnectAttempt})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect(): void {
  if (stopped) return;

  state.status = "connecting";
  state.nextReconnectAt = null;
  log("info", `Connecting to ${config.host}:${config.port} as ${config.username} (view: ${config.viewDistance})`);

  let bot: Bot;
  try {
    const opts: Parameters<typeof mineflayer.createBot>[0] = {
      host: config.host,
      port: config.port,
      username: config.username,
      auth: config.auth,
      viewDistance: config.viewDistance,
      checkTimeoutInterval: 60_000,
      hideErrors: true,
    };
    if (typeof config.version === "string") {
      (opts as { version?: string }).version = config.version;
    }
    bot = mineflayer.createBot(opts);
  } catch (err) {
    state.lastError = (err as Error).message;
    log("error", `createBot threw: ${state.lastError}`);
    scheduleReconnect();
    return;
  }

  currentBot = bot;

  bot.once("login", () => {
    log("info", `Logged in as ${bot.username}`);
  });

  bot.once("spawn", () => {
    state.status = "online";
    state.connectedAt = Date.now();
    state.reconnectAttempt = 0;
    state.reconnectCount++;
    state.lastError = null;
    state.username = bot.username ?? config.username;
    state.dimension = (bot.game?.dimension as string | undefined) ?? null;
    log("info", `Spawned at ${JSON.stringify(bot.entity?.position)}`);

    clearTimers();

    chunkPruneTimer = setInterval(() => pruneChunks(bot), config.chunkPruneIntervalMs);
    memoryTimer = setInterval(reportMemory, config.memoryReportIntervalMs);
    antiAfkTimer = setInterval(() => antiAfkTick(bot), config.antiAfkIntervalMs);
    if (config.chatMessages.length > 0) {
      chatTimer = setInterval(() => sendNextChat(bot), config.chatIntervalMs);
    }
  });

  bot.on("health", () => {
    state.health = bot.health;
    state.food = bot.food;
  });

  bot.on("move", () => {
    const p = bot.entity?.position;
    if (p) state.position = { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) };
  });

  bot.on("kicked", (reason) => {
    log("warn", `Kicked: ${typeof reason === "string" ? reason : JSON.stringify(reason)}`);
  });

  bot.on("error", (err) => {
    state.lastError = err.message;
    log("error", `Bot error: ${err.message}`);
  });

  bot.on("end", (reason) => {
    state.disconnectedAt = Date.now();
    state.connectedAt = null;
    state.position = null;
    state.health = null;
    state.food = null;
    state.loadedChunks = 0;
    log("warn", `Disconnected: ${reason ?? "unknown"}`);
    clearTimers();
    currentBot = null;
    scheduleReconnect();
  });
}

export function startBot(): void {
  config = loadBotConfig();
  stopped = false;
  state.serverHost = config.host;
  state.serverPort = config.port;
  state.username = config.username;
  state.startedAt = Date.now();
  log("info", "Starting Minecraft AFK bot");
  connect();
}

export function stopBot(): void {
  stopped = true;
  state.status = "stopped";
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  clearTimers();
  if (currentBot) {
    try {
      currentBot.quit("shutdown");
    } catch {
      // ignore
    }
    currentBot = null;
  }
  log("info", "Bot stopped");
}

export function restartBot(): void {
  log("info", "Restart requested");
  if (currentBot) {
    try {
      currentBot.quit("restart");
    } catch {
      // ignore
    }
    currentBot = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  state.reconnectAttempt = 0;
  stopped = false;
  setTimeout(connect, 500);
}
