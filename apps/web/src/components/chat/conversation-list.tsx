import { useState } from 'react';
import { MessagesSquare, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ChatSummary } from '@hothotleads/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useChatList, useRemoveChatFromCache, useRenameChat } from '@/hooks/use-chats';
import { useToast } from '@/hooks/use-toast';
import { chatsApi } from '@/lib/chats';
import { cn, relativeTime } from '@/lib/utils';

export const UNTITLED = 'New conversation';

export function ConversationList({
  productId,
  selectedId,
  onSelect,
  onNew,
  onDeleted,
  showProduct = false,
  variant = 'sidebar',
  className,
}: {
  /** Restricts the list to one product's conversations. */
  productId?: string;
  selectedId: string | null;
  onSelect: (chatId: string) => void;
  onNew: () => void;
  /** Called when the selected conversation is deleted so the caller can move away from it. */
  onDeleted?: (chatId: string) => void;
  showProduct?: boolean;
  variant?: 'sidebar' | 'rail';
  className?: string;
}) {
  const { can } = useAuth();
  const canWrite = can('chat:write');
  const { data: chats, isPending } = useChatList(productId ?? null);
  const rename = useRenameChat();
  const removeFromCache = useRemoveChatFromCache();
  const toast = useToast();
  const [renaming, setRenaming] = useState<ChatSummary | null>(null);
  const [deleting, setDeleting] = useState<ChatSummary | null>(null);
  const [title, setTitle] = useState('');

  function openRename(chat: ChatSummary) {
    setTitle(chat.title ?? '');
    setRenaming(chat);
  }

  function submitRename() {
    if (!renaming) return;
    const next = title.trim();
    setRenaming(null);
    if (!next || next === renaming.title) return;
    rename.mutate(
      { chatId: renaming.id, title: next },
      { onError: (err) => toast.push({ message: `Rename failed: ${(err as Error).message}`, tone: 'danger' }) },
    );
  }

  function confirmDelete() {
    if (!deleting) return;
    const chat = deleting;
    setDeleting(null);
    const restore = removeFromCache(chat.id);
    if (chat.id === selectedId) onDeleted?.(chat.id);

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await chatsApi.remove(chat.id);
      } catch (err) {
        toast.push({ message: `Delete failed: ${(err as Error).message}`, tone: 'danger' });
        restore();
      }
    }, 5000);
    toast.push({
      message: `Deleted "${chat.title ?? UNTITLED}"`,
      actionLabel: 'Undo',
      durationMs: 5000,
      onAction: () => {
        cancelled = true;
        clearTimeout(timer);
        restore();
      },
    });
  }

  const rail = variant === 'rail';

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div className={cn('flex items-center justify-between shrink-0', rail ? 'px-2 pb-2' : 'px-3 py-3')}>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          {rail ? 'conversations' : 'chats'}
        </span>
        {canWrite && (
          <Button type="button" variant="ghost" size="sm" onClick={onNew} aria-label="New chat">
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-0.5">
        {isPending && (
          <div className="space-y-2 px-1 pt-1">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        )}
        {!isPending && chats?.length === 0 && (
          <p className="px-2 pt-6 text-center text-xs text-[var(--text-tertiary)]">
            No conversations yet.
          </p>
        )}
        {chats?.map((chat) => {
          const active = chat.id === selectedId;
          return (
            <div
              key={chat.id}
              className={cn(
                'group relative flex items-center rounded-md transition-colors',
                active ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)]',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(chat.id)}
                className={cn(
                  'flex-1 min-w-0 text-left px-2 py-1.5 rounded-md',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <MessagesSquare
                    className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]')}
                  />
                  <span className={cn('truncate text-[13px]', active ? 'text-[var(--text)]' : 'text-[var(--text-secondary)]')}>
                    {chat.title ?? UNTITLED}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 pl-5 text-[10px] text-[var(--text-tertiary)]">
                  {showProduct && chat.productName && <Badge variant="accent">{chat.productName}</Badge>}
                  <span className="truncate">{relativeTime(chat.lastMessageAt)}</span>
                </span>
              </button>
              {canWrite && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Conversation actions"
                      className={cn(
                        'mr-1 rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text)]',
                        'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                      )}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openRename(chat)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDeleting(chat)} className="text-[var(--error)]">
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent width="sm">
          <DialogTitle>Rename conversation</DialogTitle>
          <DialogDescription className="sr-only">Enter a new title for this conversation.</DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
            className="mt-3 space-y-3"
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus placeholder={UNTITLED} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!title.trim()}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent width="sm">
          <DialogTitle>Delete conversation?</DialogTitle>
          <DialogDescription>
            "{deleting?.title ?? UNTITLED}" and all its messages will be removed.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
