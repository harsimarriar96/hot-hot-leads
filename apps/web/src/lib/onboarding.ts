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

async function postJSON(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      (parsed && (parsed.message || parsed.error)) || `${res.status} ${res.statusText}`;
    const err = new Error(Array.isArray(msg) ? msg.join('; ') : String(msg));
    (err as { status?: number }).status = res.status;
    (err as { body?: unknown }).body = parsed;
    throw err;
  }
  return parsed;
}

async function patchJSON(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const onboardingApi = {
  status: async (): Promise<OnboardingView> => {
    const res = await fetch('/onboarding');
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },
  workspaceDetails: (body: { name: string; timezone: string; defaultCurrency?: string }) =>
    postJSON('/onboarding/workspace-details', body),
  operatorProfile: (body: {
    name: string;
    email: string;
    preferredChannel: 'telegram' | 'whatsapp';
  }) => postJSON('/onboarding/operator-profile', body),
  channels: (body: {
    telegram?: { botToken: string; webhookSecret?: string };
    whatsapp?: { phoneNumberId: string; accessToken: string; verifyToken: string };
  }) => postJSON('/onboarding/channels', body),
  firstProduct: (body: {
    name: string;
    generalInfo?: string;
    icp: {
      targetIndustries: string[];
      companySizes: string[];
      geographies: string[];
      notes?: string;
    };
  }) => postJSON('/onboarding/first-product', body),
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
  get: async (): Promise<SettingsView> => {
    const res = await fetch('/settings');
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },
  updateWorkspace: (body: { name?: string; timezone?: string; defaultCurrency?: string }) =>
    patchJSON('/settings/workspace', body),
  updateOperator: (body: {
    name?: string;
    email?: string;
    preferredChannel?: 'telegram' | 'whatsapp';
  }) => patchJSON('/settings/operator', body),
};
