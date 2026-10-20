# syntax=docker/dockerfile:1.7
# Multi-stage build: one image serves the API and the built web app.

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV CI=true

# ── deps: install the full workspace (dev deps needed for the build) ─────────
FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
RUN npm ci --no-audit --no-fund

# ── build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN npx turbo run build --filter=@hothotleads/api --filter=@hothotleads/web

# ── prod-deps: prune dev dependencies ────────────────────────────────────────
FROM deps AS prod-deps
# The Agent SDK installs a native build per libc; this image is glibc (Debian), so drop the musl one.
RUN npm prune --omit=dev --no-audit --no-fund \
 && rm -rf node_modules/@anthropic-ai/claude-agent-sdk-*-musl

# ── runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# The Claude Agent SDK spawns the Claude Code CLI, which writes under $HOME.
ENV HOME=/home/node

# --chown on COPY avoids a second full-size layer that a later `chown -R` would create.
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=prod-deps /app/package.json ./package.json
COPY --chown=node:node --from=build /app/apps/api/package.json apps/api/package.json
COPY --chown=node:node --from=build /app/apps/api/dist apps/api/dist
COPY --chown=node:node --from=build /app/apps/web/dist apps/web/dist
COPY --chown=node:node --from=build /app/packages/config packages/config
COPY --chown=node:node --from=build /app/packages/types/package.json packages/types/package.json
COPY --chown=node:node --from=build /app/packages/types/dist packages/types/dist
COPY --chown=node:node --from=build /app/packages/db/package.json packages/db/package.json
COPY --chown=node:node --from=build /app/packages/db/dist packages/db/dist

USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main"]
