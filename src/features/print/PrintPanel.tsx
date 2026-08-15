import type { PrintData, PrinterEntry } from '../../lib/neronApi';

type PrintPanelProps = {
  print: PrintData | null;
};

function stateClass(reachable: boolean, state?: string): string {
  if (!reachable) return 'dot-offline';
  if (state === 'idle') return 'dot-online';
  if (state === 'processing') return 'dot-online';
  return 'dot-alert';
}

function InkGauges({ printer }: { printer: PrinterEntry }) {
  const supplies = printer.supplies;

  if (!supplies || !supplies.supported) {
    return <p className="rack-refresh-note">Niveaux d'encre non disponibles pour ce modele.</p>;
  }

  return (
    <div className="print-ink-levels">
      {supplies.levels.map((level) => (
        <div key={level.color} className="print-ink-level">
          <span className="print-ink-color">{level.color}</span>
          <span className="print-ink-percent">{level.percent}%</span>
        </div>
      ))}
    </div>
  );
}

function PrinterCard({ printer }: { printer: PrinterEntry }) {
  return (
    <article className="rack-slot">
      <div className="rack-slot-header">
        <span className={`rack-status-dot ${stateClass(printer.reachable, printer.state)}`} title={printer.state ?? 'inconnu'} />
        <strong>{printer.name}</strong>
      </div>

      <div className="print-status-row">
        <span>{printer.reachable ? (printer.state ?? 'inconnu') : 'injoignable'}</span>
        {printer.reachable && (
          <span>{printer.queued_jobs ?? 0} job(s) en file</span>
        )}
      </div>

      <InkGauges printer={printer} />
    </article>
  );
}

export function PrintPanel({ print }: PrintPanelProps) {
  const printers = print?.printers ?? [];

  if (printers.length === 0) {
    return <div className="rack-panel"><p className="rack-refresh-note">Aucune imprimante detectee.</p></div>;
  }

  return (
    <div className="rack-panel">
      {printers.map((printer) => (
        <PrinterCard key={printer.name} printer={printer} />
      ))}
    </div>
  );
}
