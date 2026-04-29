import type { PipelineKind, PipelineStep } from './types';

interface PipelineBlueprint {
  label: string;
  steps: PipelineStep[];
  /** Sample outputs filled in as steps advance (visual plausibility). */
  sampleOutputs: Record<string, string[]>;
}

const BLUEPRINTS: Record<PipelineKind, PipelineBlueprint> = {
  leads: {
    label: 'Lead generation',
    steps: [
      {
        id: 'discover',
        label: 'Discover',
        description: 'Finding companies matching ICP via Exa.',
        expectedMs: 4500,
      },
      {
        id: 'enrich',
        label: 'Enrich',
        description: 'Deep researching each company — funding, hiring, tech stack.',
        expectedMs: 6500,
      },
      {
        id: 'score',
        label: 'Score',
        description: 'Scoring leads 0–100 against ICP and detected signals.',
        expectedMs: 2500,
      },
      {
        id: 'review',
        label: 'Review',
        description: 'Feedback agent evaluating lead quality.',
        expectedMs: 1800,
      },
    ],
    sampleOutputs: {
      discover: ['8 companies found', '6 companies found', '12 companies found'],
      enrich: ['8 enriched', 'signals attached', 'funding + hiring mapped'],
      score: ['avg 72 · 3 hot', 'avg 68 · 2 hot', 'avg 76 · 4 hot'],
      review: ['quality 8.2 / 10', 'quality 7.6 / 10', 'quality 8.5 / 10'],
    },
  },
  signals: {
    label: 'Signal monitoring',
    steps: [
      { id: 'scan', label: 'Scan sources', description: 'Querying configured sources with Exa.', expectedMs: 4000 },
      { id: 'classify', label: 'Classify', description: 'Tagging each result by signal type.', expectedMs: 1800 },
      { id: 'save', label: 'Save', description: 'Deduping and writing new signals to Notion.', expectedMs: 1200 },
      { id: 'review', label: 'Review', description: 'Feedback agent evaluating signal quality.', expectedMs: 1500 },
    ],
    sampleOutputs: {
      scan: ['22 results', '14 results', '31 results'],
      classify: ['funding · hiring · news', '7 categories', '5 signal types'],
      save: ['6 new · 4 updated', '3 new · 8 updated', '9 new signals'],
      review: ['quality 8.4 / 10', 'quality 7.9 / 10'],
    },
  },
  outreach: {
    label: 'Outreach drafting',
    steps: [
      { id: 'fetch', label: 'Fetch lead', description: 'Loading lead context and signals.', expectedMs: 1000 },
      { id: 'draft', label: 'Draft', description: 'Writing channel-specific personalized message.', expectedMs: 3500 },
      { id: 'review', label: 'Review', description: 'Feedback agent evaluating draft quality.', expectedMs: 1500 },
    ],
    sampleOutputs: {
      fetch: ['lead + 3 signals', 'lead + 5 signals'],
      draft: ['email · 148 words', 'linkedin · 96 words', 'email · 212 words'],
      review: ['tone 8.6 / 10', 'tone 9.1 / 10', 'tone 7.8 / 10'],
    },
  },
  feedback: {
    label: 'Feedback review',
    steps: [
      { id: 'aggregate', label: 'Aggregate', description: 'Summarizing recent feedback entries.', expectedMs: 1800 },
      { id: 'patterns', label: 'Patterns', description: 'Identifying recurring quality issues.', expectedMs: 2000 },
      { id: 'suggest', label: 'Suggest', description: 'Drafting ICP refinement suggestions.', expectedMs: 1500 },
    ],
    sampleOutputs: {
      aggregate: ['32 entries', '18 entries', '45 entries'],
      patterns: ['3 patterns · 2 strong', '5 recurring themes'],
      suggest: ['4 ICP tweaks', '2 prompt updates'],
    },
  },
  generic: {
    label: 'Running',
    steps: [
      { id: 'plan', label: 'Plan', description: 'Orchestrator parsing intent.', expectedMs: 900 },
      { id: 'execute', label: 'Execute', description: 'Running selected agents.', expectedMs: 3000 },
      { id: 'review', label: 'Review', description: 'Feedback agent evaluating output.', expectedMs: 1200 },
    ],
    sampleOutputs: {
      plan: ['intent resolved', '1 tool selected', '2 tools chained'],
      execute: ['agent complete', 'tools run'],
      review: ['quality 8.0 / 10', 'quality 7.7 / 10'],
    },
  },
};

export function detectPipelineKind(text: string): PipelineKind {
  const t = text.toLowerCase();
  if (/\b(generate|discover|prospect|lead)/.test(t)) return 'leads';
  if (/\b(signal|monitor|scan)/.test(t)) return 'signals';
  if (/\b(outreach|draft|email|message)/.test(t)) return 'outreach';
  if (/\b(feedback|review|quality)/.test(t)) return 'feedback';
  return 'generic';
}

export function getBlueprint(kind: PipelineKind): PipelineBlueprint {
  return BLUEPRINTS[kind];
}

export function pickSampleOutput(kind: PipelineKind, stepId: string, seed: number): string {
  const options = BLUEPRINTS[kind].sampleOutputs[stepId] ?? [];
  if (options.length === 0) return '';
  return options[seed % options.length];
}
