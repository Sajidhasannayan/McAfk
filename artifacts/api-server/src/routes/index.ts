import { Router, type IRouter } from "express";
import { state } from "../bot/state";
import { restartBot, sendChatNow, startBot, stopBot } from "../bot/bot";
import { getChatMessages } from "../bot/chat";
import { checkPassword, issueToken, tokenFromHeader, verifyToken } from "../bot/auth";
import { readOverrides, writeOverrides } from "../bot/configStore";

const router: IRouter = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", botStatus: state.status, uptime: Date.now() - state.startedAt });
});

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/status", (_req, res) => {
  res.json(state);
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

router.post("/config", (req, res) => {
  const token = tokenFromHeader(req.headers["authorization"]);
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = req.body ?? {};
  const host = typeof body.host === "string" ? body.host.trim() : "";
  const portRaw = body.port;
  const username = typeof body.username === "string" ? body.username.trim() : "";

  if (!host || host.length > 253) {
    res.status(400).json({ error: "Host is required (max 253 chars)" });
    return;
  }
  const port = typeof portRaw === "number" ? portRaw : Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    res.status(400).json({ error: "Port must be an integer between 1 and 65535" });
    return;
  }
  if (!username || username.length > 16 || !/^[A-Za-z0-9_]+$/.test(username)) {
    res.status(400).json({ error: "Username must be 1-16 chars (letters, digits, underscore)" });
    return;
  }

  try {
    writeOverrides({ host, port, username });
  } catch (err) {
    res.status(500).json({ error: `Failed to save: ${(err as Error).message}` });
    return;
  }
  restartBot();
  res.json({ ok: true, host, port, username });
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
