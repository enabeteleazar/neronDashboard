import { Mic, Send } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNeronVoice } from '../hooks/useNeronVoice';

export function CommandBar({ onCommand }: { onCommand: (command: string) => void }) {
  const [value, setValue] = useState('');
  const { state, transcript, error, toggle } = useNeronVoice();

  /* la dictee remplit le champ au fil de l'eau */
  useEffect(() => {
    if (transcript) setValue(transcript);
  }, [transcript]);

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
