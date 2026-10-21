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
| `ANTHROPIC_API_KEY` | A key from the Anthropic Console, scoped to this deployment. **Or** leave it unset and use Bedrock (section 7). |
| `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` | Your (the operator's) platform admin account, created on first boot. `openssl rand -base64 18` |
| `APP_PUBLIC_URL` | `https://$DOMAIN`; used in invite and password-reset links. |
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

Open `https://$DOMAIN`, sign in as the platform admin, create the customer's organization in
**Platform → Organizations**, set its entitlements, and use **Invite owner** to get a link.
Send that link to the customer: they set a password and complete the onboarding wizard.

### Upgrading a deployment from the single-tenant release

The first boot after the upgrade migrates the database in place: the workspace becomes an
organization, the operator becomes its owner (without a password), and all products attach to
it. Before deploying:

1. Back up: `docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U hothotleads hothotleads | gzip > pre-tenancy-$(date +%F).sql.gz`
2. Add `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` and `APP_PUBLIC_URL` to `/opt/hothotleads/.env`; `APP_AUTH_PASSWORD` is no longer read.
3. Deploy, then fetch the customer's one-time password link:
   `docker compose -f docker-compose.prod.yml logs api | grep "has no password yet"`
   and send it to them (valid 72 h). You can mint a new one any time from **Platform → Users**.

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
| Reset a user's password | **Platform → Users → reset link**, or an org admin from **Settings → Members**. The link is single-use and valid 72 h. |
| Rotate the platform admin password | sign in and change it under **Settings → Profile**; `PLATFORM_ADMIN_PASSWORD` is only used while the account has none. |
| Backup | `docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U hothotleads hothotleads \| gzip > backup-$(date +%F).sql.gz` then copy to S3 (`aws s3 cp`). Put it in `cron` nightly. |
| Restore | `gunzip -c backup.sql.gz \| docker compose -f docker-compose.prod.yml exec -T postgres psql -U hothotleads hothotleads` |

Set `LOG_LEVEL=debug` temporarily when diagnosing agent runs; it logs each tool call name.

## 6. Scripted provisioning

`deploy/aws-ec2-up.sh <customer>` creates everything in sections 1–2 as an isolated set of
resources (own VPC, security group, key pair, IAM role with Bedrock permissions, Elastic IP,
one instance) tagged `Project=hothotleads`, and `deploy/aws-ec2-deploy.sh <customer>` copies
the committed code over SSH, generates `.env` on first run, and builds and starts the stack.
Re-run the deploy script to ship updates. State lives in `~/.config/hothotleads/<customer>.json`
and the generated sign-in password in `~/.config/hothotleads/<customer>.password`.

## 7. Claude through Amazon Bedrock instead of an API key

The Agent SDK's Claude Code subprocess can call Amazon Bedrock with the instance role, so no
Anthropic key lives on the server and usage bills to the AWS account (Activate credits apply).
The scripted provisioning sets this up; by hand:

1. Give the instance role `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream`,
   `bedrock:ListInferenceProfiles`, `bedrock:GetInferenceProfile` on `inference-profile/*`,
   `application-inference-profile/*` and `foundation-model/*`.
2. Launch with `HttpPutResponseHopLimit=2` in the instance metadata options, or containers
   cannot reach the instance-role credentials.
3. In `.env` set `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_REGION`, and point `CLAUDE_MODEL*` and
   `ANTHROPIC_DEFAULT_{SONNET,HAIKU,OPUS}_MODEL` at cross-region inference profile ids
   (`us.anthropic.claude-sonnet-4-6`, `us.anthropic.claude-haiku-4-5-20251001-v1:0`). Pin all
   three defaults; unpinned, the CLI's own fallbacks can land on Opus pricing.
4. Enable Anthropic model access once in the Bedrock console (use-case form).

Note: the Claude Code `WebSearch` tool is unavailable on Bedrock; HotHotLeads uses Exa for
web research, so this does not affect it.

## 8. Limits to know about

- **One API instance only.** Schedules (off by default via `SCHEDULES_ENABLED=false`) use
  in-process cron; two instances would run every job twice. Vertical scaling only.
- **Channels are deployment-wide.** One Telegram bot / WhatsApp number per stack, routed to the
  organization only while the stack hosts exactly one. Host one customer per stack if they
  need chat channels; several organizations per stack are fine for web-only use.
- **Long-running requests.** A chat message can take minutes while agents research. Caddy's
  defaults handle this; if you put an AWS ALB in front instead, raise its idle timeout above
  the 15 s SSE heartbeat (e.g. 300 s).
- **Secrets live in `.env` on the host.** For stricter handling, store them in AWS Systems
  Manager Parameter Store and render `.env` at deploy time.
