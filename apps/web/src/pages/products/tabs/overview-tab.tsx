import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DraftField } from '@hothotleads/types';
import { AiDraft, draftToChips } from '@/components/ai-draft';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { ChipInput } from '@/components/ui/chip-input';
import { useToast } from '@/hooks/use-toast';
import { productsApi, type ProductDetail } from '@/lib/products';

interface Props {
  product: ProductDetail;
  onChanged: () => void;
  /** Viewers see the data but no Save / Add / Edit / Delete controls. */
  readOnly?: boolean;
}

export function ProductOverviewTab({ product, onChanged, readOnly = false }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(product.name);
  const [generalInfo, setGeneralInfo] = useState(product.generalInfo);
  const [salesStrategy, setSalesStrategy] = useState(product.salesStrategy);
  const [pricing, setPricing] = useState(product.pricing);

  const dirty =
    name !== product.name ||
    generalInfo !== product.generalInfo ||
    salesStrategy !== product.salesStrategy ||
    pricing !== product.pricing;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const draftContext = { name, description: generalInfo, salesStrategy, pricing };

  function bindSet<T>(setter: (v: T) => void) {
    return (v: T) => {
      if (error) setError(null);
      setter(v);
    };
  }

  async function saveBasics() {
    setSaving(true);
    setError(null);
    try {
      await productsApi.update(product.id, {
        name: name.trim(),
        generalInfo,
        salesStrategy,
        pricing,
      });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10 overflow-y-auto pb-6">
      <section className="space-y-3">
        <SectionHeading>Basics</SectionHeading>
        <div className="space-y-3">
          <FieldGroup>
            <Label htmlFor="pv-name">Name</Label>
            <Input
              id="pv-name"
              value={name}
              onChange={(e) => bindSet(setName)(e.target.value)}
              maxLength={80}
              disabled={readOnly}
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="pv-info">General info</Label>
            <AiDraft field="generalInfo" productId={product.id} value={generalInfo} onDraft={bindSet(setGeneralInfo)} context={draftContext} disabled={readOnly}>
              <textarea
                id="pv-info"
                rows={3}
                value={generalInfo}
                onChange={(e) => bindSet(setGeneralInfo)(e.target.value)}
                disabled={readOnly}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </AiDraft>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="pv-strategy">Sales strategy</Label>
            <AiDraft field="salesStrategy" productId={product.id} value={salesStrategy} onDraft={bindSet(setSalesStrategy)} context={draftContext} disabled={readOnly}>
              <textarea
                id="pv-strategy"
                rows={4}
                value={salesStrategy}
                onChange={(e) => bindSet(setSalesStrategy)(e.target.value)}
                disabled={readOnly}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </AiDraft>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="pv-pricing">Pricing</Label>
            <AiDraft field="pricing" productId={product.id} value={pricing} onDraft={bindSet(setPricing)} context={draftContext} disabled={readOnly}>
              <textarea
                id="pv-pricing"
                rows={3}
                value={pricing}
                onChange={(e) => bindSet(setPricing)(e.target.value)}
                disabled={readOnly}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </AiDraft>
          </FieldGroup>
          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
          {!readOnly && (
            <div className="flex justify-end">
              <Button onClick={saveBasics} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      </section>

      <AgentSection product={product} onChanged={onChanged} readOnly={readOnly} />
      <IcpSection product={product} onChanged={onChanged} readOnly={readOnly} />
      <ChildEditorSection
        product={product}
        onChanged={onChanged}
        readOnly={readOnly}
        kind="sales-channels"
        heading="Sales channels"
        items={product.salesChannels.map((c) => ({
          id: c.id,
          fields: { name: c.name, description: c.description, template: c.template ?? '' },
        }))}
        fieldKeys={['name', 'description', 'template']}
        fieldLabels={{ name: 'Name', description: 'Description', template: 'Template' }}
        draftFields={{ name: 'channelName', description: 'channelDescription', template: 'channelTemplate' }}
      />
      <ChildEditorSection
        product={product}
        onChanged={onChanged}
        readOnly={readOnly}
        kind="sources"
        heading="Sources"
        items={product.sources.map((s) => ({
          id: s.id,
          fields: { name: s.name, url: s.url, description: s.description, type: s.type },
        }))}
        fieldKeys={['name', 'url', 'description']}
        fieldLabels={{ name: 'Name', url: 'URL', description: 'Description' }}
        draftFields={{ name: 'sourceName', description: 'sourceDescription' }}
      />
      <ChildEditorSection
        product={product}
        onChanged={onChanged}
        readOnly={readOnly}
        kind="predefined-prospects"
        heading="Predefined prospects"
        items={product.predefinedProspects.map((p) => ({
          id: p.id,
          fields: {
            company: p.company,
            domain: p.domain,
            industry: p.industry,
            companySize: p.companySize,
            fundingStage: p.fundingStage,
            icpFitNotes: p.icpFitNotes,
          },
        }))}
        fieldKeys={['company', 'domain', 'industry', 'icpFitNotes']}
        fieldLabels={{
          company: 'Company',
          domain: 'Domain',
          industry: 'Industry',
          icpFitNotes: 'ICP fit notes',
        }}
        draftFields={{ industry: 'prospectIndustry', icpFitNotes: 'prospectFitNotes' }}
      />
    </div>
  );
}

function IcpSection({ product, onChanged, readOnly = false }: Props) {
  const initial = product.icp;
  const [industries, setIndustries] = useState<string[]>(initial?.targetIndustries ?? []);
  const [sizes, setSizes] = useState<string[]>(initial?.companySizes ?? []);
  const [stages, setStages] = useState<string[]>(initial?.fundingStages ?? []);
  const [geos, setGeos] = useState<string[]>(initial?.geographies ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const icpContext = {
    targetIndustries: industries.join(', '),
    companySizes: sizes.join(', '),
    geographies: geos.join(', '),
    fundingStages: stages.join(', '),
    icpNotes: notes,
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await productsApi.putIcp(product.id, {
        targetIndustries: industries,
        companySizes: sizes,
        fundingStages: stages,
        geographies: geos,
        notes: notes.trim() || undefined,
      });
      onChanged();
      toast.push({ message: 'ICP saved' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <SectionHeading>ICP</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <FieldGroup>
          <Label htmlFor="icp-industries">Target industries</Label>
          <AiDraft
            field="icpIndustries"
            productId={product.id}
            value={industries.join(', ')}
            onDraft={(text) => setIndustries(draftToChips(text))}
            context={icpContext}
            disabled={readOnly}
          >
            <ChipInput
              id="icp-industries"
              values={industries}
              onChange={setIndustries}
              placeholder="Add industry…"
              disabled={readOnly}
            />
          </AiDraft>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="icp-sizes">Company sizes</Label>
          <AiDraft
            field="icpSizes"
            productId={product.id}
            value={sizes.join(', ')}
            onDraft={(text) => setSizes(draftToChips(text))}
            context={icpContext}
            disabled={readOnly}
          >
            <ChipInput
              id="icp-sizes"
              values={sizes}
              onChange={setSizes}
              placeholder="Add company size…"
              disabled={readOnly}
            />
          </AiDraft>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="icp-stages">Funding stages</Label>
          <AiDraft
            field="icpStages"
            productId={product.id}
            value={stages.join(', ')}
            onDraft={(text) => setStages(draftToChips(text))}
            context={icpContext}
            disabled={readOnly}
          >
            <ChipInput
              id="icp-stages"
              values={stages}
              onChange={setStages}
              placeholder="Add funding stage…"
              disabled={readOnly}
            />
          </AiDraft>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="icp-geos">Geographies</Label>
          <AiDraft
            field="icpGeographies"
            productId={product.id}
            value={geos.join(', ')}
            onDraft={(text) => setGeos(draftToChips(text))}
            context={icpContext}
            disabled={readOnly}
          >
            <ChipInput
              id="icp-geos"
              values={geos}
              onChange={setGeos}
              placeholder="Add geography…"
              disabled={readOnly}
            />
          </AiDraft>
        </FieldGroup>
      </div>
      <FieldGroup>
        <Label htmlFor="icp-notes">Notes</Label>
        <AiDraft field="icpNotes" productId={product.id} value={notes} onDraft={setNotes} context={icpContext} disabled={readOnly}>
          <textarea
            id="icp-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={readOnly}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
            maxLength={2000}
          />
        </AiDraft>
      </FieldGroup>
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save ICP'}
          </Button>
        </div>
      )}
    </section>
  );
}

interface ChildItem {
  id: string;
  fields: Record<string, string | undefined>;
}

interface ChildEditorProps {
  product: ProductDetail;
  onChanged: () => void;
  readOnly?: boolean;
  kind: 'sales-channels' | 'sources' | 'predefined-prospects';
  heading: string;
  items: ChildItem[];
  fieldKeys: string[];
  fieldLabels: Record<string, string>;
  /** Fields the AI can draft. Facts such as URLs, domains and company names are left out. */
  draftFields: Partial<Record<string, DraftField>>;
}

function ChildEditorSection(props: ChildEditorProps) {
  const { product, onChanged, kind, heading, items, fieldKeys, fieldLabels, draftFields, readOnly = false } = props;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function add() {
    if (!draft.name && !draft.company) {
      setError('Name is required.');
      return;
    }
    try {
      await productsApi.addChild(product.id, kind, draft);
      setDraft({});
      setAdding(false);
      onChanged();
      toast.push({ message: `${heading.replace(/s$/, '')} added` });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      await productsApi.updateChild(product.id, kind, id, body);
      onChanged();
    } catch (err) {
      toast.push({ message: `Save failed: ${(err as Error).message}`, tone: 'danger' });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await productsApi.deleteChild(product.id, kind, id);
      onChanged();
    } catch (err) {
      toast.push({ message: `Delete failed: ${(err as Error).message}`, tone: 'danger' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeading>{heading}</SectionHeading>
        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        )}
      </div>

      {items.length === 0 && !adding && (
        <p className="text-sm text-[var(--text-tertiary)]">None yet.</p>
      )}

      {(items.length > 0 || adding) && (
        <ul className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
          {items.map((item) => (
            <ChildRow
              key={item.id}
              item={item}
              productId={product.id}
              fieldKeys={fieldKeys}
              fieldLabels={fieldLabels}
              draftFields={draftFields}
              busy={busyId === item.id}
              readOnly={readOnly}
              onSave={(body) => patch(item.id, body)}
              onDelete={() => remove(item.id)}
            />
          ))}
          {adding && (
            <li className="px-3 py-3 space-y-2 bg-[var(--surface-2)]">
              {fieldKeys.map((k) => (
                <FieldGroup key={k}>
                  <Label htmlFor={`add-${kind}-${k}`}>{fieldLabels[k] ?? k}</Label>
                  <ChildField
                    id={`add-${kind}-${k}`}
                    productId={product.id}
                    field={draftFields[k]}
                    value={draft[k] ?? ''}
                    context={draft}
                    onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}
                  />
                </FieldGroup>
              ))}
              {error && <p className="text-xs text-[var(--error)]">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAdding(false);
                    setDraft({});
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={add}>
                  Add
                </Button>
              </div>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function ChildField({
  id,
  productId,
  field,
  value,
  context,
  onChange,
}: {
  id: string;
  productId: string;
  field?: DraftField;
  value: string;
  context: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const input = <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />;
  if (!field) return input;
  // Prefixed so this item's "name" does not read as the product's name.
  const itemContext = Object.fromEntries(Object.entries(context).map(([k, v]) => [`item_${k}`, v]));
  return (
    <AiDraft field={field} productId={productId} value={value} onDraft={onChange} context={itemContext}>
      {input}
    </AiDraft>
  );
}

function ChildRow({
  item,
  productId,
  fieldKeys,
  fieldLabels,
  draftFields,
  busy,
  readOnly = false,
  onSave,
  onDelete,
}: {
  item: ChildItem;
  productId: string;
  fieldKeys: string[];
  fieldLabels: Record<string, string>;
  draftFields: Partial<Record<string, DraftField>>;
  busy: boolean;
  readOnly?: boolean;
  onSave: (body: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(fieldKeys.map((k) => [k, item.fields[k] ?? ''])),
  );
  const primary = item.fields[fieldKeys[0]] ?? '(unnamed)';
  const secondary = item.fields[fieldKeys[1]];

  if (!editing) {
    return (
      <li className="flex items-center gap-3 px-3 py-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{primary}</p>
          {secondary && (
            <p className="text-xs text-[var(--text-tertiary)] truncate">{secondary}</p>
          )}
        </div>
        {!readOnly && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={busy} aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </li>
    );
  }

  return (
    <li className="px-3 py-3 space-y-2 bg-[var(--surface-2)]">
      {fieldKeys.map((k) => (
        <FieldGroup key={k}>
          <Label htmlFor={`edit-${item.id}-${k}`}>{fieldLabels[k] ?? k}</Label>
          <ChildField
            id={`edit-${item.id}-${k}`}
            productId={productId}
            field={draftFields[k]}
            value={draft[k]}
            context={draft}
            onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}
          />
        </FieldGroup>
      ))}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            onSave(draft);
            setEditing(false);
          }}
        >
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </li>
  );
}

function AgentSection({ product, onChanged, readOnly = false }: Props) {
  const [tier, setTier] = useState(product.agentModelTier);
  const [extra, setExtra] = useState(product.agentExtraInstructions);
  const [strict, setStrict] = useState(product.icpStrictness);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    tier !== product.agentModelTier ||
    extra !== product.agentExtraInstructions ||
    strict !== product.icpStrictness;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await productsApi.update(product.id, {
        agentModelTier: tier,
        agentExtraInstructions: extra,
        icpStrictness: strict,
      });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <SectionHeading>Agent</SectionHeading>
      <p className="text-xs text-[var(--text-tertiary)] -mt-1">
        Per-product overrides applied to every chat run for this product.
      </p>

      <FieldGroup>
        <Label htmlFor="ag-tier">Model tier</Label>
        <div className="flex gap-2">
          {(['fast', 'default', 'heavy'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              disabled={readOnly}
              className={`h-8 flex-1 rounded-md border disabled:opacity-60 disabled:cursor-not-allowed text-xs font-mono uppercase tracking-[0.08em] transition-colors [@media(pointer:coarse)]:min-h-11 ${
                tier === t
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-soft-text)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          Fast = quicker responses, lower quality · Heavy = deeper reasoning, slower
        </p>
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="ag-strict">ICP strictness · {strict}</Label>
        <input
          id="ag-strict"
          type="range"
          min={0}
          max={100}
          step={5}
          value={strict}
          onChange={(e) => setStrict(Number(e.target.value))}
          disabled={readOnly}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between text-[10px] font-mono text-[var(--text-tertiary)]">
          <span>0 · loose</span>
          <span>50 · balanced</span>
          <span>100 · strict</span>
        </div>
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="ag-extra">Extra instructions</Label>
        <AiDraft field="agentInstructions" productId={product.id} value={extra} onDraft={setExtra} context={undefined} disabled={readOnly}>
          <textarea
            id="ag-extra"
            rows={4}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            disabled={readOnly}
            placeholder="e.g. prefer fintech in US/EU; deprioritise consumer; require recent funding round"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
            maxLength={4000}
          />
        </AiDraft>
        <p className="text-xs text-[var(--text-tertiary)]">
          Appended to every agent's system prompt for this product.
        </p>
      </FieldGroup>

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}

      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-[var(--text)]">{children}</h2>;
}
