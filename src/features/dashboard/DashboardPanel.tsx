import type { NeronHealth, ServiceRegistration } from '../../lib/neronApi';

const serviceLabels: Record<string, string> = {
  web: 'Interface Web',
  homeassistant: 'Home Assistant',
  llm: 'Provider LLM',
  goal: 'Moteur de Goals',
  memory: 'Mémoire',
};

function serviceLabel(name: string): string {
  return serviceLabels[name] ?? name;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'healthy': return 'En ligne';
    case 'degraded': return 'Dégradé';
    case 'unhealthy': return 'En panne';
    default: return 'Inconnu';
  }
}

type DashboardPanelProps = {
  health: NeronHealth | null;
  healthError: boolean;
  services: ServiceRegistration[] | null;
};

export function DashboardPanel({ health, healthError, services }: DashboardPanelProps) {
  return (
    <div className="panel-grid">
      <div className="core-health">
        <span className={`health-dot ${healthError ? 'health-down' : 'health-up'}`} />
        <div>
          <strong>{healthError ? 'Néron Core injoignable' : health?.status ?? 'Connexion…'}</strong>
          {health?.version && <small>Version {health.version}</small>}
        </div>
      </div>

      <div className="service-list">
        <h3>Services</h3>
        {services === null
          ? <p><span>Services</span><b>Injoignable</b></p>
          : services.length === 0
          ? <p><span>Aucun service enregistré</span></p>
          : services.map((service) => (
              <p key={service.service_name}>
                <span>{serviceLabel(service.service_name)}</span>
                <b className={`status-${service.status}`}>{statusLabel(service.status)}</b>
              </p>
            ))}
      </div>
    </div>
  );
}
