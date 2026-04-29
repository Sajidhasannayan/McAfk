# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile for the Minecraft AFK Bot.
# Builds inside a pnpm workspace, then ships only the production payload.
#
# Build:   docker build -t minecraft-afk-bot .
# Run:     docker run --rm -p 8080:8080 \
#            -e MC_HOST=your.aternos.me -e MC_PORT=12345 -e MC_USERNAME=AFKBot \
#            minecraft-afk-bot
# Health:  http://localhost:8080/health

############################
# Stage 1 — base
############################
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
WORKDIR /repo

############################
# Stage 2 — build
############################
FROM base AS build

# Copy lockfile + workspace metadata first so installs cache well.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# Copy every workspace package.json so pnpm can resolve the workspace graph.
COPY artifacts/api-server/package.json     ./artifacts/api-server/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json     ./lib/api-client-react/
COPY lib/api-spec/package.json             ./lib/api-spec/
COPY lib/api-zod/package.json              ./lib/api-zod/
COPY lib/db/package.json                   ./lib/db/
COPY scripts/package.json                  ./scripts/

# Install everything (frozen lockfile).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Now bring in the source we actually need to build the bot.
COPY artifacts/api-server ./artifacts/api-server

# Build the esbuild bundle into artifacts/api-server/dist.
RUN pnpm --filter @workspace/api-server run build

# Produce a self-contained production folder at /out
# (deps installed without devDependencies, no workspace symlinks).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @workspace/api-server deploy --prod --legacy /out

# Move build artifacts into the deployed folder so the runtime stage
# only needs to copy a single directory.
RUN cp -R artifacts/api-server/dist   /out/dist \
 && cp -R artifacts/api-server/public /out/public

############################
# Stage 3 — runtime
############################
FROM node:20-slim AS runtime

# Drop privileges. node:slim ships a non-root `node` user.
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    NODE_OPTIONS="--enable-source-maps --expose-gc"

COPY --from=build --chown=node:node /out /app

USER node
EXPOSE 8080

# Lightweight Node-based healthcheck (no curl in the slim image).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.mjs"]
