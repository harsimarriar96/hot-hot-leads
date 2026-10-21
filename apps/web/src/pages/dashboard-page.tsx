import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { KpiStrip } from '@/components/dashboard/kpi-strip';
import { LeadsTable } from '@/components/dashboard/leads-table';
import { SignalsTable } from '@/components/dashboard/signals-table';
import { SignalsTimeline } from '@/components/dashboard/signals-timeline';
import { OutreachTable } from '@/components/dashboard/outreach-table';
import { FeedbackTable } from '@/components/dashboard/feedback-table';
import { FeedbackSparkline } from '@/components/dashboard/feedback-sparkline';
import { useCurrentProduct } from '@/hooks/use-product';
import { useAuth } from '@/hooks/use-auth';
import { featureReason } from '@/components/gate';
import { TooltipHint } from '@/components/ui/tooltip-hint';

const TABS = ['leads', 'signals', 'outreach', 'feedback'] as const;
type Tab = (typeof TABS)[number];

export function DashboardPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { current } = useCurrentProduct();
  const { hasFeature, activeOrg } = useAuth();
  const enabled: Record<Tab, boolean> = {
    leads: true,
    signals: hasFeature('signals'),
    outreach: hasFeature('outreach'),
    feedback: true,
  };
  const requested: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'leads';
  const active: Tab = enabled[requested] ? requested : 'leads';
  const [signalsView, setSignalsView] = useState<'timeline' | 'list'>('timeline');

  return (
    <div className="flex flex-col h-full min-h-0">
      <KpiStrip product={current} features={{ signals: enabled.signals, outreach: enabled.outreach }} />
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-[var(--border)]">
        <Tabs
          value={active}
          onValueChange={(v) => navigate(`/dashboard/${v}`)}
          className="min-w-0"
        >
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <GatedTab value="signals" enabled={enabled.signals} reason={featureReason('signals', activeOrg?.name)}>
              Signals
            </GatedTab>
            <GatedTab value="outreach" enabled={enabled.outreach} reason={featureReason('outreach', activeOrg?.name)}>
              Outreach
            </GatedTab>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="hidden md:block font-mono text-[11px] text-[var(--text-tertiary)] tabular-nums truncate">
          {current ?? 'No product'}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs value={active}>
          <TabsContent value="leads">
            <LeadsTable product={current} />
          </TabsContent>
          <TabsContent value="signals">
            <div className="flex items-center justify-end gap-1 px-4 md:px-6 pt-3 pb-1">
              {(['timeline', 'list'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSignalsView(v)}
                  className={`px-2 py-0.5 text-xs font-mono rounded border transition-colors ${
                    signalsView === v
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--text)]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            {signalsView === 'timeline' ? (
              <SignalsTimeline product={current} />
            ) : (
              <SignalsTable product={current} />
            )}
          </TabsContent>
          <TabsContent value="outreach">
            <OutreachTable product={current} />
          </TabsContent>
          <TabsContent value="feedback">
            <FeedbackSparkline product={current} />
            <FeedbackTable product={current} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function GatedTab({
  value,
  enabled,
  reason,
  children,
}: {
  value: Tab;
  enabled: boolean;
  reason: string;
  children: React.ReactNode;
}) {
  if (enabled) return <TabsTrigger value={value}>{children}</TabsTrigger>;
  return (
    <TooltipHint label={reason}>
      <span className="inline-flex" tabIndex={0}>
        <TabsTrigger value={value} disabled className="opacity-50">
          {children}
        </TabsTrigger>
      </span>
    </TooltipHint>
  );
}
