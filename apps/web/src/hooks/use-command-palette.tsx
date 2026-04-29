import { Command } from 'cmdk';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { productsApi, type ProductSummary } from '@/lib/products';
import { useTheme } from './use-theme';
import {
  Dialog,
  DialogContent,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';

interface CommandPaletteStore {
  open: boolean;
  setOpen: (v: boolean) => void;
  openCheatsheet: () => void;
}

const Ctx = createContext<CommandPaletteStore | null>(null);

export function useCommandPalette(): CommandPaletteStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCommandPalette must be used inside <CommandPaletteProvider>');
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toggle: toggleTheme } = useTheme();

  // Global keyboard listener: Cmd+K opens palette; `?` opens cheatsheet; G-leader navigations.
  useEffect(() => {
    let gLeaderUntil = 0;
    const GO = {
      p: '/products',
      c: '/chat',
      d: '/dashboard',
      s: '/settings',
      r: '/schedules',
    } as const;

    const onKey = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (isInput) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const now = Date.now();
      const key = e.key.toLowerCase();

      if (key === '?') {
        e.preventDefault();
        setCheatsheetOpen(true);
        return;
      }

      if (key === 'g') {
        gLeaderUntil = now + 1000;
        return;
      }

      if (now < gLeaderUntil && key in GO) {
        e.preventDefault();
        gLeaderUntil = 0;
        navigate(GO[key as keyof typeof GO]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const openCheatsheet = useCallback(() => setCheatsheetOpen(true), []);

  const value = useMemo<CommandPaletteStore>(
    () => ({ open, setOpen, openCheatsheet }),
    [open, openCheatsheet],
  );

  const runCommand = useCallback(
    (fn: () => void) => {
      setOpen(false);
      // Defer so the Dialog closes before navigation / theme change
      setTimeout(fn, 0);
    },
    [setOpen],
  );

  // Prefetch products into cache so the palette has them ready.
  useEffect(() => {
    if (!open) return;
    qc.prefetchQuery({ queryKey: ['products'], queryFn: productsApi.list });
  }, [open, qc]);

  const products = qc.getQueryData<ProductSummary[]>(['products']) ?? [];

  return (
    <Ctx.Provider value={value}>
      {children}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogOverlay />
          <Command
            label="Command Palette"
            className="fixed left-1/2 top-[25%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--app)] shadow-[var(--shadow-lg)] focus:outline-none overflow-hidden
              data-[state=open]:animate-[hhl-fade-in_0.18s_ease-out]"
            data-state="open"
          >
            <Command.Input
              placeholder="Run a command or jump to…"
              className="w-full h-11 px-3 bg-transparent border-b border-[var(--border)] text-sm focus:outline-none placeholder:text-[var(--text-tertiary)]"
            />
            <Command.List className="max-h-[320px] overflow-y-auto p-1">
              <Command.Empty className="p-3 text-sm text-[var(--text-tertiary)]">
                No matches.
              </Command.Empty>

              <Command.Group
                heading="Jump to"
                className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] px-2 pt-2 pb-1"
              >
                <Item shortcut="G P" onSelect={() => runCommand(() => navigate('/products'))}>
                  Products
                </Item>
                <Item shortcut="G C" onSelect={() => runCommand(() => navigate('/chat'))}>
                  Chat
                </Item>
                <Item shortcut="G D" onSelect={() => runCommand(() => navigate('/dashboard'))}>
                  Dashboard
                </Item>
                <Item shortcut="G R" onSelect={() => runCommand(() => navigate('/schedules'))}>
                  Schedules
                </Item>
                <Item shortcut="G S" onSelect={() => runCommand(() => navigate('/settings'))}>
                  Settings
                </Item>
              </Command.Group>

              {products.length > 0 && (
                <Command.Group
                  heading="Products"
                  className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] px-2 pt-2 pb-1"
                >
                  {products.slice(0, 10).map((p) => (
                    <Item
                      key={p.id}
                      onSelect={() => runCommand(() => navigate(`/products/${p.id}`))}
                    >
                      <span>{p.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-[var(--text-tertiary)]">
                        {p.slug}
                      </span>
                    </Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group
                heading="Actions"
                className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] px-2 pt-2 pb-1"
              >
                <Item onSelect={() => runCommand(toggleTheme)}>Toggle theme</Item>
                <Item shortcut="?" onSelect={() => runCommand(() => setCheatsheetOpen(true))}>
                  Keyboard shortcuts
                </Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPortal>
      </Dialog>

      <Dialog open={cheatsheetOpen} onOpenChange={setCheatsheetOpen}>
        <DialogContent width="md">
          <h2 className="text-sm font-semibold text-[var(--text)]">Keyboard shortcuts</h2>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-2 gap-x-6 text-sm">
            <Row label="Open command palette" keys={[<Kbd key="k">⌘K</Kbd>]} />
            <Row label="Show this list" keys={[<Kbd key="?">?</Kbd>]} />
            <Row label="Jump to Products" keys={[<Kbd key="g">G</Kbd>, <Kbd key="p">P</Kbd>]} />
            <Row label="Jump to Chat" keys={[<Kbd key="g2">G</Kbd>, <Kbd key="c">C</Kbd>]} />
            <Row label="Jump to Dashboard" keys={[<Kbd key="g3">G</Kbd>, <Kbd key="d">D</Kbd>]} />
            <Row label="Jump to Settings" keys={[<Kbd key="g4">G</Kbd>, <Kbd key="s">S</Kbd>]} />
            <Row label="Send chat message" keys={[<Kbd key="enter">Enter</Kbd>]} />
            <Row
              label="Newline in chat"
              keys={[<Kbd key="shift">Shift</Kbd>, <Kbd key="enter2">Enter</Kbd>]}
            />
            <Row label="Close dialog" keys={[<Kbd key="esc">Esc</Kbd>]} />
          </dl>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

function Item({
  children,
  onSelect,
  shortcut,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  shortcut?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-2 h-9 px-2.5 rounded-md text-sm text-[var(--text)] cursor-pointer
        data-[selected=true]:bg-[var(--surface-hover)] aria-selected:bg-[var(--surface-hover)]"
    >
      <span className="flex-1 flex items-center gap-2">{children}</span>
      {shortcut && (
        <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{shortcut}</span>
      )}
    </Command.Item>
  );
}

function Row({ label, keys }: { label: string; keys: React.ReactNode[] }) {
  return (
    <>
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd className="flex items-center gap-1 justify-end">{keys}</dd>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center h-5 px-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] font-mono text-[10px] text-[var(--text)]">
      {children}
    </kbd>
  );
}
