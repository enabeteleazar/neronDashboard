import { useState } from 'react';
import { Server, Network, Shield, Cpu, HardDrive, Zap, Home, Square, X, Check } from 'lucide-react';
import type { HomelabCatalogItem } from '../../lib/neronApi';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  server: Server,
  switch: Network,
  firewall: Shield,
  gpu_server: Cpu,
  nas: HardDrive,
  ups: Zap,
  home_assistant: Home,
};

function iconFor(category: string) {
  return CATEGORY_ICONS[category] ?? Square;
}

type Props = {
  unitId: string;
  catalog: HomelabCatalogItem[];
  currentCatalogId: string | null;
  onSave: (catalogId: string | null) => void;
  onClose: () => void;
};

export function HomelabItemModal({ unitId, catalog, currentCatalogId, onSave, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(currentCatalogId);
  const selectedItem = catalog.find((item) => item.id === selectedId) ?? null;

  function handleSave() {
    onSave(selectedId);
    onClose();
  }

  return (
    <div
      className="homelab-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="homelab-modal">
        <div className="homelab-modal-header">
          <div>
            <h2>CONFIGURER {unitId}</h2>
            <p>BAIE — INFRASTRUCTURE NÉRON</p>
          </div>
          <button className="homelab-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="homelab-modal-body">
          <label className="homelab-modal-label">Matériel disponible</label>
          <div className="homelab-catalog-grid">
            {catalog.length === 0 && (
              <p className="homelab-catalog-empty">Aucun matériel dans le catalogue.</p>
            )}
            {catalog.map((item) => {
              const Icon = iconFor(item.category);
              const active = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  className={`homelab-catalog-item${active ? ' active' : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                  {active && <Check size={14} className="homelab-catalog-check" />}
                </button>
              );
            })}
          </div>

          {selectedItem && (
            <div className="homelab-item-preview">
              <strong>{selectedItem.name}</strong>
              <p className="homelab-item-specs">{selectedItem.specs}</p>
              <p className="homelab-item-description">{selectedItem.description}</p>
              <button className="homelab-item-remove" onClick={() => setSelectedId(null)}>
                Retirer ce matériel de {unitId}
              </button>
            </div>
          )}
        </div>

        <div className="homelab-modal-footer">
          <button className="homelab-modal-cancel" onClick={onClose}>ANNULER</button>
          <button className="homelab-modal-save" onClick={handleSave}>SAUVEGARDER</button>
        </div>
      </div>
    </div>
  );
}
