# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Email the maintainer listed in
`package.json` / the repository profile with a description, reproduction steps and the
affected version or commit. You will get an acknowledgement within a few days.

## Supported versions

Only the `main` branch receives security fixes.

## Deployment notes

- Set `APP_AUTH_PASSWORD`, `APP_SECRET_KEY`, `TELEGRAM_WEBHOOK_SECRET` and `WHATSAPP_APP_SECRET`
  before exposing a deployment to the internet. Webhooks are rejected while their secret is empty.
- Rotate `APP_AUTH_PASSWORD` to invalidate every signed-in browser session.
- Keep `.env` out of version control and readable only by the deploying user (`chmod 600`).
