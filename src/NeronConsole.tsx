import { Activity, Bot, Cpu, Database, Home, Mic, Server, Settings, Target } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CommandBar } from './components/CommandBar';
import { FloatingWindow } from './components/FloatingWindow';
import { NeronOrb, type OrbState } from './components/NeronOrb';
import { ConversationPanel } from './features/conversation';
import { HomelabPanel } from './features/homelab';
import { MemoryPanel } from './features/memory';
import { SelfModelPanel } from './features/selfmodel';
import { SystemPanel } from './features/system';
import { VocalPanel } from './features/vocal';
import { WikipediaPanel, type WikipediaData } from './features/wikipedia/WikipediaPanel';
import { useNeronEvents } from './hooks/useNeronEvents';
import {
  getHealth,
  getHomelabData,
  getServices,
  getSystemResources,
  type HomelabData,
  type NeronHealth,
  type ServiceRegistration,
  type SystemResources,
} from './lib/neronApi';

type WindowId = 'conversation' | 'dashboard' | 'homelab' | 'vocal' | 'goals' | 'memory' | 'wikipedia';

type WindowRuntimeState = {
  x: number;
  y: number;
  width: number;
  minimized: boolean;
  pinned: boolean;
  z: number;
};

const initialLayout: Record<WindowId, Omit<WindowRuntimeState, 'z' | 'minimized' | 'pinned'>> = {
  conversation: { x: 270, y: 110, width: 430 },
  dashboard: { x: 980, y: 110, width: 470 },
  homelab: { x: 260, y: 585, width: 430 },
  vocal: { x: 1010, y: 610, width: 390 },
  goals: { x: 760, y: 560, width: 370 },
  memory: { x: 760, y: 120, width: 370 },
  wikipedia: { x: 480, y: 160, width: 520 },
};

const titles: Record<WindowId, string> = {
  conversation: 'Conversation',
  dashboard: 'Système',
  homelab: 'Homelab',
  vocal: 'Vocal',
  goals: 'Goals',
  memory: 'Mémoire',
  wikipedia: 'Wikipédia',
};

const nav = [
  { id: 'conversation' as const, label: 'Conversation', icon: Bot },
  { id: 'dashboard' as const, label: 'Système', icon: Cpu },
  { id: 'homelab' as const, label: 'Homelab', icon: Server },
  { id: 'vocal' as const, label: 'Vocal', icon: Mic },
  { id: 'goals' as const, label: 'Goals', icon: Target },
  { id: 'memory' as const, label: 'Mémoire', icon: Database },
];

type SystemProps = {
  health: NeronHealth | null;
  healthError: boolean;
  services: ServiceRegistration[] | null;
};

type HomelabProps = {
  services: ServiceRegistration[] | null;
  resources: SystemResources | null;
  homelab: HomelabData | null;
  onSlotSaved: () => void;
};

function renderPanel(
  id: WindowId,
  orbState: OrbState,
  setOrbState: (s: OrbState) => void,
  system: SystemProps,
  homelab: HomelabProps,
  wikipedia: WikipediaData,
) {
  switch (id) {
    case 'dashboard': return <SystemPanel {...system} />;
    case 'homelab': return <HomelabPanel {...homelab} />;
    case 'vocal': return <VocalPanel />;
    case 'goals': return <SelfModelPanel />;
    case 'memory': return <MemoryPanel />;
    case 'wikipedia': return <WikipediaPanel data={wikipedia} />;
    default: return <ConversationPanel orbState={orbState} setOrbState={setOrbState} />;
  }
}

function buildInitialWindows(): Record<WindowId, WindowRuntimeState> {
  const entries = Object.entries(initialLayout) as [WindowId, typeof initialLayout[WindowId]][];
  return Object.fromEntries(
    entries.map(([id, layout], index) => [
      id,
      { ...layout, minimized: false, pinned: false, z: 10 + index },
    ]),
  ) as Record<WindowId, WindowRuntimeState>;
}

export function NeronConsole() {
  const [openWindows, setOpenWindows] = useState<WindowId[]>([]);
  const [windows, setWindows] = useState<Record<WindowId, WindowRuntimeState>>(buildInitialWindows);
  const [topZ, setTopZ] = useState(20);
  const [orbState, setOrbState] = useState<OrbState>('idle');

  const [health, setHealth] = useState<NeronHealth | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [services, setServices] = useState<ServiceRegistration[] | null>(null);
  const [resources, setResources] = useState<SystemResources | null>(null);
  const [homelab, setHomelab] = useState<HomelabData | null>(null);
  const [wikipedia, setWikipedia] = useState<WikipediaData>(null);
  const prevStatuses = useRef<Record<string, string>>({});
  const wasResourceAlert = useRef(false);
  const openWindowRef = useRef<(id: WindowId) => void>(() => {});

  const lastEvent = useNeronEvents();

  const visibleWindows = useMemo(
    () => openWindows.map((id) => ({ id, ...windows[id] })),
    [openWindows, windows],
  );

  function openWindow(id: WindowId) {
    setOpenWindows((current) => (current.includes(id) ? current : [...current, id]));
    setWindows((current) => ({ ...current, [id]: { ...current[id], minimized: false } }));
    bringToFront(id);
    setOrbState('working');
    window.setTimeout(() => setOrbState('idle'), 1400);
  }

  useEffect(() => {
    openWindowRef.current = openWindow;
  });

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.event === 'memory.wikipedia_fallback') {
      const data = lastEvent.data as Record<string, unknown>;
      setWikipedia({
        query: (data.query as string) ?? '',
        title: (data.title as string) ?? null,
        url: (data.url as string) ?? null,
        summary: (data.summary as string) ?? null,
      });
      openWindowRef.current('wikipedia');
    }
  }, [lastEvent]);

  useEffect(() => {
    let cancelled = false;

    function poll() {
      getHealth()
        .then((data) => { if (!cancelled) { setHealth(data); setHealthError(false); } })
        .catch(() => { if (!cancelled) setHealthError(true); });

      getSystemResources().then((data) => {
        if (cancelled) return;
        setResources(data);
        const isAlert = [data.cpu_pct, data.ram_pct, data.disk_pct].some((v) => v != null && v >= 90);
        if (isAlert && !wasResourceAlert.current) openWindowRef.current('homelab');
        wasResourceAlert.current = isAlert;
      });

      getHomelabData().then((data) => {
        if (cancelled) return;
        setHomelab(data);
      });

      getServices()
        .then((data) => {
          if (cancelled) return;
          const list = data.services ?? [];
          const nextStatuses: Record<string, string> = {};
          let changed = false;
          for (const service of list) {
            nextStatuses[service.service_name] = service.status;
            const prev = prevStatuses.current[service.service_name];
            if (prev !== undefined && prev !== service.status) changed = true;
          }
          prevStatuses.current = nextStatuses;
          setServices(list);
          if (changed) openWindowRef.current('dashboard');
        })
        .catch(() => { if (!cancelled) setServices(null); });
    }

    poll();
    const id = window.setInterval(poll, 2000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  function closeWindow(id: WindowId) {
    setOpenWindows((current) => current.filter((windowId) => windowId !== id));
  }

  function bringToFront(id: WindowId) {
    setTopZ((z) => {
      const nextZ = z + 1;
      setWindows((current) => ({ ...current, [id]: { ...current[id], z: nextZ } }));
      return nextZ;
    });
  }

  function moveWindow(id: WindowId, x: number, y: number) {
    setWindows((current) => ({ ...current, [id]: { ...current[id], x, y } }));
  }

  function toggleMinimize(id: WindowId) {
    setWindows((current) => ({ ...current, [id]: { ...current[id], minimized: !current[id].minimized } }));
  }

  function togglePin(id: WindowId) {
    setWindows((current) => ({ ...current, [id]: { ...current[id], pinned: !current[id].pinned } }));
  }

  function handleCommand(command: string) {
    const text = command.toLowerCase();
    if (text.includes('système') || text.includes('status') || text.includes('dashboard')) return openWindow('dashboard');
    if (text.includes('homelab') || text.includes('serveur')) return openWindow('homelab');
    if (text.includes('vocal') || text.includes('micro')) return openWindow('vocal');
    if (text.includes('goal') || text.includes('objectif')) return openWindow('goals');
    if (text.includes('mémoire') || text.includes('memory')) return openWindow('memory');
    openWindow('conversation');
    setOrbState('thinking');
    window.setTimeout(() => setOrbState('idle'), 1600);
  }

  return (
    <main className="console-shell">
      <aside className="sidebar">
        <button className="nav-home"><Home size={18} /> Accueil</button>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} onClick={() => openWindow(item.id)}><Icon size={18} /> {item.label}</button>;
          })}
        </nav>
        <div className="sidebar-status">
          <Activity size={18} />
          <div><small>Aucune Notif .</small></div>
        </div>
      </aside>

      <header className="topbar">
        <div className="wordmark">NÉRON</div>
      </header>

      <section className="orb-zone">
        <NeronOrb state={orbState} />
      </section>

      {visibleWindows.map((win) => (
        <FloatingWindow
          key={win.id}
          title={titles[win.id]}
          x={win.x}
          y={win.y}
          width={win.width}
          zIndex={win.z}
          minimized={win.minimized}
          pinned={win.pinned}
          onClose={() => closeWindow(win.id)}
          onMinimize={() => toggleMinimize(win.id)}
          onTogglePin={() => togglePin(win.id)}
          onFocus={() => bringToFront(win.id)}
          onMove={(x, y) => moveWindow(win.id, x, y)}
        >
          {renderPanel(win.id, orbState, setOrbState, { health, healthError, services }, { services, resources, homelab, onSlotSaved: () => getHomelabData().then(setHomelab) }, wikipedia)}
        </FloatingWindow>
      ))}

      <CommandBar onCommand={handleCommand} />
    </main>
  );
}
