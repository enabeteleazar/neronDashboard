import { useState } from 'react';
import type { HomelabData, ServiceRegistration, SystemResources } from '../../lib/neronApi';
import { setHomelabSlot } from '../../lib/neronApi';
import { DEFAULT_RACK, UNIT_IDS, type UnitId } from './rackConfig';
import { HomelabItemModal } from './HomelabItemModal';

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
        <path
          d="M8,50 A42,42 0 0,1 92,50"
          fill="none"
          stroke="rgba(255,255,255,.08)"
          strokeWidth="9"
          strokeLinecap="round"
        />
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

export function HomelabPanel({ resources, homelab, onSlotSaved }: HomelabPanelProps) {
  const [configuringUnit, setConfiguringUnit] = useState<UnitId | null>(null);

  const catalog = homelab?.catalog ?? [];
  const slots = homelab?.slots ?? {};

  function handleSave(unitId: UnitId, catalogId: string | null) {
    setHomelabSlot(unitId, catalogId).then((ok) => {
      if (ok) onSlotSaved();
    });
  }

  return (
    <div className="rack-panel">
      {UNIT_IDS.map((unitId) => {
        const slot = DEFAULT_RACK[unitId];
        const assignedId = slots[unitId];
        const assignedItem = assignedId ? catalog.find((item) => item.id === assignedId) : null;

        if (!slot.isReal) {
          return (
            <article
              key={unitId}
              className={`rack-slot rack-slot-clickable status-offline${assignedItem ? '' : ' rack-slot-empty'}`}
              onClick={() => setConfiguringUnit(unitId)}
            >
              <div className="rack-slot-header">
                <span className="rack-unit">{unitId}</span>
                <strong>{assignedItem ? assignedItem.name : 'Emplacement libre'}</strong>
                <span className={`rack-status-dot ${assignedItem ? 'dot-online' : 'dot-offline'}`} title={assignedItem ? 'configuré' : 'non configuré'} />
              </div>
            </article>
         );
        }

        return (
          <article
            key={unitId}
            className={`rack-slot rack-slot-clickable status-${slot.status}`}
            style={{ borderLeftColor: slot.accentHex }}
            onClick={() => setConfiguringUnit(unitId)}
          >
            <div className="rack-slot-header">
              <span className="rack-unit">{unitId}</span>
              <strong>{assignedItem ? assignedItem.name : slot.label}</strong>
              <div className="rack-gauges-row">
                <Gauge label="CPU" value={resources?.cpu_pct} />
                <Gauge label="RAM" value={resources?.ram_pct} />
                <Gauge label="Disque" value={resources?.disk_pct} />
              </div>
              <span className={`rack-status-dot dot-${slot.status}`} title={slot.status} />
            </div>
          </article>
        );
      })}

      {configuringUnit && (
        <HomelabItemModal
          unitId={configuringUnit}
          catalog={catalog}
          currentCatalogId={slots[configuringUnit] ?? null}
          onSave={(catalogId) => handleSave(configuringUnit, catalogId)}
          onClose={() => setConfiguringUnit(null)}
        />
      )}
    </div>
  );
}
