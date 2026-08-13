import { Mic, Send } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNeronVoice } from '../hooks/useNeronVoice';

export function CommandBar({ onCommand }: { onCommand: (command: string) => void }) {
  const [value, setValue] = useState('');
  const { state, transcript, error, toggle, start, stop, cancel } = useNeronVoice();

  /* la dictee remplit le champ au fil de l'eau */
  useEffect(() => {
    if (transcript) setValue(transcript);
  }, [transcript]);

  /* Talkie-walkie au clavier : Ctrl seul maintenu = ecoute, relachement = envoi.
     Si une autre touche est pressee pendant que Ctrl est tenu (Ctrl+C, Ctrl+V...),
     c'est un raccourci clavier normal : on annule SANS envoyer. */
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const ctrlHeldRef = { current: false };

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Control') {
        if (e.repeat || ctrlHeldRef.current) return;
        const s = stateRef.current;
        if (s !== 'idle' && s !== 'error') return;   // deja en cours
        ctrlHeldRef.current = true;
        start();
        return;
      }
      if (ctrlHeldRef.current) {
        ctrlHeldRef.current = false;   // combo clavier : ce n'est pas un talkie-walkie
        cancel();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Control' && ctrlHeldRef.current) {
        ctrlHeldRef.current = false;
        stop();
      }
    }
    function onBlur() {
      if (ctrlHeldRef.current) {
        ctrlHeldRef.current = false;
        cancel();   // alt-tab pendant l'ecoute : on n'envoie pas un clip coupe
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
  }, [start, stop, cancel]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const command = value.trim();
    if (!command) return;
    onCommand(command);
    setValue('');
  }

  return (
    <form className="command-bar" onSubmit={submit}>
      <button
        type="button"
        className={'cmd-mic cmd-mic--' + state}
        onClick={toggle}
        title={error ?? undefined}
        aria-label={state === 'listening' ? 'Arreter la dictee' : 'Dicter'}
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
