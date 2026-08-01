import { useEffect, useRef, useState } from 'react';

import { WS_URL, TOKEN } from '../lib/config';
const RECONNECT_DELAY_MS = 3000;

export type NeronEvent = {
  event: string;
  data: Record<string, unknown>;
};

export function useNeronEvents(): NeronEvent | null {
  const [lastEvent, setLastEvent] = useState<NeronEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const rpcIdRef = useRef(0);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        const id = ++rpcIdRef.current;
        ws.send(JSON.stringify({ id, method: 'gateway.auth', params: { token: TOKEN } }));
      };

      ws.onmessage = (event) => {
        let frame: Record<string, unknown>;
        try {
          frame = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (frame.id != null) return; // réponse RPC (auth), pas un event
        const eventName = frame.event as string | undefined;
        if (!eventName || eventName === 'gateway.auth_required') return;
        setLastEvent({ event: eventName, data: (frame.data ?? {}) as Record<string, unknown> });
      };

      ws.onclose = () => {
        if (!unmountedRef.current) window.setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
    };
  }, []);

  return lastEvent;
}
