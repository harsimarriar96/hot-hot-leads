/**
 * AI-drafted starting point for a new product (`POST /api/products/suggestions`).
 * `recommended` values start selected; `alternatives` are offered to tap.
 */

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
