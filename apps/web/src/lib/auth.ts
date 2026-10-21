import type { AuthMeResponse, LoginResponse, Role } from '@hothotleads/types';
import { HttpError, apiJson, getOrgId, patchJson, postJson, setOrgId } from './http';

export interface InvitationDescription {
  email: string;
  organization: { id: string; name: string };
  role: Role;
  invitedBy: string | null;
  existingUser: boolean;
}

export type AcceptInviteResponse =
  | LoginResponse
  | { requiresLogin: true; email: string; organization: { id: string; name: string } };

export const authApi = {
  login: (body: { email: string; password: string }) => postJson<LoginResponse>('/api/auth/login', body),
  logout: () => apiJson<unknown>('/api/auth/logout', { method: 'POST' }),
  /** Tolerates a stale remembered organization: clears it and retries once without the header. */
  me: async (): Promise<AuthMeResponse> => {
    try {
      return await apiJson<AuthMeResponse>('/api/auth/me');
    } catch (err) {
      if (err instanceof HttpError && (err.status === 403 || err.status === 404) && getOrgId()) {
        setOrgId(null);
        return apiJson<AuthMeResponse>('/api/auth/me');
      }
      throw err;
    }
  },
  updateMe: (body: { name?: string; preferredChannel?: 'telegram' | 'whatsapp' | null }) =>
    patchJson<AuthMeResponse>('/api/auth/me', body),
  switchOrg: (organizationId: string) => postJson<AuthMeResponse>('/api/auth/switch-org', { organizationId }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    postJson<unknown>('/api/auth/change-password', body),
  invitation: (token: string) =>
    apiJson<InvitationDescription>(`/api/auth/invitation?token=${encodeURIComponent(token)}`),
  acceptInvite: (body: { token: string; name?: string; password?: string }) =>
    postJson<AcceptInviteResponse>('/api/auth/accept-invite', body),
  resetPassword: (body: { token: string; password: string }) =>
    postJson<{ ok: true }>('/api/auth/reset-password', body),
};
