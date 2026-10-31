import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import type { FeatureKey } from '@hothotleads/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FieldGroup, Label } from '@/components/ui/label';
import { GateHint, featureReason } from '@/components/gate';
import { useAuth } from '@/hooks/use-auth';

interface RunConfig {
  title: string;
  description: string;
  feature: FeatureKey;
  question: string;
  options: number[];
  defaultOption: number;
  optionLabel: (option: number) => string;
  focusPlaceholder: string;
  submitLabel: (option: number) => string;
  /** The orchestrator reads this like any chat message and maps it onto its tool inputs. */
  prompt: (productName: string, option: number, focus: string) => string;
}

const withFocus = (text: string, focus: string) => (focus ? `${text}. Focus: ${focus}` : text);

const RUNS = {
  leads: {
    title: 'Generate leads',
    description: 'The agents find companies that fit this product. The run opens in a new chat.',
    feature: 'discovery',
    question: 'How many leads?',
    options: [5, 10, 20],
    defaultOption: 5,
    optionLabel: String,
    focusPlaceholder: 'e.g. Series A fintech in Germany',
    submitLabel: (count) => `Generate ${count} leads`,
    prompt: (productName, count, focus) => withFocus(`generate ${count} leads for ${productName}`, focus),
  },
  signals: {
    title: 'Generate signals',
    description: 'The agents look for buying signals in your market. The run opens in a new chat.',
    feature: 'signals',
    question: 'How far back?',
    options: [7, 14, 30],
    defaultOption: 14,
    optionLabel: (days) => `${days} days`,
    focusPlaceholder: 'e.g. new compliance rules, sales hiring',
    submitLabel: () => 'Generate signals',
    prompt: (productName, days, focus) =>
      withFocus(`check signals for ${productName} from the last ${days} days`, focus),
  },
} satisfies Record<string, RunConfig>;

export function GenerateRunButton({
  kind,
  productName,
  onGenerate,
  variant,
}: {
  kind: keyof typeof RUNS;
  productName: string;
  onGenerate: (prompt: string) => void;
  variant: 'primary' | 'outline';
}) {
  const run: RunConfig = RUNS[kind];
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState(run.defaultOption);
  const [focus, setFocus] = useState('');
  const { can, hasFeature, activeOrg } = useAuth();
  if (!can('agents:run')) return null;
  const missing = !hasFeature(run.feature) ? run.feature : !hasFeature('chat') ? 'chat' : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    setOpen(false);
    onGenerate(run.prompt(productName, option, focus.trim()));
  }

  return (
    <>
      <GateHint reason={missing && featureReason(missing, activeOrg?.name)}>
        <Button variant={variant} size="sm" onClick={() => setOpen(true)} disabled={Boolean(missing)}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {run.title}
        </Button>
      </GateHint>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent width="sm">
          <DialogTitle>{run.title}</DialogTitle>
          <DialogDescription>{run.description}</DialogDescription>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <FieldGroup>
              <Label id={`${kind}-option`}>{run.question}</Label>
              <div role="group" aria-labelledby={`${kind}-option`} className="flex gap-2">
                {run.options.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={option === value}
                    autoFocus={option === value}
                    onClick={() => setOption(value)}
                    className={`h-9 flex-1 rounded-md border text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                      option === value
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-soft-text)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {run.optionLabel(value)}
                  </button>
                ))}
              </div>
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor={`${kind}-focus`}>Focus (optional)</Label>
              <Input
                id={`${kind}-focus`}
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder={run.focusPlaceholder}
                maxLength={200}
              />
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{run.submitLabel(option)}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
