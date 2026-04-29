# Run the Minecraft AFK Bot on Termux (Android)

You can run the entire bot — dashboard, chat, settings, everything — from your phone using **Termux**. This guide walks through installing it, exposing the dashboard URL publicly so you can share it with others, and managing the bot with Start / Stop / Restart from the dashboard (just like Replit's Run button).

> **Time:** ~10 minutes. **You need:** an Android phone with ~300 MB free.

---

## 1. Install Termux

Termux from the Play Store is outdated. **Install from F-Droid instead:**

1. Open https://f-droid.org in your phone browser, download the F-Droid installer, install it.
2. In F-Droid, search for **Termux** and install it.
3. Open Termux. You'll see a black terminal screen — that's where everything below runs.

> Tip: pinch-zoom to make the text bigger. Long-press to paste.

## 2. Install Node.js, Git, and pnpm

In Termux, run these commands one at a time:

```sh
pkg update -y && pkg upgrade -y
pkg install -y nodejs git
npm install -g pnpm
```

Verify:

```sh
node -v        # should print v20.x or newer
pnpm -v        # should print 9.x or newer
```

## 3. Get the bot code

If your project is on GitHub or Replit (you can grab the git URL from Replit → Tools → Git), clone it:

```sh
cd ~
git clone <YOUR_GIT_URL> afkbot
cd afkbot
```

If you don't have a git URL, on Replit go to **Files → ⋮ → Download as zip**, transfer the zip to your phone, then in Termux:

```sh
pkg install -y unzip
cd ~ && unzip ~/storage/downloads/your-project.zip -d afkbot
cd afkbot
```

(You may need to run `termux-setup-storage` once and grant storage permission.)

## 4. Install dependencies and build

From the project root:

```sh
pnpm install
pnpm --filter @workspace/api-server run build
```

The first install takes a few minutes. Subsequent installs are fast.

## 5. Run the bot

```sh
PORT=8080 BOT_DATA_DIR=$HOME/.afkbot \
  node --enable-source-maps --expose-gc artifacts/api-server/dist/index.mjs
```

You should see:

```
Status server listening port=8080
Starting Minecraft AFK bot ...
```

Open your phone browser and go to **http://localhost:8080** — you'll see the dashboard.

> `BOT_DATA_DIR` is where your saved Host / Port / Username settings live. Using `$HOME/.afkbot` makes them survive between Termux sessions.

## 6. Configure your server from the dashboard

1. Tap the **Chat** tab.
2. Sign in with the bot password (default `4pkj9!uwoj69ttsajidobhai7!`).
3. Switch back to the **Status** tab — you'll now see a **Server settings** card.
4. Type your Aternos host (e.g. `ranmalover67.aternos.me`), port, and a username.
5. Tap **Save & reconnect**. The bot picks up the new settings immediately.

## 7. Start / Stop / Restart from the dashboard

Once you're signed in, the toolbar above the activity log shows a **Replit-style power button**:

- **Green "Start"** — appears when the bot is stopped. Tap to start it.
- **Red "Stop"** — appears when the bot is running. Tap to fully stop it (it stays stopped until you start it again).
- **Restart** — restarts the bot using the latest saved config.

These also work via the API:

```
POST /start    (Authorization: Bearer <token>)
POST /stop     (Authorization: Bearer <token>)
POST /restart  (Authorization: Bearer <token>)
```

## 8. Make the dashboard URL public (share with friends)

`http://localhost:8080` only works on your phone. To share the link with someone else, use a tunnel.

### Option A — localtunnel (simplest)

In a **second** Termux session (swipe right from the left edge → New session):

```sh
npm install -g localtunnel
lt --port 8080
```

You'll get a URL like `https://random-name.loca.lt`. Share it. Anyone who opens it sees the dashboard.

> The first time a visitor opens a localtunnel URL, the page asks for the "tunnel password" — that's just your phone's public IP, which the page shows you a button to fetch. After that one click it's normal.

### Option B — serveo.net (no install)

```sh
pkg install -y openssh
ssh -R 80:localhost:8080 serveo.net
```

It prints a `https://xxxxx.serveo.net` URL. Share that. No signup, no install beyond ssh.

### Option C — Cloudflare Tunnel (most reliable, no signup)

```sh
pkg install -y cloudflared
cloudflared tunnel --url http://localhost:8080
```

It prints a `https://xxxx.trycloudflare.com` URL. Best uptime, slightly slower to start.

> Pick whichever works on your network. School/college Wi-Fi sometimes blocks one method but allows another.

## 9. Keep it running when you close Termux

By default, closing Termux kills the bot. Two easy ways to keep it alive:

### tmux (recommended)

```sh
pkg install -y tmux
tmux new -s afk
# inside tmux: run the bot command from step 5
# detach without killing: press Ctrl+b, then d
```

To come back later:

```sh
tmux attach -t afk
```

### Termux wake-lock

In the Termux notification, tap **Acquire wakelock**. Combined with tmux above, the bot keeps running with the screen off.

## 10. Common issues

| Problem | Fix |
| --- | --- |
| `pkg install` fails | `termux-change-repo` and pick a different mirror. |
| `pnpm install` fails on a native dep | Re-run with `pnpm install --ignore-scripts`. The bot doesn't need any native deps. |
| Dashboard says **Connecting…** forever | Your Aternos server is asleep. Wake it from aternos.org first. |
| `localtunnel` page asks for a password | Click the link it shows — it auto-fills it. Reload the dashboard. |
| Bot eats too much battery | Lower the view distance (it's already `tiny`) and stop the bot from the dashboard when not needed. |

---

That's it. You now have the same bot running on your phone, controllable from a dashboard you can share with anyone via a public URL.
