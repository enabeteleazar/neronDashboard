import { useState } from 'react';
import { setAgentStatus, type AgentsData } from '../../lib/neronApi';

type AgentsPanelProps = {
  agentsData: AgentsData | null;
  onStatusChanged: () => void;
};

export function AgentsPanel({ agentsData, onStatusChanged }: AgentsPanelProps) {
  const agents = agentsData?.agents ?? [];
  const [pending, setPending] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (agents.length === 0) {
    return <div className="rack-panel"><p className="rack-refresh-note">Aucun agent disponible.</p></div>;
  }

  async function toggle(agentId: string, currentlyEnabled: boolean) {
    setPending(agentId);
    await setAgentStatus(agentId, !currentlyEnabled);
    setPending(null);
    onStatusChanged();
  }

  return (
    <div className="rack-panel">
      {agents.map((agent) => {
        const enabled = agent.status === 'available';
        const busy = pending === agent.agent_id;
        const isExpanded = expanded === agent.agent_id;
        return (
          <article
            key={agent.agent_id}
            className="rack-slot"
            onClick={() => setExpanded(isExpanded ? null : agent.agent_id)}
            style={{ cursor: 'pointer' }}
          >
            <div className="rack-slot-header">
              <span className={`rack-status-dot ${enabled ? 'dot-online' : 'dot-offline'}`} />
              <strong>{agent.agent_id}</strong>
            </div>
            {isExpanded && agent.description && (
              <p className="rack-refresh-note">{agent.description}</p>
            )}
            <div className="print-status-row" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(agent.agent_id, enabled);
                }}
              >
                {busy ? '…' : enabled ? 'Désactiver' : 'Activer'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
