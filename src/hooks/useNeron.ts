import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, ConnectionStatus } from '../lib/neronApi';

const WS_URL = import.meta.env.VITE_NERON_WS_URL ?? 'ws://localhost:18789';
const TOKEN = import.meta.env.VITE_NERON_TOKEN ?? 'changez_moi';
const RECONNECT_DELAY_MS = 3000;

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export type UseNeronReturn = {
  messages: ChatMessage[];
  status: ConnectionStatus;
  isStreaming: boolean;
  isThinking: boolean;
  send: (text: string) => void;
  clear: () => void;
};

export function useNeron(): UseNeronReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const rpcIdRef = useRef(0);
  const sessionIdRef = useRef(`ui-${makeId()}`);
  const pendingRef = useRef<Map<number, (v: unknown) => void>>(new Map());
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    function rpc(method: string, params: Record<string, unknown>): Promise<unknown> {
      return new Promise((resolve) => {
        const id = ++rpcIdRef.current;
        pendingRef.current.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.onopen = async () => {
      setStatus('connected');
      try {
        await rpc('gateway.auth', { token: TOKEN });
        await rpc('session.new', {
          session_id: sessionIdRef.current,
          system: 'Tu es Néron, un assistant IA local. Tu réponds en français.',
        });
      } catch (err) {
        console.error('[Néron] erreur init session :', err);
      }
    };

    ws.onmessage = (event) => {
      let frame: Record<string, unknown>;
      try {
        frame = JSON.parse(event.data as string);
      } catch {
        return;
      }

      if (frame.id != null) {
        const id = frame.id as number;
        const resolve = pendingRef.current.get(id);
        if (resolve) {
          pendingRef.current.delete(id);
          resolve((frame.result ?? frame.error) || null);
        }
        return;
      }

      const eventName = frame.event as string | undefined;
      const data = (frame.data ?? {}) as Record<string, unknown>;

      if (eventName === 'gateway.auth_required') return;

      if (eventName === 'agent.token') {
        const token = (data.token as string) ?? '';
        setIsThinking(false);
        setIsStreaming(true);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.streaming) {
            return [...prev.slice(0, -1), { ...last, content: last.content + token }];
          }
          return [
            ...prev,
            { id: makeId(), role: 'assistant', content: token, streaming: true, timestamp: new Date() },
          ];
        });
        return;
      }

      if (eventName === 'agent.done') {
        setIsThinking(false);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.streaming) {
            return [...prev.slice(0, -1), { ...last, streaming: false }];
          }
          return prev;
        });
        setIsStreaming(false);
        return;
      }

      if (eventName === 'agent.error') {
        const msg = (data.message as string) ?? 'Erreur inconnue';
        setIsThinking(false);
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'assistant', content: msg, streaming: false, timestamp: new Date(), error: true },
        ]);
        setIsStreaming(false);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      setIsStreaming(false);
      setIsThinking(false);
      if (!unmountedRef.current) {
        setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      ws.close();
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming || isThinking) return;

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: 'user', content: trimmed, streaming: false, timestamp: new Date() },
      ]);
      setIsThinking(true);

      ws.send(
        JSON.stringify({
          id: ++rpcIdRef.current,
          method: 'chat.send',
          params: { session_id: sessionIdRef.current, message: trimmed },
        }),
      );
    },
    [isStreaming, isThinking],
  );

  const clear = useCallback(() => setMessages([]), []);

  return { messages, status, isStreaming, isThinking, send, clear };
}
