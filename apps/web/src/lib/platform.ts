import type { EntitlementsPatch, Invitation, PlatformOrganization, PlatformUser } from '@hothotleads/types';
import { apiJson, patchJson, postJson } from './http';

export const platformApi = {
  organizations: () => apiJson<PlatformOrganization[]>('/api/platform/organizations'),
  organization: (id: string) => apiJson<PlatformOrganization>(`/api/platform/organizations/${id}`),
  createOrganization: (body: { name: string; slug?: string; plan?: string; entitlements?: EntitlementsPatch }) =>
    postJson<PlatformOrganization>('/api/platform/organizations', body),
  updateOrganization: (id: string, body: { name?: string; slug?: string; plan?: string }) =>
    patchJson<PlatformOrganization>(`/api/platform/organizations/${id}`, body),
  updateEntitlements: (id: string, body: EntitlementsPatch) =>
    patchJson<PlatformOrganization>(`/api/platform/organizations/${id}/entitlements`, body),
  inviteOwner: (id: string, email: string) =>
    postJson<Invitation>(`/api/platform/organizations/${id}/invite-owner`, { email }),
  deleteOrganization: (id: string, confirmSlug: string) =>
    apiJson<unknown>(`/api/platform/organizations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmSlug }),
    }),
  users: () => apiJson<PlatformUser[]>('/api/platform/users'),
  resetLink: (userId: string) =>
    postJson<{ resetUrl: string; expiresAt: string }>(`/api/platform/users/${userId}/password-reset-link`, {}),
};
