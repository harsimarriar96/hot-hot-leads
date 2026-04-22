export default () => ({
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
    modelHeavy: process.env.CLAUDE_MODEL_HEAVY ?? 'claude-opus-4-6',
    modelFast: process.env.CLAUDE_MODEL_FAST ?? 'claude-haiku-4-5-20251001',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
  },
  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
  },
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    knowledgePageId: process.env.NOTION_KNOWLEDGE_PAGE_ID,
    outputPageId: process.env.NOTION_OUTPUT_PAGE_ID,
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
    publicUrl: process.env.PUBLIC_URL ?? '',
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});
