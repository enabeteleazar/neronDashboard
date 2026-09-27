import { Mic, Send } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import type { VoiceState } from '../hooks/useNeron';

export function CommandBar({
  onCommand,
  voiceState,
  voiceTranscript,
  voiceError,
  voiceToggle,
  voiceStart,
  voiceStop,
  voiceCancel,
}: {
  onCommand: (command: string) => void;
  voiceState: VoiceState;
  voiceTranscript: string;
  voiceError: string | null;
  voiceToggle: () => void;
  voiceStart: () => void;
  voiceStop: () => void;
  voiceCancel: () => void;
}) {
  const [value, setValue] = useState('');

  /* la dictee remplit le champ au fil de l'eau */
  useEffect(() => {
    if (voiceTranscript) setValue(voiceTranscript);
  }, [voiceTranscript]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const command = value.trim();
    if (!command) return;
    onCommand(command);
    setValue('');
  }

  /* Talkie-walkie au clavier : Ctrl seul maintenu = ecoute, relachement = envoi.
     Si une autre touche est pressee pendant que Ctrl est tenu (Ctrl+C, Ctrl+V...),
     c'est un raccourci clavier normal : on annule SANS envoyer. */
  const stateRef = useRef(voiceState);
  useEffect(() => {
    stateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    const ctrlHeldRef = { current: false };

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Control') {
        if (e.repeat || ctrlHeldRef.current) return;
        const s = stateRef.current;
        if (s !== 'idle' && s !== 'error') return;
        ctrlHeldRef.current = true;
        voiceStart();
        return;
      }
      if (ctrlHeldRef.current) {
        ctrlHeldRef.current = false;
        voiceCancel();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Control' && ctrlHeldRef.current) {
        ctrlHeldRef.current = false;
        voiceStop();
      }
    }
    function onBlur() {
      if (ctrlHeldRef.current) {
        ctrlHeldRef.current = false;
        voiceCancel();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [voiceStart, voiceStop, voiceCancel]);

  return (
    <form className="command-bar" onSubmit={submit}>
      <button
        type="button"
        className={'cmd-mic cmd-mic--' + voiceState}
        onClick={voiceToggle}
        title={voiceError ?? undefined}
        aria-label={voiceState === 'listening' ? 'Arreter la dictee' : 'Dicter'}
      >
        <Mic size={20} />
      </button>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Demande à Néron d’ouvrir une fenêtre ou d’exécuter un objectif..."
      />
      <button type="submit" aria-label="Envoyer">
        <Send size={18} />
      </button>
    </form>
  );
}
