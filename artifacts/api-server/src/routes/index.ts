import { Router, type IRouter } from "express";
import { state } from "../bot/state";
import { restartBot, sendChatNow } from "../bot/bot";
import { getChatMessages } from "../bot/chat";
import { checkPassword, issueToken, tokenFromHeader, verifyToken } from "../bot/auth";

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
