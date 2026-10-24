import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatSummary } from '@hothotleads/types';
import { chatsApi } from '@/lib/chats';
import { useAuth } from './use-auth';

/** Keyed by organization so an org switch never shows another tenant's conversations. */
export const chatsKey = (orgId: string | null | undefined, productId?: string | null) =>
  ['chats', orgId ?? 'none', productId ?? 'all'] as const;

export const chatKey = (chatId: string) => ['chat', chatId] as const;

export function useChatList(productId?: string | null) {
  const { activeOrg } = useAuth();
  return useQuery({
    queryKey: chatsKey(activeOrg?.id, productId),
    queryFn: () => chatsApi.list(productId ?? undefined),
    enabled: Boolean(activeOrg),
  });
}

export function useChatDetail(chatId: string | null) {
  return useQuery({
    queryKey: chatKey(chatId ?? ''),
    queryFn: () => chatsApi.get(chatId as string),
    enabled: Boolean(chatId),
  });
}

export function useRenameChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, title }: { chatId: string; title: string }) => chatsApi.rename(chatId, title),
    onSuccess: (updated) => {
      qc.setQueriesData<ChatSummary[]>({ queryKey: ['chats'] }, (prev) =>
        prev?.map((c) => (c.id === updated.id ? updated : c)),
      );
      void qc.invalidateQueries({ queryKey: chatKey(updated.id) });
    },
  });
}

/** Removes the conversation from every cached list immediately; the caller decides when to hit the API. */
export function useRemoveChatFromCache() {
  const qc = useQueryClient();
  return (chatId: string) => {
    const snapshots = qc.getQueriesData<ChatSummary[]>({ queryKey: ['chats'] });
    qc.setQueriesData<ChatSummary[]>({ queryKey: ['chats'] }, (prev) => prev?.filter((c) => c.id !== chatId));
    return () => {
      for (const [key, data] of snapshots) qc.setQueryData(key, data);
    };
  };
}

export function useInvalidateChats() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['chats'] });
}
