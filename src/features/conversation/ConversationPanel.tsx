import { useEffect, useRef } from 'react';
import type { ChatMessage, ConnectionStatus } from '../../lib/neronApi';
import type { OrbState } from '../../NeronConsole';

const STATUS_LABEL: Record<string, string> = {
  connecting: 'Connexion…',
  connected: 'Connecté',
  disconnected: 'Déconnecté — reconnexion…',
  error: 'Erreur de connexion',
};

type ConversationProps = {
  setOrbState: (s: OrbState) => void;
  messages: ChatMessage[];
  status: ConnectionStatus;
  isStreaming: boolean;
  isThinking: boolean;
  clear: () => void;
};

export function ConversationPanel({
  setOrbState,
  messages,
  status,
  isStreaming,
  isThinking,
  clear,
}: ConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isThinking) setOrbState('thinking');
    else if (isStreaming) setOrbState('working');
    else setOrbState('idle');
  }, [isThinking, isStreaming, setOrbState]);

  return (
    <div className="conversation-shell">

      <div className="conversation-panel">
        {messages.length === 0 && (
          <p className="conversation-empty">Néron en attente. Écris un message ou une commande.</p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role === 'user' ? 'user' : 'neron'}${message.error ? ' error' : ''}`}>
            {message.content}
            {message.streaming && <span className="cursor-blink">▍</span>}
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="message neron typing"><span /><span /><span /></div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length > 0 && (
        <button className="conversation-clear" onClick={clear} type="button">Effacer la conversation</button>
      )}
    </div>
  );
}
