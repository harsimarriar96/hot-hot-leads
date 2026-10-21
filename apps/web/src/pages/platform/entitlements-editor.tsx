import { useState } from 'react';
import { CHANNEL_KEYS, FEATURE_KEYS, type EntitlementsPatch, type PlatformOrganization } from '@hothotleads/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { FEATURE_LABELS } from '@/components/gate';

const LIMITS = [
  { key: 'maxProducts', label: 'Max products' },
  { key: 'maxMembers', label: 'Max members (incl. pending invites)' },
  { key: 'maxLeadsPerMonth', label: 'Max new leads per UTC month' },
] as const;

/** Edits the full resolved entitlements and saves them back as the stored patch. */
export function EntitlementsEditor({
  org,
  onSave,
  saving,
}: {
  org: PlatformOrganization;
  onSave: (patch: EntitlementsPatch) => void;
  saving: boolean;
}) {
  const [features, setFeatures] = useState({ ...org.entitlements.features });
  const [limits, setLimits] = useState({ ...org.entitlements.limits });
  const [channels, setChannels] = useState<string[]>([...org.entitlements.channels]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-[0.04em] text-[var(--text-tertiary)]">Features</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FEATURE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                checked={features[key]}
                onChange={(e) => setFeatures({ ...features, [key]: e.target.checked })}
              />
              {FEATURE_LABELS[key]}
              {key === 'schedules' && (
                <span className="text-[10px] text-[var(--text-tertiary)]">(also needs SCHEDULES_ENABLED on the server)</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {LIMITS.map(({ key, label }) => (
          <FieldGroup key={key}>
            <Label htmlFor={`lim-${key}`}>{label}</Label>
            <Input
              id={`lim-${key}`}
              type="number"
              min={0}
              step={1}
              value={limits[key]}
              onChange={(e) => setLimits({ ...limits, [key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
          </FieldGroup>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-[0.04em] text-[var(--text-tertiary)]">Allowed channels</p>
        <div className="flex gap-4">
          {CHANNEL_KEYS.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm capitalize">
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                checked={channels.includes(c)}
                onChange={(e) => setChannels(e.target.checked ? [...channels, c] : channels.filter((x) => x !== c))}
              />
              {c}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={saving}
          onClick={() => onSave({ features, limits, channels: channels as EntitlementsPatch['channels'] })}
        >
          {saving ? 'Saving…' : 'Save entitlements'}
        </Button>
      </div>
    </div>
  );
}
