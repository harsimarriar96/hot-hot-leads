import { useNavigate, useOutletContext } from 'react-router-dom';
import { NewProductFlow, type NewProductValues } from '@/components/new-product-flow';
import { onboardingApi } from '@/lib/onboarding';
import type { OnboardingOutletContext } from './onboarding-shell';

export function StepFirstProduct() {
  const { refreshStatus } = useOutletContext<OnboardingOutletContext>();
  const navigate = useNavigate();

  async function onSubmit(values: NewProductValues) {
    await onboardingApi.firstProduct(values);
    await refreshStatus();
    navigate('/', { replace: true });
  }

  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">First product</h1>
      <p className="mt-1 mb-6 text-sm text-[var(--text-secondary)]">
        A sketch is enough. Deepen from the Products page later.
      </p>
      <NewProductFlow
        submitLabel="Finish setup"
        cancelLabel="Back"
        onCancel={() => navigate('/onboarding/channels')}
        onSubmit={onSubmit}
      />
    </section>
  );
}
