#!/usr/bin/env bash
# Copy the committed code (git HEAD) to the instance provisioned by aws-ec2-up.sh,
# create .env on first run (secrets generated, Bedrock wired to the instance role),
# and (re)build + start the docker compose stack. Re-run to deploy updates.
#
# Usage: deploy/aws-ec2-deploy.sh <customer-name>
# Env overrides on first run: DOMAIN (default <ip>.sslip.io), EXA_API_KEY, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD
set -euo pipefail

SUFFIX=${1:?usage: $0 <customer-name>}
STATE="$HOME/.config/hothotleads/$SUFFIX.json"
[ -f "$STATE" ] || { echo "no state at $STATE; run deploy/aws-ec2-up.sh $SUFFIX first" >&2; exit 1; }
field() { python3 -c "import json,sys;print(json.load(open('$STATE'))['$1'])"; }
IP=$(field publicIp); KEY=$(field keyFile); REGION=$(field region)
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "ubuntu@$IP")
REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
log() { echo "==> $*" >&2; }

log "waiting for cloud-init (docker install) on $IP"
for i in $(seq 1 60); do
  if "${SSH[@]}" 'cloud-init status 2>/dev/null | grep -q done && docker --version >/dev/null 2>&1' 2>/dev/null; then break; fi
  sleep 5
done
"${SSH[@]}" 'docker compose version' >/dev/null

log "copying git HEAD to /opt/hothotleads"
# Wipe the previous source tree first: extracting over it would keep files deleted in git
# (and nest/tsc compile everything under src/). .env and backups/ live outside these dirs.
"${SSH[@]}" 'mkdir -p /opt/hothotleads && cd /opt/hothotleads && rm -rf apps packages deploy docs Dockerfile docker-compose*.yml Caddyfile package*.json turbo.json'
git -C "$REPO_ROOT" archive --format=tar HEAD | "${SSH[@]}" 'tar -x -C /opt/hothotleads'

if ! "${SSH[@]}" 'test -f /opt/hothotleads/.env'; then
  DOMAIN=${DOMAIN:-$(echo "$IP" | tr . -).sslip.io}
  PLATFORM_ADMIN_EMAIL=${PLATFORM_ADMIN_EMAIL:-admin@$DOMAIN}
  PLATFORM_ADMIN_PASSWORD=${PLATFORM_ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -d '/+=')}
  APP_SECRET_KEY=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  log "creating .env (domain $DOMAIN)"
  "${SSH[@]}" "cat > /opt/hothotleads/.env && chmod 600 /opt/hothotleads/.env" <<ENV
# HotHotLeads production env for '$SUFFIX' — generated $(date -u +%FT%TZ)
DOMAIN=$DOMAIN

POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgresql://hothotleads:$POSTGRES_PASSWORD@postgres:5432/hothotleads
DATABASE_SSL=false
DB_AUTO_MIGRATE=true

PLATFORM_ADMIN_EMAIL=$PLATFORM_ADMIN_EMAIL
PLATFORM_ADMIN_PASSWORD=$PLATFORM_ADMIN_PASSWORD
APP_PUBLIC_URL=https://$DOMAIN
APP_SECRET_KEY=$APP_SECRET_KEY

# Claude via Amazon Bedrock using the instance role (no ANTHROPIC_API_KEY).
CLAUDE_CODE_USE_BEDROCK=1
AWS_REGION=$REGION
CLAUDE_MODEL=us.anthropic.claude-sonnet-4-6
CLAUDE_MODEL_HEAVY=us.anthropic.claude-sonnet-4-6
CLAUDE_MODEL_FAST=us.anthropic.claude-haiku-4-5-20251001-v1:0
# Pin the CLI's own defaults so background work never silently lands on a pricier model.
ANTHROPIC_DEFAULT_SONNET_MODEL=us.anthropic.claude-sonnet-4-6
ANTHROPIC_DEFAULT_HAIKU_MODEL=us.anthropic.claude-haiku-4-5-20251001-v1:0
ANTHROPIC_DEFAULT_OPUS_MODEL=us.anthropic.claude-sonnet-4-6

# Web research (fill in; agent runs that research the web fail cleanly until set)
EXA_API_KEY=${EXA_API_KEY:-}
TAVILY_API_KEY=
PERPLEXITY_API_KEY=

# Channels (optional; webhooks are rejected while the secrets are empty)
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=

SCHEDULES_ENABLED=false
LOG_LEVEL=info
ENV
  printf 'PLATFORM_ADMIN_EMAIL=%s\nPLATFORM_ADMIN_PASSWORD=%s\n' "$PLATFORM_ADMIN_EMAIL" "$PLATFORM_ADMIN_PASSWORD" > "$HOME/.config/hothotleads/$SUFFIX.password"
  chmod 600 "$HOME/.config/hothotleads/$SUFFIX.password"
  log "platform admin credentials saved to ~/.config/hothotleads/$SUFFIX.password"
fi

if "${SSH[@]}" 'docker ps --format "{{.Names}}" | grep -q "^hothotleads-postgres-1$"'; then
  log "backing up the database before the update (kept: last 7, in /opt/hothotleads/backups)"
  "${SSH[@]}" 'mkdir -p /opt/hothotleads/backups && docker exec hothotleads-postgres-1 pg_dump -U hothotleads hothotleads | gzip > /opt/hothotleads/backups/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ).sql.gz && ls -t /opt/hothotleads/backups | tail -n +8 | xargs -r -I{} rm "/opt/hothotleads/backups/{}"'
fi

log "building and starting the stack (first build takes several minutes)"
# pipefail on the remote side so a failed image build fails this script instead of leaving the old container running.
"${SSH[@]}" 'cd /opt/hothotleads && set -o pipefail && docker compose -f docker-compose.prod.yml up -d --build 2>&1 | tail -8' \
  || { echo "build/start failed; the previous release is still running" >&2; exit 1; }

DOMAIN=$("${SSH[@]}" "grep '^DOMAIN=' /opt/hothotleads/.env | cut -d= -f2")
log "waiting for the API"
for i in $(seq 1 60); do
  if "${SSH[@]}" 'curl -fsS http://localhost:3000/health 2>/dev/null' | grep -q '"db":"up"' ; then break; fi
  sleep 3
done
"${SSH[@]}" 'docker compose -f /opt/hothotleads/docker-compose.prod.yml ps --format "{{.Name}} {{.Status}}"'
log "deployed: https://$DOMAIN"
