import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { AppShell } from './components/app-shell';
import { ChatPage } from './pages/chat-page';
import { DashboardPage } from './pages/dashboard-page';
import { SettingsPage } from './pages/settings-page';
import { SchedulesPage } from './pages/schedules-page';
import { ProductsListPage } from './pages/products/products-list-page';
import { ProductDetailPage } from './pages/products/product-detail-page';
import { useOnboardingStatus } from './hooks/use-onboarding';

// Onboarding is loaded lazily — most users are post-onboarding and don't need this code.
const OnboardingShell = lazy(() =>
  import('./pages/onboarding/onboarding-shell').then((m) => ({ default: m.OnboardingShell })),
);
const StepWorkspaceDetails = lazy(() =>
  import('./pages/onboarding/step-workspace-details').then((m) => ({
    default: m.StepWorkspaceDetails,
  })),
);
const StepOperatorProfile = lazy(() =>
  import('./pages/onboarding/step-operator-profile').then((m) => ({
    default: m.StepOperatorProfile,
  })),
);
const StepChannels = lazy(() =>
  import('./pages/onboarding/step-channels').then((m) => ({ default: m.StepChannels })),
);
const StepFirstProduct = lazy(() =>
  import('./pages/onboarding/step-first-product').then((m) => ({ default: m.StepFirstProduct })),
);

function AppRoutes() {
  const { data, isLoading, isError } = useOnboardingStatus();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--text-tertiary)]">
        Loading…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--error)]">
        API unreachable. Is the server running?
      </div>
    );
  }

  const isOnboardingRoute = location.pathname.startsWith('/onboarding');
  const status = data?.status;

  if (status !== 'completed' && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  if (status === 'completed' && isOnboardingRoute) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-[var(--text-tertiary)]">
          Loading…
        </div>
      }
    >
      <Routes>
        <Route path="/onboarding" element={<OnboardingShell />}>
          <Route index element={<Navigate to="/onboarding/workspace-details" replace />} />
          <Route path="workspace-details" element={<StepWorkspaceDetails />} />
          <Route path="operator-profile" element={<StepOperatorProfile />} />
          <Route path="channels" element={<StepChannels />} />
          <Route path="first-product" element={<StepFirstProduct />} />
        </Route>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/products" replace />} />
          <Route path="/products" element={<ProductsListPage />} />
          <Route path="/products/:productId" element={<ProductDetailPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/:tab" element={<DashboardPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/products" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <AppRoutes />
    </TooltipProvider>
  );
}
