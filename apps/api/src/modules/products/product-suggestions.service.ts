import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Product } from '@hothotleads/db';
import { z } from 'zod';
import type { DraftField, ProductSuggestions, SuggestionList } from '@hothotleads/types';

import { ProductDraftAgent } from '../../agents/product-suggestion/product-draft.agent';
import { ProductSuggestionAgent } from '../../agents/product-suggestion/product-suggestion.agent';
import { ExaService } from '../../integrations/exa/exa.service';
import { requireOrg, type TenantContext } from '../auth/tenant-context';

const WEBSITE_TIMEOUT_MS = 10_000;
const AGENT_TIMEOUT_MS = 30_000;
const MAX_RECOMMENDED = 4;
const MAX_LIST_ITEMS = 8;
const MAX_VALUE_LENGTH = 60;
const MAX_TEXT_LENGTH = 2000;
const MAX_CONTEXT_FIELDS = 12;

const AS_LIST = 'Reply with a comma-separated list and nothing else.';

/** What each draftable field should hold, and the column limit it must fit. */
export const DRAFT_FIELDS: Record<DraftField, { guidance: string; maxLength: number }> = {
  generalInfo: { guidance: 'One or two plain sentences on what the product does and for whom.', maxLength: 2000 },
  salesStrategy: {
    guidance: 'A short sales strategy under 120 words: who to approach first, the core message, and the motion.',
    maxLength: 10_000,
  },
  pricing: {
    guidance:
      'A suggested pricing structure under 80 words: the model and tiers. Never invent amounts: write [amount] where a price belongs.',
    maxLength: 5000,
  },
  agentInstructions: {
    guidance: 'Two to four short instructions telling AI sales agents what to prioritise or avoid for this product.',
    maxLength: 4000,
  },
  icpNotes: { guidance: 'One or two sentences on the buyer persona, buying triggers and who to avoid.', maxLength: 2000 },
  icpIndustries: { guidance: `Two to four specific target industries. ${AS_LIST}`, maxLength: 300 },
  icpSizes: {
    guidance: `Two or three company sizes, using only: 1-10, 11-50, 51-200, 201-1000, 1000+. ${AS_LIST}`,
    maxLength: 100,
  },
  icpStages: {
    guidance: `Two or three funding stages, using only: Bootstrapped, Pre-seed, Seed, Series A, Series B, Series C+, Public. ${AS_LIST}`,
    maxLength: 100,
  },
  icpGeographies: { guidance: `Two to four regions or countries to target. ${AS_LIST}`, maxLength: 200 },
  channelName: { guidance: 'The single best outreach channel name, in one to three words.', maxLength: 80 },
  channelDescription: { guidance: 'One sentence on how to use this channel for this product.', maxLength: 500 },
  channelTemplate: {
    guidance:
      'A short outreach message under 80 words for this channel. Use {{company}} and {{first_name}} as placeholders.',
    maxLength: 2000,
  },
  sourceName: { guidance: 'The name of one publication or data source that reveals buying signals.', maxLength: 80 },
  sourceDescription: { guidance: 'One sentence on what signals to watch for in this source.', maxLength: 500 },
  prospectIndustry: { guidance: 'The industry of this company, in one to three words.', maxLength: 120 },
  prospectFitNotes: { guidance: 'One sentence on why this company could fit the product.', maxLength: 500 },
};

const listSchema = z
  .object({
    recommended: z.array(z.string()).default([]),
    alternatives: z.array(z.string()).default([]),
  })
  .default({ recommended: [], alternatives: [] });

const suggestionsSchema = z.object({
  generalInfo: z.string().default(''),
  icpNotes: z.string().default(''),
  targetIndustries: listSchema,
  companySizes: listSchema,
  geographies: listSchema,
  fundingStages: listSchema,
});

function cleanValues(values: string[], exclude: string[] = []): string[] {
  const trimmed = values.map((v) => v.trim()).filter((v) => v && v.length <= MAX_VALUE_LENGTH);
  return [...new Set(trimmed)].filter((v) => !exclude.includes(v)).slice(0, MAX_LIST_ITEMS);
}

function cleanList(list: SuggestionList): SuggestionList {
  // Selecting everything helps nobody, so picks over the limit are offered instead.
  const picks = cleanValues(list.recommended);
  const recommended = picks.slice(0, MAX_RECOMMENDED);
  return {
    recommended,
    alternatives: cleanValues([...picks.slice(MAX_RECOMMENDED), ...list.alternatives], recommended),
  };
}

/** Validates the model's reply. Throws when it holds no usable JSON object. */
export function parseSuggestions(raw: string): ProductSuggestions {
  // Slicing to the outer braces also drops any code fence around the object.
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  const parsed = suggestionsSchema.parse(JSON.parse(json));
  return {
    generalInfo: parsed.generalInfo.trim().slice(0, MAX_TEXT_LENGTH),
    icpNotes: parsed.icpNotes.trim().slice(0, MAX_TEXT_LENGTH),
    targetIndustries: cleanList(parsed.targetIndustries),
    companySizes: cleanList(parsed.companySizes),
    geographies: cleanList(parsed.geographies),
    fundingStages: cleanList(parsed.fundingStages),
  };
}

/** Accepts `acme.com` as well as a full URL. Returns null for anything that is not a public-looking web address. */
export function normalizeWebsite(raw: string): string | null {
  const value = raw.trim();
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    const isWeb = url.protocol === 'https:' || url.protocol === 'http:';
    return isWeb && url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The facts a draft may use: the saved product, overlaid with what is currently typed in the form. */
export function describeProduct(product: Product | null, context: Record<string, string> = {}): string {
  const icp = product?.icp;
  const saved: Record<string, string | undefined> = {
    name: product?.name,
    description: product?.generalInfo,
    salesStrategy: product?.salesStrategy,
    pricing: product?.pricing,
    targetIndustries: icp?.targetIndustries?.join(', '),
    companySizes: icp?.companySizes?.join(', '),
    geographies: icp?.geographies?.join(', '),
    fundingStages: icp?.fundingStages?.join(', '),
    icpNotes: icp?.notes,
  };
  const typed = Object.fromEntries(
    Object.entries(context)
      .slice(0, MAX_CONTEXT_FIELDS)
      .filter(([, value]) => typeof value === 'string' && value.trim())
      .map(([key, value]) => [key.slice(0, 40), value.trim().slice(0, MAX_TEXT_LENGTH)]),
  );
  return Object.entries({ ...saved, ...typed })
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

@Injectable()
export class ProductSuggestionsService {
  private readonly logger = new Logger(ProductSuggestionsService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly agent: ProductSuggestionAgent,
    private readonly draftAgent: ProductDraftAgent,
    private readonly exa: ExaService,
  ) {}

  async suggest(
    ctx: TenantContext,
    input: { name: string; website?: string; description?: string },
  ): Promise<ProductSuggestions> {
    const description = input.description?.trim();
    const website = input.website?.trim();
    if (!website && !description) {
      throw new BadRequestException('Add a website or a short description.');
    }

    const url = website ? normalizeWebsite(website) : null;
    if (website && !url) throw new BadRequestException('That website address does not look right.');

    const websiteText = url ? await this.readWebsite(url) : null;
    if (!websiteText && !description) {
      throw new BadRequestException('We could not read that website. Add a short description instead.');
    }

    try {
      const reply = await withTimeout(
        this.agent.suggest(ctx, { name: input.name, description, websiteText: websiteText ?? undefined }),
        AGENT_TIMEOUT_MS,
        'Product suggestion',
      );
      return parseSuggestions(reply);
    } catch (err) {
      this.logger.warn(`Product suggestion failed: ${(err as Error).message}`);
      throw new BadGatewayException('Could not get suggestions right now.');
    }
  }

  async draftField(
    ctx: TenantContext,
    input: { field: DraftField; productId?: string; context?: Record<string, string> },
  ): Promise<{ text: string }> {
    const { guidance, maxLength } = DRAFT_FIELDS[input.field];
    const facts = describeProduct(input.productId ? await this.loadProduct(ctx, input.productId) : null, input.context);
    if (!facts) throw new BadRequestException('Add a product name first.');

    try {
      const reply = await withTimeout(this.draftAgent.draft(ctx, facts, guidance), AGENT_TIMEOUT_MS, 'Field draft');
      const text = reply.trim();
      if (!text || text === 'Task failed.') throw new Error('empty reply');
      return { text: text.slice(0, maxLength) };
    } catch (err) {
      this.logger.warn(`Field draft failed: ${(err as Error).message}`);
      throw new BadGatewayException('Could not draft this right now.');
    }
  }

  private async loadProduct(ctx: TenantContext, id: string): Promise<Product> {
    const product = await this.em
      .fork()
      .findOne(Product, { id, organization: requireOrg(ctx).org.id }, { populate: ['icp'] });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /** A site that cannot be read is not fatal: the description may be enough. */
  private async readWebsite(url: string): Promise<string | null> {
    try {
      return await withTimeout(this.exa.getPageText(url), WEBSITE_TIMEOUT_MS, 'Website read');
    } catch (err) {
      this.logger.warn(`Could not read ${url}: ${(err as Error).message}`);
      return null;
    }
  }
}
