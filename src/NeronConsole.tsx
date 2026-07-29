import { Activity, Bell, Bot, Cpu, Database, Home, MessageSquare, Mic, Server, Settings, Sun, Target, Terminal, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CommandBar } from './components/CommandBar';
import { FloatingWindow } from './components/FloatingWindow';
export type OrbState = 'idle' | 'thinking' | 'working' | 'alert';
import { ConversationPanel } from './features/conversation';
import { HomelabPanel } from './features/homelab';
import { MemoryPanel } from './features/memory';
import { SelfModelPanel } from './features/selfmodel';
import { SystemPanel } from './features/system';
import { VocalPanel } from './features/vocal';
import { WikipediaPanel, type WikipediaData } from './features/wikipedia/WikipediaPanel';
import { useNeronEvents } from './hooks/useNeronEvents';
import { useNeron } from './hooks/useNeron';
import {
  getHealth,
  getHomelabData,
  getSystemdUnits,
  getSystemResources,
  type HomelabData,
  type NeronHealth,
  type SystemdData,
  type SystemResources,
} from './lib/neronApi';

type WindowId = 'conversation' | 'dashboard' | 'homelab' | 'vocal' | 'goals' | 'memory' | 'wikipedia' | 'instagram' | 'internet' | 'x' | 'facebook' | 'youtube';

type WindowRuntimeState = {
  x: number;
  y: number;
  width: number;
  minimized: boolean;
  pinned: boolean;
  z: number;
};

const STATUS_LABEL: Record<string, string> = {
  connecting: 'Connexion…',
  connected: 'Connecté',
  disconnected: 'Déconnecté — reconnexion…',
  error: 'Erreur de connexion',
};

const initialLayout: Record<WindowId, Omit<WindowRuntimeState, 'z' | 'minimized' | 'pinned'>> = {
  conversation: { x: 270, y: 110, width: 430 },
  dashboard: { x: 980, y: 110, width: 470 },
  homelab: { x: 260, y: 585, width: 430 },
  vocal: { x: 1010, y: 610, width: 390 },
  goals: { x: 760, y: 560, width: 370 },
  memory: { x: 760, y: 120, width: 370 },
  wikipedia: { x: 940, y: 100, width: 460 },
  internet: { x: 940, y: 100, width: 460 },
  facebook: { x: 1420, y: 100, width: 460 },
  instagram: { x: 1420, y: 320, width: 460 },
  x: { x: 1420, y: 540, width: 460 },
  youtube: { x: 1420, y: 760, width: 460 },
};

const titles: Record<WindowId, string> = {
  conversation: 'Conversation',
  dashboard: 'Système',
  homelab: 'Homelab',
  vocal: 'Vocal',
  goals: 'Goals',
  memory: 'Mémoire',
  wikipedia: 'Wikipédia',
  instagram: 'Instagram',
  internet: 'Internet',
  x: 'X',
  facebook: 'Facebook',
  youtube: 'YouTube',
};

type NavItem = { id: string; label: string; icon: typeof Home; target: WindowId | null };

const nav: NavItem[] = [
  { id: 'home', label: 'Accueil', icon: Home, target: null },
  { id: 'conversation', label: 'Conversation', icon: MessageSquare, target: 'conversation' },
  { id: 'goals', label: 'Goals', icon: Target, target: 'goals' },
  { id: 'agents', label: 'Agents', icon: Users, target: null },
  { id: 'memory', label: 'Mémoire', icon: Database, target: 'memory' },
  { id: 'system', label: 'Système', icon: Cpu, target: 'dashboard' },
  { id: 'homelab', label: 'Homelab', icon: Server, target: 'homelab' },
  { id: 'vocal', label: 'Vocal', icon: Mic, target: 'vocal' },
  { id: 'settings', label: 'Paramètres', icon: Settings, target: null },
];

type SystemProps = {
  health: NeronHealth | null;
  healthError: boolean;
  systemd: SystemdData | null;
};

type ConversationProps = {
  messages: import('./lib/neronApi').ChatMessage[];
  status: import('./lib/neronApi').ConnectionStatus;
  isStreaming: boolean;
  isThinking: boolean;
  clear: () => void;
};

type HomelabProps = {
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
  conversation: ConversationProps,
  instagram: WikipediaData,
  internet: WikipediaData,
  xData: WikipediaData,
  facebookData: WikipediaData,
  youtubeData: WikipediaData,
) {
  switch (id) {
    case 'dashboard': return <SystemPanel {...system} />;
    case 'homelab': return <HomelabPanel {...homelab} />;
    case 'vocal': return <VocalPanel />;
    case 'goals': return <SelfModelPanel />;
    case 'memory': return <MemoryPanel />;
    case 'wikipedia': return <WikipediaPanel data={wikipedia} />;
    case 'instagram': return <WikipediaPanel data={instagram} />;
    case 'internet': return <WikipediaPanel data={internet} />;
    case 'x': return <WikipediaPanel data={xData} />;
    case 'facebook': return <WikipediaPanel data={facebookData} />;
    case 'youtube': return <WikipediaPanel data={youtubeData} />;
    default: return <ConversationPanel setOrbState={setOrbState} {...conversation} />;
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
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString('fr-FR'));

  const [health, setHealth] = useState<NeronHealth | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [systemd, setSystemd] = useState<SystemdData | null>(null);
  const [resources, setResources] = useState<SystemResources | null>(null);
  const [homelab, setHomelab] = useState<HomelabData | null>(null);
  const [wikipedia, setWikipedia] = useState<WikipediaData>(null);
  const [instagram, setInstagram] = useState<WikipediaData>(null);
  const [internet, setInternet] = useState<WikipediaData>(null);
  const [xData, setXData] = useState<WikipediaData>(null);
  const [facebookData, setFacebookData] = useState<WikipediaData>(null);
  const [youtubeData, setYoutubeData] = useState<WikipediaData>(null);
  const prevStatuses = useRef<Record<string, string>>({});
  const wasResourceAlert = useRef(false);
  const openWindowRef = useRef<(id: WindowId) => void>(() => {});
  const closeWindowRef = useRef<(id: WindowId) => void>(() => {});
  const inactivityTimerRef = useRef<number | null>(null);

  const lastEvent = useNeronEvents();
  const { messages, status, isStreaming, isThinking, send, clear } = useNeron();

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
    closeWindowRef.current = closeWindow;
  });

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.event === 'memory.wikipedia_fallback') {
      const data = lastEvent.data as Record<string, unknown>;
      const payload = {
        query: (data.query as string) ?? '',
        title: (data.title as string) ?? null,
        url: (data.url as string) ?? null,
        summary: (data.summary as string) ?? null,
        image_url: (data.image_url as string) ?? null,
      };
      if (data.source === 'instagram') {
        setInstagram(payload);
        openWindowRef.current('instagram');
      } else if (data.source === 'web') {
        setInternet(payload);
        closeWindowRef.current('wikipedia');
        openWindowRef.current('internet');
      } else if (data.source === 'x') {
        setXData(payload);
        openWindowRef.current('x');
      } else if (data.source === 'facebook') {
        setFacebookData(payload);
        openWindowRef.current('facebook');
      } else if (data.source === 'youtube') {
        setYoutubeData(payload);
        openWindowRef.current('youtube');
      } else {
        setWikipedia(payload);
        closeWindowRef.current('internet');
        openWindowRef.current('wikipedia');
      }
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

      getSystemdUnits()
        .then((data) => {
          if (cancelled) return;
          const units = data?.units ?? [];
          const nextStatuses: Record<string, string> = {};
          let changed = false;
          for (const unit of units) {
            nextStatuses[unit.key] = unit.active_state;
            if (unit.group !== 'applicatif') continue;
            const prev = prevStatuses.current[unit.key];
            const bad = unit.active_state === 'failed' || unit.active_state === 'inactive';
            if (prev !== undefined && prev !== unit.active_state && bad) changed = true;
          }
          prevStatuses.current = nextStatuses;
          setSystemd(data);
          if (changed) openWindowRef.current('dashboard');
        })
        .catch(() => { if (!cancelled) setSystemd(null); });
    }

    poll();
    const id = window.setInterval(poll, 2000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  function resetInactivityTimer() {
    if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = window.setTimeout(() => {
      setOpenWindows((current) => current.filter((id) => windows[id]?.pinned));
    }, 60000);
  }

  function closeWindow(id: WindowId) {
    setOpenWindows((current) => current.filter((windowId) => windowId !== id));
  }

  function bringToFront(id: WindowId) {
    resetInactivityTimer();
    setTopZ((z) => {
      const nextZ = z + 1;
      setWindows((current) => ({ ...current, [id]: { ...current[id], z: nextZ } }));
      return nextZ;
    });
  }

  function moveWindow(id: WindowId, x: number, y: number) {
    resetInactivityTimer();
    setWindows((current) => ({ ...current, [id]: { ...current[id], x, y } }));
  }

  function toggleMinimize(id: WindowId) {
    setWindows((current) => ({ ...current, [id]: { ...current[id], minimized: !current[id].minimized } }));
  }

  function togglePin(id: WindowId) {
    setWindows((current) => ({ ...current, [id]: { ...current[id], pinned: !current[id].pinned } }));
  }

  function handleCommand(command: string) {
    resetInactivityTimer();
    const text = command.toLowerCase();
    if (text.includes('système') || text.includes('status') || text.includes('dashboard')) return openWindow('dashboard');
    if (text.includes('homelab') || text.includes('serveur')) return openWindow('homelab');
    if (text.includes('vocal') || text.includes('micro')) return openWindow('vocal');
    if (text.includes('goal') || text.includes('objectif')) return openWindow('goals');
    if (text.includes('mémoire') || text.includes('memory')) return openWindow('memory');
    closeWindow('wikipedia');
    closeWindow('internet');
    closeWindow('instagram');
    closeWindow('x');
    closeWindow('facebook');
    closeWindow('youtube');
    openWindow('conversation');
    send(command);
  }

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date().toLocaleTimeString('fr-FR')), 1000);
    return () => window.clearInterval(t);
  }, []);

  const cpu = Math.round(resources?.cpu_pct ?? 0);
  const ram = Math.round(resources?.ram_pct ?? 0);
  const disk = Math.round(resources?.disk_pct ?? 0);
  const activity = Math.round((cpu + ram + disk) / 3);
  const online = !healthError && status === 'connected';

  return (
    <main className="console-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-orb" />
          <div>
            <strong>NéronOS</strong>
            <small>Home Lab Assistant</small>
          </div>
        </div>

        <div className="sidebar-orb"><span /></div>

        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.target !== null && openWindows.includes(item.target);
            return (
              <button
                key={item.id}
                className={active ? 'nav-item active' : 'nav-item'}
                onClick={() => (item.target ? openWindow(item.target) : setOpenWindows([]))}
              >
                <Icon size={17} /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-agent">
          <div className="agent-avatar" />
          <div>
            <strong>Néron</strong>
            <small className={online ? 'ok' : 'ko'}>{STATUS_LABEL[status] ?? status}</small>
          </div>
        </div>

        <div className="sidebar-metrics">
          <div className="metric-line"><span>Activité système</span><b>{activity}%</b></div>
          <div className="metric-bar"><i style={{ width: activity + '%' }} /></div>
          <div className="metric-line"><span>Charge CPU</span><b>{cpu}%</b></div>
          <div className="metric-bar"><i style={{ width: cpu + '%' }} /></div>
          <div className="metric-line"><span>Mémoire</span><b>{ram}%</b></div>
          <div className="metric-bar"><i style={{ width: ram + '%' }} /></div>
          <div className="metric-line"><span>Disque</span><b>{disk}%</b></div>
          <div className="metric-bar"><i style={{ width: disk + '%' }} /></div>
        </div>


        <div className="sidebar-footer">
{/*
          <button title="Terminal"><Terminal size={16} /></button>
          <button title="Thème"><Sun size={16} /></button>
*/}
        </div>

      </aside>

      <header className="topbar">
        <div className="wordmark-block">
          <div className="wordmark">NÉRON</div>
          <div className="version">{health?.version ? `v${health.version}` : '—'}</div>
        </div>
        <div className="top-actions">
          <span className="clock">{clock}</span>
          <span className={online ? 'pill' : 'pill pill-off'}>● {online ? 'Online' : 'Offline'}</span>
          <button title="Notifications"><Bell size={17} /></button>
          <button title="Paramètres"><Settings size={17} /></button>
        </div>
      </header>

      <div className={'orb-zone orb-' + orbState}>
        <div className="orb-stage">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="orb-core"><div className="orb-glow" /></div>
          <div className="orb-ring-base" />
        </div>
      </div>

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
          {renderPanel(win.id, orbState, setOrbState, { health, healthError, systemd }, { resources, homelab, onSlotSaved: () => getHomelabData().then(setHomelab) }, wikipedia, { messages, status, isStreaming, isThinking, clear }, instagram, internet, xData, facebookData, youtubeData)}
        </FloatingWindow>
      ))}

      <CommandBar onCommand={handleCommand} />

      <div className="dock">
{/*
        <button title="Conversation" onClick={() => openWindow('conversation')}><MessageSquare size={19} /></button>
        <button title="Goals" onClick={() => openWindow('goals')}><Target size={19} /></button>
        <button title="Agents" onClick={() => openWindow('vocal')}><Bot size={19} /></button>
        <button className="dock-orb" title="Accueil" onClick={() => setOpenWindows([])} />
        <button title="Mémoire" onClick={() => openWindow('memory')}><Database size={19} /></button>
        <button title="Homelab" onClick={() => openWindow('homelab')}><Server size={19} /></button>
        <button title="Système" onClick={() => openWindow('dashboard')}><Cpu size={19} /></button>
*/}
      </div>

      <div className={online ? 'status-left' : 'status-left ko'}>
        <Activity size={13} /> {online ? 'Tous les systèmes opérationnels.' : 'Connexion au Core dégradée.'}
      </div>
      <div className="connection-state">● {online ? 'Connecté à Néron Core' : 'Néron Core injoignable'}</div>
    </main>
  );
}
