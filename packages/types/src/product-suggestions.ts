/**
 * AI-drafted starting point for a new product (`POST /api/products/suggestions`).
 * `recommended` values start selected; `alternatives` are offered to tap.
 */

/** Fields the AI can draft on request (`POST /api/products/draft-field`). */
export type DraftField =
  | 'generalInfo'
  | 'salesStrategy'
  | 'pricing'
  | 'agentInstructions'
  | 'icpNotes'
  | 'icpIndustries'
  | 'icpSizes'
  | 'icpStages'
  | 'icpGeographies'
  | 'channelName'
  | 'channelDescription'
  | 'channelTemplate'
  | 'sourceName'
  | 'sourceDescription'
  | 'prospectIndustry'
  | 'prospectFitNotes';

export interface SuggestionList {
  recommended: string[];
  alternatives: string[];
}

export interface ProductSuggestions {
  generalInfo: string;
  icpNotes: string;
  targetIndustries: SuggestionList;
  companySizes: SuggestionList;
  geographies: SuggestionList;
  fundingStages: SuggestionList;
}
