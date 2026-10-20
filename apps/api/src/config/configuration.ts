import { DEFAULT_MODELS } from './models';

const bool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined || value === '' ? fallback : value === 'true';

export default () => ({
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL ?? DEFAULT_MODELS.default,
    modelHeavy: process.env.CLAUDE_MODEL_HEAVY ?? DEFAULT_MODELS.heavy,
    modelFast: process.env.CLAUDE_MODEL_FAST ?? DEFAULT_MODELS.fast,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
  },
  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
  },
  database: {
    url: process.env.DATABASE_URL,
    ssl: bool(process.env.DATABASE_SSL, false),
    sslRejectUnauthorized: bool(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED, true),
    autoMigrate: bool(process.env.DB_AUTO_MIGRATE, true),
    debug: process.env.MIKROORM_DEBUG ?? 'false',
  },
  security: {
    appSecretKey: process.env.APP_SECRET_KEY,
    authPassword: process.env.APP_AUTH_PASSWORD,
  },
  features: {
    schedules: bool(process.env.SCHEDULES_ENABLED, false),
  },
  exa: {
    apiKey: process.env.EXA_API_KEY,
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY,
  },
  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY,
  },
  server: {
    host: process.env.HOST ?? '0.0.0.0',
    port: parseInt(process.env.PORT ?? '3000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});
