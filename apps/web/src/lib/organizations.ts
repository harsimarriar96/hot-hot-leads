import type { Invitation, Member, OrganizationView, Role } from '@hothotleads/types';
import { apiJson, deleteJson, patchJson, postJson } from './http';

export const organizationApi = {
  get: () => apiJson<OrganizationView>('/api/organization'),
  members: () => apiJson<Member[]>('/api/organization/members'),
  updateRole: (userId: string, role: Role) => patchJson<Member>(`/api/organization/members/${userId}`, { role }),
  removeMember: (userId: string) => deleteJson(`/api/organization/members/${userId}`),
  resetLink: (userId: string) =>
    postJson<{ resetUrl: string; expiresAt: string }>(`/api/organization/members/${userId}/password-reset-link`, {}),
  invitations: () => apiJson<Invitation[]>('/api/organization/invitations'),
  invite: (body: { email: string; role: Role }) => postJson<Invitation>('/api/organization/invitations', body),
  /** The server only stores a hash, so "copy link" issues a fresh one. */
  regenerateInvite: (id: string) => postJson<Invitation>(`/api/organization/invitations/${id}/link`, {}),
  revokeInvite: (id: string) => deleteJson(`/api/organization/invitations/${id}`),
};
