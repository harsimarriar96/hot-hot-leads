import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { ProductSuggestions, SuggestionList } from '@hothotleads/types';

import { ProductSuggestionAgent } from '../../agents/product-suggestion/product-suggestion.agent';
import { ExaService } from '../../integrations/exa/exa.service';
import type { TenantContext } from '../auth/tenant-context';

const WEBSITE_TIMEOUT_MS = 10_000;
const AGENT_TIMEOUT_MS = 30_000;
const MAX_RECOMMENDED = 4;
const MAX_LIST_ITEMS = 8;
const MAX_VALUE_LENGTH = 60;
const MAX_TEXT_LENGTH = 2000;

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
    private readonly agent: ProductSuggestionAgent,
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
