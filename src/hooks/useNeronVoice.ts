import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

import { WS_URL, TOKEN } from '../lib/config';
const RECONNECT_DELAY_MS = 3000;

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// Formats par ordre de préférence pour un contexte navigateur desktop
// (Chrome/Edge/Firefox supportent tous webm/opus nativement).
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

export type UseNeronVoiceReturn = {
  state: VoiceState;
  transcript: string;
  responseText: string;
  error: string | null;
  toggle: () => void;
};

export function useNeronVoice(): UseNeronVoiceReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const authenticatedRef = useRef(false);
  const rpcIdRef = useRef(0);
  const sessionIdRef = useRef(`voice-${makeId()}`);
  const unmountedRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mimeRef = useRef(pickMimeType());
  const pendingRef = useRef<Map<number, (v: unknown) => void>>(new Map());

  function getAudioEl(): HTMLAudioElement {
    if (!audioElRef.current) {
      audioElRef.current = new Audio();
    }
    return audioElRef.current;
  }

  // Déverrouille la lecture audio (politique autoplay des navigateurs) :
  // doit être appelé de façon SYNCHRONE dans le gestionnaire de clic, avant
  // tout `await`.
  function unlockAudioPlayback() {
    const audio = getAudioEl();
    audio.muted = true;
    audio.play().catch(() => {});
    audio.pause();
    audio.muted = false;
  }

  // ── Connexion WebSocket dédiée (indépendante de useNeron/ConversationPanel) ──
  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

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

    // Même pattern que useNeron.ts : on authentifie systématiquement à
    // l'ouverture, sans attendre gateway.auth_required (fonctionne aussi si
    // le gateway est configuré sans token).
    ws.onopen = async () => {
      try {
        await rpc('gateway.auth', { token: TOKEN });
        authenticatedRef.current = true;
      } catch (err) {
        console.error('[Néron voix] erreur auth :', err);
      }
    };

    ws.onmessage = (evt) => {
      let msg: any;
      try {
        msg = JSON.parse(evt.data as string);
      } catch {
        return;
      }

      if (msg.event === 'gateway.auth_required') return;

      if (msg.id != null) {
        const resolve = pendingRef.current.get(msg.id as number);
        if (resolve) {
          pendingRef.current.delete(msg.id as number);
          resolve((msg.result ?? msg.error) || null);
        }
        return;
      }

      switch (msg.event) {
        case 'voice.transcription':
          setTranscript(msg.data?.text ?? '');
          break;
        case 'agent.token':
          setResponseText((prev) => prev + (msg.data?.token ?? ''));
          break;
        case 'agent.done':
          // Si pas d'audio à venir (TTS indisponible côté serveur), on
          // passe quand même en 'speaking' pour afficher le texte.
          setState((s) => (s === 'processing' ? 'speaking' : s));
          break;
        case 'voice.audio': {
          const audioB64 = msg.data?.audio_b64;
          const mimetype = msg.data?.mimetype || 'audio/wav';
          if (audioB64) {
            const audio = getAudioEl();
            audio.src = `data:${mimetype};base64,${audioB64}`;
            audio.onended = () => setState('idle');
            audio.onerror = () => setState('idle');
            audio.play().catch(() => setState('idle'));
          }
          break;
        }
        case 'agent.error':
        case 'voice.error':
          setError(msg.data?.message ?? 'Erreur inconnue');
          setState('error');
          window.setTimeout(() => setState('idle'), 2500);
          break;
        default:
          break;
      }
    };

    ws.onclose = () => {
      authenticatedRef.current = false;
      if (!unmountedRef.current) window.setTimeout(connect, RECONNECT_DELAY_MS);
    };
    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
    };
  }, [connect]);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    setResponseText('');
    unlockAudioPlayback();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError("Ce navigateur ne supporte pas l'enregistrement audio.");
      setState('error');
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
      setState('listening');
    } catch {
      setError('Accès au micro refusé.');
      setState('error');
      window.setTimeout(() => setState('idle'), 2500);
    }
  }, []);

  const stopAndSend = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const blob = new Blob(chunksRef.current, { type: mimeRef.current.mime || 'audio/webm' });
      chunksRef.current = [];

      if (blob.size === 0) {
        setError('Aucun audio capté.');
        setState('idle');
        return;
      }

      setState('processing');

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !authenticatedRef.current) {
        setError('Non connecté au gateway.');
        setState('error');
        window.setTimeout(() => setState('idle'), 2500);
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
            session_id: sessionIdRef.current,
            synthesize: true,
          },
        }));
      } catch {
        setError("Échec de l'envoi de l'audio.");
        setState('error');
        window.setTimeout(() => setState('idle'), 2500);
      }
    };

    recorder.stop();
  }, []);

  const toggle = useCallback(() => {
    if (state === 'listening') stopAndSend();
    else if (state === 'idle' || state === 'error') void startRecording();
    // 'processing'/'speaking' : le tap ne fait rien (comme avant).
  }, [state, startRecording, stopAndSend]);

  return { state, transcript, responseText, error, toggle };
}
