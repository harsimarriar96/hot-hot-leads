import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { detectPipelineKind } from '@/lib/pipelines';
import type { PipelineKind } from '@/lib/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  timestamp: number;
  elapsedMs?: number;
  pipeline?: PipelineRun;
}

export interface PipelineRun {
  kind: PipelineKind;
  seed: number;
  startedAt: number;
  resolvedAt: number | null;
  status: 'running' | 'complete' | 'failed';
}

function id() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    const kind = detectPipelineKind(trimmed);
    const seed = Math.floor(Math.random() * 1000);
    const assistantId = id();

    setMessages((prev) => [
      ...prev,
      { id: id(), role: 'user', text: trimmed, timestamp: now },
      {
        id: assistantId,
        role: 'assistant',
        text: '',
        timestamp: now,
        pipeline: { kind, seed, startedAt: now, resolvedAt: null, status: 'running' },
      },
    ]);
    setIsRunning(true);

    try {
      const reply = await api.chat(trimmed);
      const resolvedAt = Date.now();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text: reply.reply,
                elapsedMs: reply.elapsedMs,
                pipeline: m.pipeline
                  ? { ...m.pipeline, resolvedAt, status: 'complete' as const }
                  : undefined,
              }
            : m
        )
      );
    } catch (err) {
      const resolvedAt = Date.now();
      const message = err instanceof Error ? err.message : 'Request failed.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                role: 'error' as const,
                text: message,
                pipeline: m.pipeline
                  ? { ...m.pipeline, resolvedAt, status: 'failed' as const }
                  : undefined,
              }
            : m
        )
      );
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { messages, send, isRunning };
}

export function useNow(active: boolean, intervalMs = 200) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tid = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(tid);
  }, [active, intervalMs]);
  return now;
}
