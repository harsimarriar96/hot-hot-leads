import { Building2, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from './ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

/** Sits at the top of the sidebar: the organization is the outermost context. */
export function OrgSwitcher({ className }: { className?: string }) {
  const { activeOrg, organizations, isSupportMode, switchOrganization } = useAuth();
  const navigate = useNavigate();
  if (!activeOrg) return null;

  const options = isSupportMode
    ? [{ id: activeOrg.id, name: activeOrg.name, role: activeOrg.role }, ...organizations]
    : organizations;
  const switchable = options.length > 1;

  const inner = (
    <>
      <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">{activeOrg.name}</span>
      <Badge variant={isSupportMode ? 'accent' : 'neutral'}>{isSupportMode ? 'support' : activeOrg.role}</Badge>
      {switchable && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />}
    </>
  );

  if (!switchable) {
    return <div className={cn('flex h-9 items-center gap-2 px-2.5', className)}>{inner}</div>;
  }

  return (
    <label
      className={cn(
        'group relative flex h-9 cursor-pointer items-center gap-2 rounded-md px-2.5',
        'hover:bg-[var(--surface-hover)] focus-within:ring-2 focus-within:ring-[var(--ring)]',
        className,
      )}
    >
      {inner}
      <select
        value={activeOrg.id}
        aria-label="Switch organization"
        onChange={(e) => {
          const id = e.target.value;
          if (id === activeOrg.id) return;
          void switchOrganization(id).then(() => navigate('/products'));
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
