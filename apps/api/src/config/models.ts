/**
 * Single source of truth for model defaults. Override per deployment with
 * CLAUDE_MODEL / CLAUDE_MODEL_HEAVY / CLAUDE_MODEL_FAST.
 */
export const DEFAULT_MODELS = {
  default: 'claude-sonnet-4-6',
  heavy: 'claude-opus-4-6',
  fast: 'claude-haiku-4-5-20251001',
} as const;
