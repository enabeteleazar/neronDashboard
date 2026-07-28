import type {
  HomelabData,
  Rack,
  RackOccupant,
  ServiceRegistration,
  SystemResources,
} from '../../lib/neronApi';
import { displayFor } from './rackConfig';

type HomelabPanelProps = {
  services: ServiceRegistration[] | null;
  resources: SystemResources | null;
  homelab: HomelabData | null;
  onSlotSaved: () => void;
};

function gaugeColor(value: number | null | undefined): string {
  if (value == null) return '#4b5563';
  if (value >= 90) return '#f87171';
  if (value >= 80) return '#fb923c';
  if (value >= 70) return '#facc15';
  return '#4ade80';
}

function Gauge({ label, value }: { label: string; value: number | null | undefined }) {
  const radius = 42;
  const circumference = Math.PI * radius;
  const pctValue = Math.min(value ?? 0, 100);
  const dashOffset = circumference - (pctValue / 100) * circumference;

  return (
    <div className="gauge">
      <svg viewBox="0 0 100 56" className="gauge-svg">
        <path d="M8,50 A42,42 0 0,1 92,50" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M8,50 A42,42 0 0,1 92,50"
          fill="none"
          stroke={gaugeColor(value)}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset .5s ease, stroke .5s ease' }}
        />
      </svg>
      <div className="gauge-value">{value != null ? `${Math.round(value)}%` : '—'}</div>
      <div className="gauge-label">{label}</div>
    </div>
  );
}

function dotClass(state: RackOccupant['state']): string {
  if (state === 'actif') return 'dot-online';
  if (state === 'injoignable') return 'dot-alert';
  return 'dot-offline';
}

function OccupantRow({ occupant }: { occupant: RackOccupant }) {
  const display = displayFor(occupant.key);

  return (
    <div className="rack-occupant">
      <span className="rack-occupant-name">
        <span className={`rack-status-dot ${dotClass(occupant.state)}`} title={occupant.state} />
        {display.label}
        {occupant.foreign && <em className="rack-occupant-foreign">tiers</em>}
      </span>
      <span className="rack-occupant-ports">
        {occupant.ports.length ? occupant.ports.join(' · ') : '—'}
      </span>
      <span className="rack-occupant-ram">
        {occupant.ram_mb != null ? `${Math.round(occupant.ram_mb)} Mo` : '—'}
      </span>
      <Gauge label="CPU" value={occupant.cpu_percent} />
    </div>
  );
}

function accentFor(rack: Rack): string {
  return displayFor(rack.occupants[0]?.key ?? '').accentHex;
}

export function HomelabPanel({ homelab }: HomelabPanelProps) {
  const racks = homelab?.racks ?? [];

  if (racks.length === 0) {
    return <div className="rack-panel"><p className="rack-refresh-note">Topologie indisponible.</p></div>;
  }

  return (
    <div className="rack-panel">
      {racks.map((rack) => (
        <article key={rack.unit} className="rack-slot" style={{ borderLeftColor: accentFor(rack) }}>
          <div className="rack-slot-header">
            <span className="rack-unit">{rack.unit}</span>
            <strong>{rack.host}</strong>
          </div>

          <div className="rack-occupants">
            {rack.occupants.map((occupant) => (
              <OccupantRow key={occupant.key} occupant={occupant} />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
