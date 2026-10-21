/**
 * Tenancy, roles, permissions and entitlements shared by the API and the web app.
 */

export type Role = 'owner' | 'admin' | 'member' | 'viewer';
export const ROLES: readonly Role[] = ['owner', 'admin', 'member', 'viewer'];

export type Permission =
  | 'org:read'
  | 'org:update'
  | 'org:delete'
  | 'members:read'
  | 'members:invite'
  | 'members:manage'
  | 'products:read'
  | 'products:write'
  | 'products:delete'
  | 'leads:read'
  | 'leads:write'
  | 'signals:read'
  | 'signals:write'
  | 'outreach:read'
  | 'outreach:write'
  | 'feedback:read'
  | 'feedback:write'
  | 'chat:read'
  | 'chat:write'
  | 'schedules:read'
  | 'schedules:write'
  | 'channels:read'
  | 'channels:manage'
  | 'agents:run';

const VIEWER: Permission[] = [
  'org:read',
  'members:read',
  'products:read',
  'leads:read',
  'signals:read',
  'outreach:read',
  'feedback:read',
  'chat:read',
  'schedules:read',
  'channels:read',
];
const MEMBER: Permission[] = [
  ...VIEWER,
  'products:write',
  'leads:write',
  'signals:write',
  'outreach:write',
  'feedback:write',
  'chat:write',
  'schedules:write',
  'agents:run',
];
const ADMIN: Permission[] = [
  ...MEMBER,
  'products:delete',
  'members:invite',
  'members:manage',
  'channels:manage',
  'org:update',
];
const OWNER: Permission[] = [...ADMIN, 'org:delete'];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  viewer: new Set(VIEWER),
  member: new Set(MEMBER),
  admin: new Set(ADMIN),
  owner: new Set(OWNER),
};

export const hasPermission = (role: Role, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role].has(permission);

// ---- Entitlements ----------------------------------------------------------

export type FeatureKey =
  | 'discovery'
  | 'enrichment'
  | 'outreach'
  | 'signals'
  | 'buyingIntent'
  | 'schedules'
  | 'chat';

export const FEATURE_KEYS: readonly FeatureKey[] = [
  'discovery',
  'enrichment',
  'outreach',
  'signals',
  'buyingIntent',
  'schedules',
  'chat',
];

export type ChannelKey = 'telegram' | 'whatsapp';
export const CHANNEL_KEYS: readonly ChannelKey[] = ['telegram', 'whatsapp'];

export interface EntitlementLimits {
  maxProducts: number;
  maxMembers: number;
  maxLeadsPerMonth: number;
}

export interface Entitlements {
  features: Record<FeatureKey, boolean>;
  limits: EntitlementLimits;
  channels: ChannelKey[];
}

/** What is stored on the organization: a sparse override of the defaults. */
export interface EntitlementsPatch {
  features?: Partial<Record<FeatureKey, boolean>>;
  limits?: Partial<EntitlementLimits>;
  channels?: ChannelKey[];
}

/** Permissive defaults so an organization migrated from a single-tenant deploy loses nothing. */
export const DEFAULT_ENTITLEMENTS: Entitlements = {
  features: {
    discovery: true,
    enrichment: true,
    outreach: true,
    signals: true,
    buyingIntent: true,
    schedules: true,
    chat: true,
  },
  limits: { maxProducts: 25, maxMembers: 25, maxLeadsPerMonth: 5000 },
  channels: ['telegram', 'whatsapp'],
};

const clampInt = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
};

/** Merge a stored patch onto the defaults, dropping unknown keys and clamping limits to ints >= 0. */
export function resolveEntitlements(patch?: EntitlementsPatch | null): Entitlements {
  const features = { ...DEFAULT_ENTITLEMENTS.features };
  for (const key of FEATURE_KEYS) {
    const v = patch?.features?.[key];
    if (typeof v === 'boolean') features[key] = v;
  }
  const limits: EntitlementLimits = {
    maxProducts: clampInt(patch?.limits?.maxProducts, DEFAULT_ENTITLEMENTS.limits.maxProducts),
    maxMembers: clampInt(patch?.limits?.maxMembers, DEFAULT_ENTITLEMENTS.limits.maxMembers),
    maxLeadsPerMonth: clampInt(
      patch?.limits?.maxLeadsPerMonth,
      DEFAULT_ENTITLEMENTS.limits.maxLeadsPerMonth,
    ),
  };
  const channels = Array.isArray(patch?.channels)
    ? CHANNEL_KEYS.filter((c) => patch!.channels!.includes(c))
    : [...DEFAULT_ENTITLEMENTS.channels];
  return { features, limits, channels };
}

// ---- API shapes ------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  preferredChannel: ChannelKey | null;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: Role;
  onboardingStatus: string;
}

export interface ActiveOrganization extends OrganizationSummary {
  plan: string;
  timezone: string;
  defaultCurrency: string;
  /** True when a platform admin opened an organization they are not a member of. */
  supportMode: boolean;
}

export interface AuthMeResponse {
  user: AuthUser;
  organization: ActiveOrganization | null;
  role: Role | null;
  permissions: Permission[];
  entitlements: Entitlements;
  organizations: OrganizationSummary[];
}

export interface LoginResponse {
  token: string;
  me: AuthMeResponse;
}

export type DenialCode = 'permission_denied' | 'feature_disabled' | 'limit_reached' | 'no_organization';

export interface DenialBody {
  code: DenialCode;
  message: string;
  permission?: Permission;
  feature?: FeatureKey;
  limit?: keyof EntitlementLimits;
}

export interface Member {
  userId: string;
  email: string;
  name: string;
  role: Role;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  /** Present only on the response that created or regenerated the link; the server stores a hash. */
  inviteUrl?: string;
}

export interface OrganizationView {
  id: string;
  name: string;
  slug: string;
  plan: string;
  timezone: string;
  defaultCurrency: string;
  onboardingStatus: string;
  entitlements: Entitlements;
  memberCount: number;
  productCount: number;
  createdAt: string;
}

export interface PlatformOrganization extends OrganizationView {
  /** The raw stored patch, for the entitlements editor. */
  entitlementsPatch: EntitlementsPatch;
}

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  memberships: { organizationId: string; organizationName: string; role: Role }[];
}
