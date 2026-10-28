import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { AppShell } from './components/app-shell';
import { LoginPage } from './pages/auth/login-page';
import { ResetPasswordPage } from './pages/auth/reset-password-page';
import { AcceptInvitePage } from './pages/auth/accept-invite-page';
import { ChatPage } from './pages/chat-page';
import { DashboardPage } from './pages/dashboard-page';
import { SettingsPage } from './pages/settings/settings-page';
import { SchedulesPage } from './pages/schedules-page';
import { ProductsListPage } from './pages/products/products-list-page';
import { ProductDetailPage } from './pages/products/product-detail-page';
import { OnboardingPending } from './pages/onboarding/onboarding-pending';
import { useOnboardingStatus } from './hooks/use-onboarding';
import { useAuth } from './hooks/use-auth';
import { Button } from './components/ui/button';
import { RequirePlatformAdmin } from './components/gate';
import { PlatformShell } from './pages/platform/platform-shell';
import { PlatformOrganizationsPage } from './pages/platform/organizations-page';
import { PlatformOrganizationDetailPage } from './pages/platform/organization-detail-page';
import { PlatformUsersPage } from './pages/platform/users-page';
import { HttpDeniedToasts } from './components/http-denied-toasts';

// Onboarding is loaded lazily — most users are post-onboarding and don't need this code.
const OnboardingShell = lazy(() =>
  import('./pages/onboarding/onboarding-shell').then((m) => ({ default: m.OnboardingShell })),
);
const StepWorkspaceDetails = lazy(() =>
  import('./pages/onboarding/step-workspace-details').then((m) => ({
    default: m.StepWorkspaceDetails,
  })),
);
const StepChannels = lazy(() =>
  import('./pages/onboarding/step-channels').then((m) => ({ default: m.StepChannels })),
);
const StepFirstProduct = lazy(() =>
  import('./pages/onboarding/step-first-product').then((m) => ({ default: m.StepFirstProduct })),
);

const PUBLIC_PATHS = ['/login', '/reset-password', '/accept-invite'];

function Screen({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 text-center ${
        tone === 'error' ? 'text-[var(--error)]' : 'text-[var(--text-tertiary)]'
      }`}
    >
      {children}
    </div>
  );
}

function AppRoutes() {
  const { data, isLoading, isError } = useOnboardingStatus();
  const { can } = useAuth();
  const location = useLocation();

  if (isLoading) return <Screen>Loading…</Screen>;
  if (isError) return <Screen tone="error">API unreachable. Is the server running?</Screen>;

  const isOnboardingRoute = location.pathname.startsWith('/onboarding');
  const status = data?.status;

  if (status !== 'completed') {
    // Only someone who can edit the organization runs the wizard; others wait.
    if (!can('org:update')) return <OnboardingPending />;
    if (!isOnboardingRoute) return <Navigate to="/onboarding" replace />;
  }

  if (status === 'completed' && isOnboardingRoute) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<Screen>Loading…</Screen>}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingShell />}>
          <Route index element={<Navigate to="/onboarding/workspace-details" replace />} />
          <Route path="workspace-details" element={<StepWorkspaceDetails />} />
          <Route path="channels" element={<StepChannels />} />
          <Route path="first-product" element={<StepFirstProduct />} />
        </Route>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/products" replace />} />
          <Route path="/products" element={<ProductsListPage />} />
          <Route path="/products/:productId" element={<ProductDetailPage />} />
          <Route path="/chat/:chatId?" element={<ChatPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/*" element={<Navigate to="/dashboard" replace />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:tab" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/products" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

/** A user with no organization at all: nothing to show until someone invites them. */
function NoOrganizationScreen() {
  const { user, signOut } = useAuth();
  return (
    <Screen>
      <div className="max-w-sm space-y-3">
        <p className="text-sm text-[var(--text)]">
          {user?.email} does not belong to any organization yet.
        </p>
        <p className="text-xs">Ask an organization owner for an invitation link, then open it while signed in.</p>
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </Screen>
  );
}

/** Several memberships and none active (first sign-in on this browser). */
function ChooseOrganizationScreen() {
  const { organizations, switchOrganization } = useAuth();
  return (
    <Screen>
      <div className="w-full max-w-sm space-y-3 text-left">
        <p className="text-sm font-medium text-[var(--text)]">Choose an organization</p>
        <ul className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
          {organizations.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => void switchOrganization(o.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
              >
                <span>{o.name}</span>
                <span className="text-xs text-[var(--text-tertiary)]">{o.role}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}

function PlatformRoutes() {
  return (
    <RequirePlatformAdmin>
      <Routes>
        <Route path="/platform" element={<PlatformShell />}>
          <Route index element={<PlatformOrganizationsPage />} />
          <Route path="organizations/:orgId" element={<PlatformOrganizationDetailPage />} />
          <Route path="users" element={<PlatformUsersPage />} />
        </Route>
      </Routes>
    </RequirePlatformAdmin>
  );
}

function PublicRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
    </Routes>
  );
}

/** Gate order: sign-in → organization → onboarding → app. */
function AuthGate() {
  const auth = useAuth();
  const location = useLocation();
  const path = location.pathname;

  if (auth.status === 'anonymous') {
    return PUBLIC_PATHS.includes(path) ? (
      <PublicRoutes />
    ) : (
      <Navigate to="/login" replace state={{ from: path }} />
    );
  }

  // Signed in: public pages redirect home, except an invite link, which may add a membership.
  // Rendered through the same element as the anonymous branch so the page is not remounted
  // (and its consumed token not re-fetched) when the token store updates mid-acceptance.
  if (path === '/accept-invite') return <PublicRoutes />;
  if (PUBLIC_PATHS.includes(path)) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && !PUBLIC_PATHS.includes(from) ? from : '/'} replace />;
  }

  if (auth.status === 'loading') return <Screen>Loading…</Screen>;
  if (auth.status === 'error') {
    return (
      <Screen tone="error">
        <div className="space-y-3">
          <p>API unreachable. Is the server running?</p>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={() => void auth.refresh()}>
              Retry
            </Button>
            <Button variant="ghost" onClick={() => void auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  // The platform console is org-independent, so it sits before the organization gate.
  if (path.startsWith('/platform')) return <PlatformRoutes />;

  if (!auth.activeOrg) {
    if (auth.isPlatformAdmin) return <Navigate to="/platform" replace />;
    if (auth.organizations.length === 0) return <NoOrganizationScreen />;
    return <ChooseOrganizationScreen />;
  }

  return <AppRoutes />;
}

export default function App() {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <HttpDeniedToasts />
      <AuthGate />
    </TooltipProvider>
  );
}
