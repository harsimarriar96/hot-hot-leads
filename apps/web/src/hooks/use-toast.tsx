import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface Toast {
  id: string;
  message: string;
  tone?: 'default' | 'danger';
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (input: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastStore | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback<ToastStore['push']>(
    (input) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const toast: Toast = { id, durationMs: 5000, ...input };
      setToasts((prev) => [...prev, toast]);
      const timer = setTimeout(() => dismiss(id), toast.durationMs);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastStore>(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastStore {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastBubble key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastBubble({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const isDanger = toast.tone === 'danger';
  return (
    <div
      role="status"
      className={`pointer-events-auto min-w-[280px] max-w-sm rounded-md border shadow-[var(--shadow-md)] px-3 py-2.5 flex items-center gap-3 text-sm
        ${
          isDanger
            ? 'border-[var(--error)]/40 bg-[var(--error-soft)] text-[var(--error)]'
            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
        }
        data-[state=open]:animate-[hhl-rise_0.28s_cubic-bezier(0.22,1,0.36,1)_both]`}
      data-state="open"
    >
      <span className="flex-1">{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.();
            onDismiss(toast.id);
          }}
          className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--accent)] hover:underline"
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="text-[var(--text-tertiary)] hover:text-[var(--text)] px-1"
      >
        ×
      </button>
    </div>
  );
}
