import { FormEvent, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { DraftField, ProductSuggestions, SuggestionList } from '@hothotleads/types';
import { AiDraft, draftToChips } from '@/components/ai-draft';
import { Button } from '@/components/ui/button';
import { ChipInput } from '@/components/ui/chip-input';
import { Input, Textarea } from '@/components/ui/input';
import { FieldGroup, Label } from '@/components/ui/label';
import { HttpError } from '@/lib/http';
import { productsApi } from '@/lib/products';

export interface NewProductValues {
  name: string;
  generalInfo?: string;
  icp: {
    targetIndustries: string[];
    companySizes: string[];
    geographies: string[];
    fundingStages: string[];
    notes?: string;
  };
}

type ListField = 'targetIndustries' | 'companySizes' | 'geographies' | 'fundingStages';
type Lists = Record<ListField, string[]>;

const LIST_FIELDS: Array<{ key: ListField; label: string; draft: DraftField }> = [
  { key: 'targetIndustries', label: 'Target industries', draft: 'icpIndustries' },
  { key: 'companySizes', label: 'Company sizes', draft: 'icpSizes' },
  { key: 'geographies', label: 'Regions', draft: 'icpGeographies' },
  { key: 'fundingStages', label: 'Funding stages', draft: 'icpStages' },
];

const EMPTY_LISTS: Lists = { targetIndustries: [], companySizes: [], geographies: [], fundingStages: [] };

// Offered when there are no AI suggestions to show.
const STANDARD_OPTIONS: Lists = {
  ...EMPTY_LISTS,
  companySizes: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
  fundingStages: ['Bootstrapped', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Public'],
};

const mapLists = (s: ProductSuggestions, pick: (list: SuggestionList) => string[]): Lists => ({
  targetIndustries: pick(s.targetIndustries),
  companySizes: pick(s.companySizes),
  geographies: pick(s.geographies),
  fundingStages: pick(s.fundingStages),
});

/** The two-step "add a product" journey, shared by the products page and onboarding. */
export function NewProductFlow({
  onSubmit,
  onCancel,
  cancelLabel,
  submitLabel,
}: {
  onSubmit: (values: NewProductValues) => Promise<void>;
  onCancel: () => void;
  cancelLabel: string;
  submitLabel: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [generalInfo, setGeneralInfo] = useState('');
  const [notes, setNotes] = useState('');
  const [lists, setLists] = useState<Lists>(EMPTY_LISTS);
  const [options, setOptions] = useState<Lists>(STANDARD_OPTIONS);
  const [suggestionsFailed, setSuggestionsFailed] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  // Going back and forward without changing anything must not replace the user's review edits.
  const suggestedFor = useRef<string | null>(null);

  const trimmedName = name.trim();
  const inputKey = JSON.stringify([trimmedName, website.trim(), description.trim()]);
  const canSuggest = Boolean(trimmedName && (website.trim() || description.trim()));

  const draftContext = {
    name: trimmedName,
    description: generalInfo || description,
    website,
    targetIndustries: lists.targetIndustries.join(', '),
    notes,
  };

  const suggest = useMutation({
    mutationFn: () =>
      productsApi.suggest({
        name: trimmedName,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: (s) => {
      suggestedFor.current = inputKey;
      setGeneralInfo(s.generalInfo || description.trim());
      setNotes(s.icpNotes);
      setLists(mapLists(s, (l) => l.recommended));
      setOptions(mapLists(s, (l) => [...l.recommended, ...l.alternatives]));
      setSuggestionsFailed(false);
      setStep(2);
    },
    onError: (err) => {
      // A 400 means the input needs fixing; anything else should not block the user.
      if (err instanceof HttpError && err.status === 400) {
        setInputError(err.message);
        return;
      }
      setSuggestionsFailed(true);
      fillInManually();
    },
  });

  const create = useMutation({
    mutationFn: () =>
      onSubmit({
        name: trimmedName,
        generalInfo: generalInfo.trim() || undefined,
        icp: { ...lists, notes: notes.trim() || undefined },
      }),
  });

  function fillInManually() {
    setGeneralInfo((current) => current || description.trim());
    setStep(2);
  }

  function submitDetails(e: FormEvent) {
    e.preventDefault();
    if (!canSuggest || suggest.isPending) return;
    setInputError(null);
    if (inputKey === suggestedFor.current) setStep(2);
    else suggest.mutate();
  }

  function submitReview(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  if (step === 1) {
    return (
      <form onSubmit={submitDetails} className="space-y-4">
        <StepHeading step={1} title="What are you selling?" hint="We'll suggest who to sell it to. You can change anything." />
        <FieldGroup>
          <Label htmlFor="np-name" required>
            Product name
          </Label>
          <Input
            id="np-name"
            required
            autoFocus
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Copilot"
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="np-website">Website</Label>
          <Input
            id="np-website"
            maxLength={300}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="acme.com"
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="np-description">Or describe it in a line</Label>
          <Input
            id="np-description"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="An AI copilot for finance teams"
          />
        </FieldGroup>
        {inputError && <p className="text-sm text-[var(--error)]">{inputError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={fillInManually} disabled={!trimmedName || suggest.isPending}>
              Fill it in myself
            </Button>
            <Button type="submit" variant="primary" disabled={!canSuggest || suggest.isPending}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {suggest.isPending ? (website.trim() ? 'Reading your website…' : 'Thinking…') : 'Suggest my ICP'}
            </Button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitReview} className="space-y-4">
      <StepHeading step={2} title={`Who should ${trimmedName} be sold to?`} hint="Tap to add, or type your own." />
      {suggestionsFailed && (
        <p className="text-sm text-[var(--text-secondary)]">Couldn't get suggestions, you can fill this in yourself.</p>
      )}
      <FieldGroup>
        <Label htmlFor="np-info">Description</Label>
        <AiDraft field="generalInfo" value={generalInfo} onDraft={setGeneralInfo} context={draftContext}>
          <Textarea
            id="np-info"
            rows={3}
            maxLength={2000}
            value={generalInfo}
            onChange={(e) => setGeneralInfo(e.target.value)}
            placeholder="One line on what it is."
          />
        </AiDraft>
      </FieldGroup>
      {LIST_FIELDS.map(({ key, label, draft }) => (
        <FieldGroup key={key}>
          <Label htmlFor={`np-${key}`}>{label}</Label>
          <AiDraft
            field={draft}
            value={lists[key].join(', ')}
            onDraft={(text) => setLists((current) => ({ ...current, [key]: draftToChips(text) }))}
            context={draftContext}
          >
            <ChipInput
              id={`np-${key}`}
              values={lists[key]}
              onChange={(next) => setLists((current) => ({ ...current, [key]: next }))}
              suggestions={options[key]}
              placeholder="Type to add your own"
            />
          </AiDraft>
        </FieldGroup>
      ))}
      <FieldGroup>
        <Label htmlFor="np-notes">Notes on your ideal customer</Label>
        <AiDraft field="icpNotes" value={notes} onDraft={setNotes} context={draftContext}>
          <Textarea
            id="np-notes"
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Who buys, what triggers it, who to avoid."
          />
        </AiDraft>
      </FieldGroup>
      {create.isError && <p className="text-sm text-[var(--error)]">{(create.error as Error).message}</p>}
      <div className="flex items-center justify-between gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={create.isPending}>
          Back
        </Button>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function StepHeading({ step, title, hint }: { step: 1 | 2; title: string; hint: string }) {
  return (
    <div>
      <p className="text-xs font-mono text-[var(--text-tertiary)]">Step {step} of 2</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text)]">{title}</h2>
      <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{hint}</p>
    </div>
  );
}
