export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  generalInfo: string;
  createdAt: string;
  updatedAt: string;
  leadCount: number;
  activeSignalCount: number;
  lastChatActivityAt: string | null;
}

export type AgentModelTier = 'fast' | 'default' | 'heavy';

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  generalInfo: string;
  salesStrategy: string;
  pricing: string;
  agentModelTier: AgentModelTier;
  agentExtraInstructions: string;
  icpStrictness: number;
  icp: {
    targetIndustries: string[];
    companySizes: string[];
    geographies: string[];
    fundingStages: string[];
    notes: string;
  } | null;
  salesChannels: Array<{ id: string; name: string; description: string; template: string | null }>;
  sources: Array<{ id: string; name: string; url: string; description: string; type: string }>;
  predefinedProspects: Array<{
    id: string;
    company: string;
    domain: string;
    industry: string;
    companySize: string;
    fundingStage: string;
    icpFitNotes: string;
  }>;
}

import type { ProductSuggestions } from '@hothotleads/types';
import { apiJson, deleteJson, postJson } from './http';

const jsonOrThrow = apiJson;

export const productsApi = {
  list: () => jsonOrThrow<ProductSummary[]>('/api/products'),
  get: (id: string) => jsonOrThrow<ProductDetail>(`/api/products/${id}`),
  create: (body: {
    name: string;
    generalInfo?: string;
    icp: {
      targetIndustries: string[];
      companySizes: string[];
      geographies: string[];
      fundingStages: string[];
      notes?: string;
    };
  }) =>
    jsonOrThrow<{ id: string; name: string; slug: string }>(`/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  suggest: (body: { name: string; website?: string; description?: string }) =>
    postJson<ProductSuggestions>('/api/products/suggestions', body),
  update: (
    id: string,
    body: {
      name?: string;
      generalInfo?: string;
      salesStrategy?: string;
      pricing?: string;
      agentModelTier?: AgentModelTier;
      agentExtraInstructions?: string;
      icpStrictness?: number;
    },
  ) =>
    jsonOrThrow<{ id: string; name: string }>(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  delete: async (id: string) => {
    await deleteJson(`/api/products/${id}`);
  },
  putIcp: (
    id: string,
    body: {
      targetIndustries: string[];
      companySizes: string[];
      fundingStages: string[];
      geographies: string[];
      notes?: string;
    },
  ) =>
    jsonOrThrow(`/api/products/${id}/icp`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  addChild: (
    id: string,
    kind: 'sales-channels' | 'sources' | 'predefined-prospects',
    body: Record<string, unknown>,
  ) =>
    jsonOrThrow<{ id: string }>(`/api/products/${id}/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateChild: (
    id: string,
    kind: 'sales-channels' | 'sources' | 'predefined-prospects',
    childId: string,
    body: Record<string, unknown>,
  ) =>
    jsonOrThrow(`/api/products/${id}/${kind}/${childId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteChild: async (
    id: string,
    kind: 'sales-channels' | 'sources' | 'predefined-prospects',
    childId: string,
  ) => {
    await deleteJson(`/api/products/${id}/${kind}/${childId}`);
  },
};

export const adminApi = {
  /** Seed a rich demo scenario into the active organization. */
  demoSeed: () =>
    apiJson<{ productId: string; counts: Record<string, number> }>('/api/admin/demo-seed', {
      method: 'POST',
    }),
};
