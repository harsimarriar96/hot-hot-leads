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
    operator_profile?: { name: string; email: string; preferredChannel: 'telegram' | 'whatsapp' };
    channels?: { channel: 'telegram' | 'whatsapp'; configured: boolean; updatedAt: string }[];
    first_product?: { name: string };
  };
}

export const onboardingApi = {
  status: () => apiJson<OnboardingView>('/api/onboarding'),
  workspaceDetails: (body: { name: string; timezone: string; defaultCurrency?: string }) =>
    postJson('/api/onboarding/workspace-details', body),
  operatorProfile: (body: {
    name: string;
    email: string;
    preferredChannel: 'telegram' | 'whatsapp';
  }) => postJson('/api/onboarding/operator-profile', body),
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
      notes?: string;
    };
  }) => postJson('/api/onboarding/first-product', body),
};

export interface SettingsView {
  workspace: {
    id: string;
    name: string;
    timezone: string;
    defaultCurrency: string;
    createdAt: string;
    updatedAt: string;
  };
  operator: {
    id: string;
    name: string;
    email: string;
    preferredChannel: 'telegram' | 'whatsapp';
  } | null;
  channels: { channel: 'telegram' | 'whatsapp'; configured: boolean; updatedAt: string }[];
}

export const settingsApi = {
  get: () => apiJson<SettingsView>('/api/settings'),
  updateWorkspace: (body: { name?: string; timezone?: string; defaultCurrency?: string }) =>
    patchJson('/api/settings/workspace', body),
  updateOperator: (body: {
    name?: string;
    email?: string;
    preferredChannel?: 'telegram' | 'whatsapp';
  }) => patchJson('/api/settings/operator', body),
};
