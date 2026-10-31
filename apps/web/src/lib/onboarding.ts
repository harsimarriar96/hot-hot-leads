import { apiJson, patchJson, postJson } from './http';

export type OnboardingStatus =
  | 'pending'
  | 'workspace_details'
  | 'operator_profile'
  | 'channels'
  | 'first_product'
  | 'completed';

export interface OnboardingView {
  status: OnboardingStatus;
  currentStep: OnboardingStatus;
  completedSteps: OnboardingStatus[];
  data: {
    workspace_details?: { name: string; timezone: string; defaultCurrency: string };
    channels?: { channel: 'telegram' | 'whatsapp'; configured: boolean; updatedAt: string }[];
    first_product?: { name: string };
  };
}

export const onboardingApi = {
  status: () => apiJson<OnboardingView>('/api/onboarding'),
  workspaceDetails: (body: { name: string; timezone: string; defaultCurrency?: string }) =>
    postJson('/api/onboarding/workspace-details', body),
  channels: (body: {
    telegram?: { botToken: string; webhookSecret?: string };
    whatsapp?: { phoneNumberId: string; accessToken: string; verifyToken: string };
  }) => postJson('/api/onboarding/channels', body),
  firstProduct: (body: {
    name: string;
    generalInfo?: string;
    icp: {
      targetIndustries: string[];
      companySizes: string[];
      geographies: string[];
      fundingStages: string[];
      notes?: string;
    };
  }) => postJson('/api/onboarding/first-product', body),
};

export interface SettingsView {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    timezone: string;
    defaultCurrency: string;
    createdAt: string;
    updatedAt: string;
  };
  profile: {
    id: string;
    name: string;
    email: string;
    preferredChannel: 'telegram' | 'whatsapp' | null;
  };
  channels: { channel: 'telegram' | 'whatsapp'; configured: boolean; updatedAt: string }[];
}

export const settingsApi = {
  get: () => apiJson<SettingsView>('/api/settings'),
  updateOrganization: (body: { name?: string; timezone?: string; defaultCurrency?: string }) =>
    patchJson('/api/settings/organization', body),
  updateProfile: (body: { name?: string; preferredChannel?: 'telegram' | 'whatsapp' | null }) =>
    patchJson('/api/settings/profile', body),
};
