import { Router, type IRouter } from "express";
import { state } from "../bot/state";
import { restartBot } from "../bot/bot";

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

router.post("/restart", (_req, res) => {
  restartBot();
  res.json({ ok: true });
});

export default router;
