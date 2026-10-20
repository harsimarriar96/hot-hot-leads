# Deploying HotHotLeads on a single AWS EC2 host

This guide runs the whole stack (Postgres, API + web UI, Caddy for HTTPS) with docker compose
on one EC2 instance. It is the simplest production setup and the one the project is tested
against. It is **single-instance by design**: do not run two copies of the API against the same
database (see "Limits" below).

## 1. Provision

| Item | Recommendation |
|---|---|
| Instance | `t3.medium` or larger (2 vCPU / 4 GB). Each chat message spawns a Claude Code CLI subprocess and the orchestrator fans out to sub-agents, so 1 GB instances swap. |
| OS | Ubuntu 24.04 LTS or Amazon Linux 2023 |
| Disk | 30 GB gp3 (Postgres volume + Docker images) |
| Security group | Inbound `443` and `80` from `0.0.0.0/0` (Caddy needs 80 for the ACME challenge), `22` from your IP only |
| DNS | An `A` record for your domain (e.g. `leads.example.com`) pointing at the instance's Elastic IP |

Install Docker Engine + the compose plugin (Ubuntu):

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker
```

## 2. Configure

```bash
git clone <your fork> hothotleads && cd hothotleads
cp .env.example .env
chmod 600 .env
```

Fill in `.env`. Required:

| Variable | Notes |
|---|---|
| `DOMAIN` | The hostname Caddy obtains a certificate for. |
| `POSTGRES_PASSWORD` | Any strong value. Must also appear inside `DATABASE_URL`. |
| `DATABASE_URL` | `postgresql://hothotleads:<POSTGRES_PASSWORD>@postgres:5432/hothotleads` |
| `ANTHROPIC_API_KEY` | A key from the Anthropic Console, scoped to this deployment. |
| `APP_AUTH_PASSWORD` | The password the customer uses to sign in to the web UI. `openssl rand -base64 18` |
| `APP_SECRET_KEY` | 32+ chars. Encrypts stored channel credentials. `openssl rand -hex 32` |
| `EXA_API_KEY` | Needed for discovery, enrichment and signal monitoring. |

Optional: `TELEGRAM_*`, `WHATSAPP_*` (see section 4), `CLAUDE_MODEL*`, `LOG_LEVEL`.

## 3. Run

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f api
```

On first boot the API applies the database migrations itself (`DB_AUTO_MIGRATE=true`) and
logs `Migrations applied`. Caddy obtains the certificate within a minute.

Smoke test:

```bash
curl -s https://$DOMAIN/health                       # {"status":"ok","db":"up",...}
curl -s -o /dev/null -w '%{http_code}\n' https://$DOMAIN/api/products   # 401 (auth required)
```

Open `https://$DOMAIN`, sign in with `APP_AUTH_PASSWORD`, and complete the onboarding wizard.

## 4. Chat channels

**Telegram.** Register the webhook once, passing the same secret as `TELEGRAM_WEBHOOK_SECRET`:

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d url="https://$DOMAIN/webhooks/telegram" \
  -d secret_token="$TELEGRAM_WEBHOOK_SECRET"
```

The API rejects every Telegram request while `TELEGRAM_WEBHOOK_SECRET` is empty.

**WhatsApp (Meta Cloud API).** In the Meta app dashboard set the callback URL to
`https://$DOMAIN/webhooks/whatsapp`, the verify token to `WHATSAPP_VERIFY_TOKEN`, and copy the
app secret into `WHATSAPP_APP_SECRET`. Every webhook POST is checked against
`X-Hub-Signature-256`; requests are rejected while the app secret is empty.

## 5. Operate

| Task | Command |
|---|---|
| Logs | `docker compose -f docker-compose.prod.yml logs -f api` |
| Update | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| Restart | `docker compose -f docker-compose.prod.yml restart api` |
| Rotate sign-in password | edit `APP_AUTH_PASSWORD` in `.env`, then restart `api`. Every browser session is signed out. |
| Backup | `docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U hothotleads hothotleads \| gzip > backup-$(date +%F).sql.gz` then copy to S3 (`aws s3 cp`). Put it in `cron` nightly. |
| Restore | `gunzip -c backup.sql.gz \| docker compose -f docker-compose.prod.yml exec -T postgres psql -U hothotleads hothotleads` |

Set `LOG_LEVEL=debug` temporarily when diagnosing agent runs; it logs each tool call name.

## 6. Limits to know about

- **One API instance only.** Schedules (off by default via `SCHEDULES_ENABLED=false`) use
  in-process cron; two instances would run every job twice. Vertical scaling only.
- **Single tenant.** One workspace per deployment. Deploy a separate stack per customer.
- **Long-running requests.** A chat message can take minutes while agents research. Caddy's
  defaults handle this; if you put an AWS ALB in front instead, raise its idle timeout above
  the 15 s SSE heartbeat (e.g. 300 s).
- **Secrets live in `.env` on the host.** For stricter handling, store them in AWS Systems
  Manager Parameter Store and render `.env` at deploy time.
