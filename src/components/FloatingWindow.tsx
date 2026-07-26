import { Minus, Pin, X } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, type ReactNode, useRef } from 'react';

export type FloatingWindowProps = {
  title: string;
  children: ReactNode;
  x: number;
  y: number;
  width?: number;
  zIndex: number;
  minimized?: boolean;
  pinned?: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onTogglePin: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
};

export function FloatingWindow({
  title,
  children,
  x,
  y,
  width = 420,
  zIndex,
  minimized = false,
  pinned = false,
  onClose,
  onMinimize,
  onTogglePin,
  onFocus,
  onMove,
}: FloatingWindowProps) {
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    // Ignore drags initiated on interactive controls in the header.
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    onFocus();
    dragState.current = { startX: event.clientX, startY: event.clientY, originX: x, originY: y };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!dragState.current) return;
    event.preventDefault();   
    const { startX, startY, originX, originY } = dragState.current;
    const nextX = Math.max(8, originX + (event.clientX - startX));
    const nextY = Math.max(8, originY + (event.clientY - startY));
    onMove(nextX, nextY);
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault();
    dragState.current = null;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  }

  return (
    <section
      className={`floating-window${minimized ? ' minimized' : ''}`}
      style={{ left: x, top: y, width, zIndex }}
      onPointerDown={onFocus}
    >
      <header
        className="window-header"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="traffic-lights" aria-hidden="true">
          <span className="red" onClick={onClose} />
          <span className="yellow" onClick={onMinimize} />
          <span className="green" onClick={onTogglePin} />
        </div>
        <strong>{title}</strong>
        <div className="window-actions">
          <button onClick={onTogglePin} aria-label={`Épingler ${title}`} className={pinned ? 'active' : ''}>
            <Pin size={14} />
          </button>
          <button onClick={onMinimize} aria-label={`Réduire ${title}`}>
            <Minus size={14} />
          </button>
          <button onClick={onClose} aria-label={`Fermer ${title}`}>
            <X size={15} />
          </button>
        </div>
      </header>
      {!minimized && <div className="window-body">{children}</div>}
    </section>
  );
}
