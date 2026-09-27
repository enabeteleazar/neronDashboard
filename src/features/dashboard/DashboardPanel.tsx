import type { NeronHealth, SystemdData, SystemdUnit } from '../../lib/neronApi';

const serviceLabels: Record<string, string> = {
  core: 'Néron Core',
  llm: 'Provider LLM',
  goal: 'Moteur de Goals',
  memory: 'Mémoire',
  voice: 'Voix',
  client: 'Client',
  dashboard: 'Dashboard',
  web: 'Interface Web',
  homeassistant: 'Home Assistant',
  'homeassistant-registry': 'Home Assistant',
  'voice-interface': 'Interface vocale',
  'cognitive-loop': 'Boucle cognitive',
  'self-model-loop': 'Boucle self-model',
  'world-model-loop': 'Boucle world-model',
};

function serviceLabel(key: string): string {
  return serviceLabels[key] ?? key;
}

function dotClass(unit: SystemdUnit): string {
  switch (unit.active_state) {
    case 'active': return 'health-up';
    case 'failed': return 'health-down';
    case 'activating':
    case 'deactivating': return 'health-warn';
    case 'inactive': return 'health-idle';
    default: return 'health-idle';
  }
}

function stateLabel(unit: SystemdUnit): string {
  switch (unit.state) {
    case 'ok': return 'En ligne';
    case 'unregistered': return 'Non inscrit';
    case 'orphan': return 'Orphelin';
    case 'foreign': return 'Tiers';
    default: return 'Inconnu';
  }
}

function UnitRow({ unit }: { unit: SystemdUnit }) {
  return (
    <p>
      <span>
        <i className={`health-dot ${dotClass(unit)}`} />
        {serviceLabel(unit.key)}
        {unit.restarts > 0 && (
          <small className="unit-restarts" title="Redémarrages depuis le démarrage">
            ↻ {unit.restarts}
          </small>
        )}
      </span>
      <em className="service-version">{unit.version ? `v${unit.version}` : '\u2014'}</em>
      <b className={`unit-state unit-state-${unit.state}`}>{stateLabel(unit)}</b>
    </p>
  );
}

type DashboardPanelProps = {
  health: NeronHealth | null;
  healthError: boolean;
  systemd: SystemdData | null;
};

export function DashboardPanel({ health, healthError, systemd }: DashboardPanelProps) {
  const units = systemd?.units ?? [];
  const applicatifs = units.filter((u) => u.group === 'applicatif');
  const peripheriques = units.filter((u) => u.group !== 'applicatif');

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
        {systemd === null
          ? <p><span>Services</span><b>Injoignable</b></p>
          : !systemd.available
          ? <p><span>État systemd indisponible</span></p>
          : applicatifs.length === 0
          ? <p><span>Aucune unité détectée</span></p>
          : applicatifs.map((u) => <UnitRow key={u.key} unit={u} />)}
      </div>

      {peripheriques.length > 0 && (
        <div className="service-list">
          <h3>Périphériques</h3>
          {peripheriques.map((u) => <UnitRow key={u.key} unit={u} />)}
        </div>
      )}
    </div>
  );
}
