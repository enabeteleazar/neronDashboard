import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, ConnectionStatus } from '../lib/neronApi';
import { getDeviceId, ensureDeviceLabel } from '../lib/device';
import { WS_URL, TOKEN } from '../lib/config';

const RECONNECT_DELAY_MS = 3000;

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

const MIME_CANDIDATES: Array<{ mime: string; ext: string }> = [
  { mime: 'audio/webm;codecs=opus', ext: 'clip.webm' },
  { mime: 'audio/webm', ext: 'clip.webm' },
  { mime: 'audio/ogg;codecs=opus', ext: 'clip.ogg' },
  { mime: 'audio/mp4', ext: 'clip.m4a' },
];

function pickMimeType(): { mime: string | undefined; ext: string } {
  if (typeof MediaRecorder === 'undefined') return { mime: undefined, ext: 'clip.webm' };
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mime)) return candidate;
  }
  return { mime: undefined, ext: 'clip.webm' };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export type UseNeronReturn = {
  messages: ChatMessage[];
  status: ConnectionStatus;
  isStreaming: boolean;
  isThinking: boolean;
  isPresent: boolean;
  send: (text: string) => void;
  clear: () => void;
  // Vocal — MEME connexion, MEME session_id que le texte (fusion du 13/08).
  voiceState: VoiceState;
  voiceTranscript: string;
  voiceError: string | null;
  voiceToggle: () => void;
  voiceStart: () => void;
  voiceStop: () => void;
  voiceCancel: () => void;
};

export function useNeron(): UseNeronReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isPresent, setIsPresent] = useState(false);
  const deviceIdRef = useRef(getDeviceId());

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const rpcIdRef = useRef(0);
  const sessionIdRef = useRef(`ui-${makeId()}`);
  const pendingRef = useRef<Map<number, (v: unknown) => void>>(new Map());
  const unmountedRef = useRef(false);
  const authenticatedRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mimeRef = useRef(pickMimeType());

  function getAudioEl(): HTMLAudioElement {
    if (!audioElRef.current) audioElRef.current = new Audio();
    return audioElRef.current;
  }

  // Deverrouille la lecture audio (politique autoplay des navigateurs) :
  // doit rester appele de facon SYNCHRONE dans le gestionnaire de
  // clic/touche, avant tout await.
  function unlockAudioPlayback() {
    const audio = getAudioEl();
    audio.muted = true;
    audio.play().catch(() => {});
    audio.pause();
    audio.muted = false;
  }

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    authenticatedRef.current = false;

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
        authenticatedRef.current = true;
        await rpc('device.announce', {
          device_id: deviceIdRef.current,
          device_label: ensureDeviceLabel(),
        });
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

      if (eventName === 'presence.changed') {
        setIsPresent((data.device_id as string | undefined) === deviceIdRef.current);
        return;
      }

      if (eventName === 'voice.transcription') {
        setVoiceTranscript((data.text as string) ?? '');
        return;
      }

      if (eventName === 'voice.audio') {
        const audioB64 = data.audio_b64 as string | undefined;
        const mimetype = (data.mimetype as string) || 'audio/wav';
        if (audioB64) {
          const audio = getAudioEl();
          audio.src = `data:${mimetype};base64,${audioB64}`;
          audio.onended = () => setVoiceState('idle');
          audio.onerror = () => setVoiceState('idle');
          audio.play().catch(() => setVoiceState('idle'));
        }
        return;
      }

      if (eventName === 'voice.error') {
        setVoiceError((data.message as string) ?? 'Erreur inconnue');
        setVoiceState('error');
        window.setTimeout(() => setVoiceState('idle'), 2500);
        return;
      }

      if (eventName === 'agent.token') {
        const token = (data.token as string) ?? '';
        setIsThinking(false);
        setIsStreaming(true);
        // Reponse vocale en cours de traitement : elle bascule en
        // 'speaking' des le premier jeton, meme flux que le texte.
        setVoiceState((s) => (s === 'processing' ? 'speaking' : s));
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
        // Une erreur d'agent pendant une requete vocale doit aussi
        // liberer l'etat du micro (oubli du code d'origine).
        setVoiceState((s) => (s === 'processing' || s === 'speaking' ? 'idle' : s));
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      setIsStreaming(false);
      setIsThinking(false);
      authenticatedRef.current = false;
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

  // ── Vocal : meme socket, MEME session_id que le texte ──
  const voiceStart = useCallback(async () => {
    setVoiceError(null);
    setVoiceTranscript('');
    unlockAudioPlayback();
    connect();   // no-op si deja ouverte (montee au montage du Dashboard)

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Ce navigateur ne supporte pas l'enregistrement audio.");
      setVoiceState('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const { mime } = mimeRef.current;
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      setVoiceState('listening');
    } catch {
      setVoiceError('Accès au micro refusé.');
      setVoiceState('error');
      window.setTimeout(() => setVoiceState('idle'), 2500);
    }
  }, [connect]);

  const voiceStop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const blob = new Blob(chunksRef.current, { type: mimeRef.current.mime || 'audio/webm' });
      chunksRef.current = [];

      if (blob.size === 0) {
        setVoiceError('Aucun audio capté.');
        setVoiceState('idle');
        return;
      }

      setVoiceState('processing');

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !authenticatedRef.current) {
        setVoiceError('Non connecté au gateway.');
        setVoiceState('error');
        window.setTimeout(() => setVoiceState('idle'), 2500);
        return;
      }

      try {
        const audio_b64 = await blobToBase64(blob);
        ws.send(JSON.stringify({
          id: ++rpcIdRef.current,
          method: 'voice.send',
          params: {
            audio_b64,
            filename: mimeRef.current.ext,
            session_id: sessionIdRef.current,   // MEME session que le texte
            synthesize: true,
          },
        }));
      } catch {
        setVoiceError("Échec de l'envoi de l'audio.");
        setVoiceState('error');
        window.setTimeout(() => setVoiceState('idle'), 2500);
      }
    };

    recorder.stop();
  }, []);

  const voiceCancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      chunksRef.current = [];
      setVoiceState('idle');
    };
    recorder.stop();
  }, []);

  const voiceToggle = useCallback(() => {
    if (voiceState === 'listening') voiceStop();
    else if (voiceState === 'idle' || voiceState === 'error') void voiceStart();
  }, [voiceState, voiceStart, voiceStop]);

  return {
    messages, status, isStreaming, isThinking, isPresent, send, clear,
    voiceState, voiceTranscript, voiceError,
    voiceToggle, voiceStart, voiceStop, voiceCancel,
  };
}
