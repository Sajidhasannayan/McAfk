# Minecraft AFK Bot

A modern Minecraft AFK bot for free Aternos servers (or any other Minecraft server) with a built-in status webpage so it can be hosted on Render and kept alive by UptimeRobot.

## What it does

- Logs into a Minecraft server with an offline-mode account (Aternos default).
- Stays "active" with periodic look + jump + tiny walk + arm-swing actions to avoid AFK kicks.
- Sends optional periodic chat messages.
- Auto-reconnects with exponential backoff after kicks/disconnects (great for Aternos, which spins servers down when empty — the bot keeps trying and rejoins as soon as it spins back up).
- **Modern resource controls**:
  - **Chunk loading control** via `viewDistance` (default `tiny` = 2 chunks).
  - **Periodic chunk pruning** — unloads chunks outside the configured radius every 30s by default to keep RAM low.
  - **Memory monitoring** — reports RSS / heap and triggers manual GC (`--expose-gc`) when heap crosses a configurable threshold.
- **Live status webpage** at `/` showing connection, position, health, chunks, memory, recent activity, and a Restart button.
- **Health endpoint** at `/health` for UptimeRobot.

## Endpoints

| Path       | Purpose                                              |
| ---------- | ---------------------------------------------------- |
| `/`        | Status dashboard (HTML)                              |
| `/health`  | JSON health for UptimeRobot — always 200 if process up |
| `/healthz` | Minimal `{ "status": "ok" }`                         |
| `/status`  | Full bot state JSON                                  |
| `/restart` | `POST` — force the bot to reconnect                  |

## Configuration (environment variables)

| Variable                         | Default     | Notes                                                                    |
| -------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `PORT`                           | (required)  | HTTP port for the status server. Render injects this automatically.      |
| `MC_HOST`                        | `localhost` | Aternos host, e.g. `myserver.aternos.me`                                 |
| `MC_PORT`                        | `25565`     | Aternos port (shown next to your IP)                                     |
| `MC_USERNAME`                    | `AFKBot`    | Any name; offline mode allows arbitrary names                            |
| `MC_AUTH`                        | `offline`   | Use `offline` for Aternos cracked / `microsoft` for premium servers      |
| `MC_VERSION`                     | `false`     | `false` = auto-detect. Or pin e.g. `1.20.4`                              |
| `MC_VIEW_DISTANCE`               | `tiny`      | `tiny` / `short` / `normal` / `far`                                      |
| `BOT_CHAT_MESSAGES`              | (empty)     | Pipe-separated messages, e.g. `hi|/afk|still here`                       |
| `BOT_CHAT_INTERVAL_MS`           | `60000`     | Time between chat messages                                               |
| `BOT_RECONNECT_MIN_MS`           | `10000`     | Initial reconnect backoff                                                |
| `BOT_RECONNECT_MAX_MS`           | `120000`    | Max reconnect backoff                                                    |
| `BOT_CHUNK_PRUNE_INTERVAL_MS`    | `30000`     | How often to prune far chunks                                            |
| `BOT_CHUNK_PRUNE_RADIUS`         | `2`         | Keep chunks within this many chunks of the bot                           |
| `BOT_MEMORY_REPORT_INTERVAL_MS`  | `60000`     | Memory sampling cadence                                                  |
| `BOT_MEMORY_GC_THRESHOLD_MB`     | `200`       | Force GC when heap exceeds this                                          |
| `BOT_ANTI_AFK_INTERVAL_MS`       | `20000`     | Time between anti-AFK actions                                            |

## Deploy on Render

1. Push this repo to GitHub.
2. In Render, click **New → Web Service** and pick the repo.
3. Use these settings:
   - **Runtime**: Node
   - **Build Command**:
     ```
     corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build
     ```
   - **Start Command**:
     ```
     node --enable-source-maps --expose-gc artifacts/api-server/dist/index.mjs
     ```
   - **Instance**: Free is fine.
4. Add environment variables (at minimum `MC_HOST`, `MC_PORT`, `MC_USERNAME`).
5. Deploy. Once live, open the Render URL — you'll see the dashboard.

## Keep it alive with UptimeRobot

Render's free tier sleeps after ~15 minutes of inactivity. UptimeRobot fixes this by pinging it.

1. Sign in at [uptimerobot.com](https://uptimerobot.com).
2. **+ Add New Monitor**:
   - **Type**: HTTP(s)
   - **URL**: `https://YOUR-APP.onrender.com/health`
   - **Interval**: 5 minutes
3. Save. The bot will now stay awake and reconnect to your Aternos server whenever it spins up.

## Local development

```bash
PORT=8080 MC_HOST=your.aternos.me MC_PORT=12345 MC_USERNAME=AFKBot \
  pnpm --filter @workspace/api-server run dev
```

Then open <http://localhost:8080>.
