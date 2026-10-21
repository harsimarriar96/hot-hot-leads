import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { OrganizationTab } from './organization-tab';
import { MembersTab } from './members-tab';
import { ProfileTab } from './profile-tab';

const TABS = ['organization', 'members', 'profile'] as const;
type Tab = (typeof TABS)[number];

export function SettingsPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { activeOrg, can } = useAuth();
  const showMembers = can('members:read');
  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'organization';

  if (active === 'members' && !showMembers) return <Navigate to="/settings/organization" replace />;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-6">
      <header className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <span className="text-xs font-mono text-[var(--text-tertiary)] truncate">{activeOrg?.name ?? '—'}</span>
      </header>

      <Tabs value={active} onValueChange={(v) => navigate(`/settings/${v}`)}>
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          {showMembers && <TabsTrigger value="members">Members</TabsTrigger>}
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>
      </Tabs>

      {active === 'organization' && <OrganizationTab />}
      {active === 'members' && <MembersTab />}
      {active === 'profile' && <ProfileTab />}
    </div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-[var(--text)]">{children}</h2>;
}
