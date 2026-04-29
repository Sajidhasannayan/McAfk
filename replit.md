# Workspace

## Overview

Minecraft AFK bot for free Aternos servers, with a built-in status webpage so it can be hosted on Render and kept alive by UptimeRobot. The bot uses [mineflayer](https://github.com/PrismarineJS/mineflayer) and is built on the workspace's Express + esbuild API server template.

## What it does

- Logs into a Minecraft server (offline mode by default — works for Aternos cracked servers).
- Anti-AFK: random look, jump, micro-walk, and arm swing every ~20s.
- Auto-reconnects with exponential backoff (perfect for Aternos which spins servers down on inactivity).
- Optional periodic chat messages (e.g. for `/afk` commands).
- **Modern resource controls**:
  - **Chunk loading control** via mineflayer `viewDistance: "tiny"` (default).
  - **Periodic chunk pruning** unloads far chunks every 30s (configurable radius).
  - **Memory monitor** samples RSS/heap and triggers manual GC (`--expose-gc`) past a configurable threshold.
- **Status dashboard** at `/` with live state, recent activity logs, and a Restart button.
- **Health endpoint** at `/health` for UptimeRobot.

## Project structure

The app lives in the existing API server artifact:

- `artifacts/api-server/src/bot/` — bot logic
  - `config.ts` — env-var driven config
  - `state.ts` — in-memory state + ring buffer of recent log entries
  - `bot.ts` — mineflayer wiring, anti-AFK, reconnect, chunk pruning, memory monitor
- `artifacts/api-server/src/routes/index.ts` — `/health`, `/healthz`, `/status`, `/restart`
- `artifacts/api-server/src/app.ts` — Express app, serves `public/`
- `artifacts/api-server/public/index.html` — live status dashboard (vanilla JS, polls `/status` every 3s)
- `artifacts/api-server/README.md` — full env-var reference and Render + UptimeRobot setup

## Stack

- **Runtime**: Node.js 24
- **Bot**: `mineflayer` ^4.34 (auto-detects Minecraft server version)
- **HTTP**: Express 5
- **Logging**: pino
- **Build**: esbuild bundle to `dist/index.mjs` (mineflayer + prismarine externalized)
- **Package manager**: pnpm workspaces

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — build and run locally (needs `PORT`)
- `pnpm --filter @workspace/api-server run build` — production bundle
- `pnpm --filter @workspace/api-server run typecheck` — TypeScript check
- `pnpm run typecheck` — full workspace typecheck

## Configuration

All bot configuration is via environment variables. See `artifacts/api-server/README.md` for the full table. Most important:

- `MC_HOST`, `MC_PORT`, `MC_USERNAME` — your Aternos server
- `MC_AUTH=offline` (default — cracked / Aternos)
- `MC_VIEW_DISTANCE=tiny` (default — minimum chunks loaded)
- `BOT_CHUNK_PRUNE_RADIUS=2`, `BOT_CHUNK_PRUNE_INTERVAL_MS=30000`
- `BOT_MEMORY_GC_THRESHOLD_MB=200`

## Deployment

Deployable as a single Node web service:

- **Docker (local desktop / VPS / Render Docker runtime)**: `cp .env.example .env && docker compose up -d --build`. Multi-stage `Dockerfile` builds with `pnpm deploy --prod`, runs as the non-root `node` user, and includes a healthcheck on `/health`. Compose adds `restart: unless-stopped` and a 512MB memory cap for true 24/7 operation.
- **Render (Node runtime)**: build with `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`, start with `node --enable-source-maps --expose-gc artifacts/api-server/dist/index.mjs`.
- **Keep awake**: point UptimeRobot (5-minute interval, HTTP) at `https://YOUR-APP.onrender.com/health`.

Docker assets at the repo root:
- `Dockerfile` — multi-stage build
- `.dockerignore` — keeps node_modules, dist, etc. out of the build context
- `docker-compose.yml` — one-command local run with healthcheck and auto-restart
- `.env.example` — template for required env vars

See `artifacts/api-server/README.md` for the step-by-step guide.
