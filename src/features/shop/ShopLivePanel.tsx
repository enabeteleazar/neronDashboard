import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { API_WS_URL } from '../../lib/config';
import { completeShopLiveSession, createShopLiveSession } from '../../lib/neronApi';

// Doit correspondre au viewport ouvert cote serveur
// (agents/builtin/io/shop_live_session.py, LiveSession.start).
const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;

type Phase = 'idle' | 'starting' | 'live' | 'completing' | 'done' | 'error';

function toCanvasCoords(event: ReactMouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

export function ShopLivePanel() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const closeSocket = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => () => closeSocket(), [closeSocket]);

  const sendInput = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setPhase('starting');
    try {
      const { session_id } = await createShopLiveSession();
      sessionIdRef.current = session_id;

      const ws = new WebSocket(`${API_WS_URL}/shop/live/sessions/${session_id}/stream`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => setPhase('live');

      ws.onclose = () => {
        // 'completing'/'done' : fermeture normale déclenchée par finish().
        setPhase((p) => (p === 'completing' || p === 'done' ? p : 'error'));
      };

      ws.onerror = () => setError('Connexion au flux vidéo perdue.');

      ws.onmessage = async (event) => {
        const canvas = canvasRef.current;
        if (!canvas || !(event.data instanceof ArrayBuffer)) return;
        const bitmap = await createImageBitmap(new Blob([event.data], { type: 'image/jpeg' }));
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de démarrer la session Amazon.");
      setPhase('error');
    }
  }, []);

  const finish = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    setPhase('completing');
    try {
      await completeShopLiveSession(sessionId);
      closeSocket();
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la finalisation.');
      setPhase('error');
    }
  }, [closeSocket]);

  if (phase === 'idle' || phase === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <p style={{ opacity: 0.8, fontSize: 13, lineHeight: 1.5 }}>
          Ouvre une session Amazon.fr en direct : connecte-toi toi-même dans la fenêtre ci-dessous
          (identifiant, mot de passe, 2FA — jamais transmis autrement que par tes propres clics
          et frappes). Une fois connecté, neronShop réutilisera cette session pour tes prochaines
          demandes d'achat.
        </p>
        {error && <p style={{ color: '#f87171', fontSize: 13 }}>Erreur : {error}</p>}
        <button onClick={start}>Se connecter à Amazon.fr</button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <p style={{ color: '#4ade80', fontSize: 13 }}>
        Session Amazon enregistrée. neronShop l'utilisera automatiquement pour tes prochains achats.
      </p>
    );
  }

  function handleKey(event: ReactKeyboardEvent<HTMLCanvasElement>, type: 'keydown' | 'keyup') {
    event.preventDefault();
    sendInput({ type, key: event.key });
  }

  function handleWheel(event: ReactWheelEvent<HTMLCanvasElement>) {
    sendInput({ type: 'wheel', deltaX: event.deltaX, deltaY: event.deltaY });
  }

  function handleMouse(event: ReactMouseEvent<HTMLCanvasElement>, type: 'mousemove' | 'mousedown' | 'mouseup') {
    const canvas = canvasRef.current;
    if (!canvas) return;
    sendInput({ type, ...toCanvasCoords(event, canvas), button: event.button === 2 ? 'right' : 'left' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <canvas
        ref={canvasRef}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        tabIndex={0}
        style={{
          width: '100%', height: 'auto', borderRadius: 6, outline: 'none',
          border: '1px solid rgba(255,255,255,.1)', background: '#000',
        }}
        onMouseMove={(e) => handleMouse(e, 'mousemove')}
        onMouseDown={(e) => handleMouse(e, 'mousedown')}
        onMouseUp={(e) => handleMouse(e, 'mouseup')}
        onWheel={handleWheel}
        onKeyDown={(e) => handleKey(e, 'keydown')}
        onKeyUp={(e) => handleKey(e, 'keyup')}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, opacity: 0.6 }}>
          {phase === 'starting' && 'Démarrage…'}
          {phase === 'live' && 'Connecté — clique dans la fenêtre pour naviguer'}
          {phase === 'completing' && 'Finalisation…'}
        </span>
        <span style={{ flex: 1 }} />
        <button disabled={phase !== 'live'} onClick={finish}>
          J'ai terminé, continuer
        </button>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 13 }}>Erreur : {error}</p>}
    </div>
  );
}
