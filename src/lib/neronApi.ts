const API_URL = import.meta.env.VITE_NERON_API_URL ?? 'http://localhost:8010';
const API_KEY = import.meta.env.VITE_NERON_API_KEY ?? '';
const STT_URL = import.meta.env.VITE_NERON_STT_URL ?? 'http://localhost:8001';

type ApiOptions = RequestInit & { auth?: boolean; timeoutMs?: number };

export async function neronFetch<T>(path: string, options: ApiOptions = {}, baseUrl: string = API_URL): Promise<T> {
  const { timeoutMs = 15000, auth, ...init } = options;
  const headers = new Headers(init.headers);

  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth !== false && API_KEY) {
    headers.set('Authorization', `Bearer ${API_KEY}`);
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Néron API error ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  } finally {
    window.clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type NeronHealth = {
  status?: string;
  version?: string;
  service?: string;
};

export type AgentInfo = {
  status: string;
  [key: string]: unknown;
};

export type NeronResources = {
  cpu_pct?: number;
  ram_pct?: number;
  disk_pct?: number;
};

export type NeronStatus = {
  agents?: Record<string, AgentInfo>;
  resources?: NeronResources;
  [key: string]: unknown;
};

// Correspond à CoreResponse (POST /input/text, /input/audio)
export type CoreResponse = {
  response: string;
  intent?: string;
  agent?: string;
  confidence?: string;
  timestamp?: string;
  execution_time_ms?: number;
  model?: string;
  error?: string;
  transcription?: string;
  metadata?: Record<string, unknown>;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming: boolean;
  timestamp: Date;
  error?: boolean;
};

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/* ------------------------------------------------------------------ */
/* Endpoints Néron Core                                                 */
/* ------------------------------------------------------------------ */

export async function getHealth() {
  return neronFetch<NeronHealth>('/health', { auth: false, timeoutMs: 5000 });
}

export async function getStatus() {
  return neronFetch<NeronStatus>('/status', { timeoutMs: 5000 });
}

export type ServiceRegistration = {
  service_name: string;
  host: string;
  port: number;
  version?: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  capabilities?: string[];
  metadata?: Record<string, unknown>;
};

export type SystemResources = {
  cpu_pct: number | null;
  ram_pct: number | null;
  disk_pct: number | null;
};

function extractGauge(text: string, name: string): number | null {
  const match = text.match(new RegExp(`^${name} ([0-9.]+)`, 'm'));
  return match ? Number(match[1]) : null;
}

export async function getSystemResources(): Promise<SystemResources> {
  const empty: SystemResources = { cpu_pct: null, ram_pct: null, disk_pct: null };
  try {
    const headers = new Headers();
    if (API_KEY) headers.set('Authorization', `Bearer ${API_KEY}`);
    const response = await fetch(`${API_URL}/self-model`, { headers });
    if (!response.ok) return empty;
    const data = await response.json();
    const runtime = data?.runtime ?? {};
    return {
      cpu_pct: runtime.cpu_usage ?? null,
      ram_pct: runtime.ram_usage ?? null,
      disk_pct: runtime.disk_usage ?? null,
    };
  } catch {
    return empty;
  }
}

export async function getServices() {
  return neronFetch<{ services: ServiceRegistration[]; count: number }>('/registry/services', { timeoutMs: 5000 });
}

export type HomelabCatalogItem = {
  id: string;
  name: string;
  category: string;
  specs: string;
  description: string;
};

export type RackOccupant = {
  key: string;
  ports: number[];
  state: 'actif' | 'injoignable' | 'inconnu';
  foreign: boolean;
  ram_mb?: number;
  cpu_percent?: number;
  uptime_seconds?: number;
};

export type Rack = {
  unit: string;
  host: string;
  occupants: RackOccupant[];
};

export type HomelabData = {
  catalog: HomelabCatalogItem[];
  slots: Record<string, string>;
  racks: Rack[];
};

export async function getHomelabData(): Promise<HomelabData> {
  const empty: HomelabData = { catalog: [], slots: {}, racks: [] };
  try {
    const headers = new Headers();
    if (API_KEY) headers.set('Authorization', `Bearer ${API_KEY}`);
    const response = await fetch(`${API_URL}/self-model`, { headers });
    if (!response.ok) return empty;
    const data = await response.json();
    return data?.homelab ?? empty;
  } catch {
    return empty;
  }
}

export async function setHomelabSlot(unitId: string, catalogId: string | null): Promise<boolean> {
  try {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (API_KEY) headers.set('Authorization', `Bearer ${API_KEY}`);
    const response = await fetch(`${API_URL}/self-model/homelab/slots/${unitId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ catalog_id: catalogId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendGoal(goal: string) {
  return neronFetch<{ response?: string; goal_id?: string }>('/goal', {
    method: 'POST',
    body: JSON.stringify({ goal }),
  });
}

export async function sendText(message: string) {
  return neronFetch<CoreResponse>('/input/text', {
    method: 'POST',
    body: JSON.stringify({ text: message }),
    timeoutMs: 30000,
  });
}

export async function sendAudio(blob: Blob) {
  const form = new FormData();
  form.append('audio', blob, 'input.webm');
  return neronFetch<CoreResponse>('/input/audio', {
    method: 'POST',
    body: form,
    timeoutMs: 120000,
  });
}

// Transcription brute (STT), microservice séparé du Core
export async function transcribeAudio(blob: Blob) {
  return neronFetch<{ text?: string; error?: string }>(
    '/transcribe',
    { method: 'POST', headers: { 'content-type': blob.type }, body: blob, timeoutMs: 30000, auth: false },
    STT_URL,
  );
}

export type SystemdUnit = {
  key: string;
  unit: string | null;
  group: 'applicatif' | 'peripherique' | 'externe';
  load_state: string;
  active_state: string;
  sub_state: string;
  restarts: number;
  since: string | null;
  main_pid: string | null;
  registered: boolean;
  state: 'ok' | 'unregistered' | 'orphan' | 'foreign';
  version: string | null;
  registry_status: string | null;
  host: string | null;
  port: number | null;
};

export type SystemdData = {
  available: boolean;
  reason?: string;
  units: SystemdUnit[];
};

export async function getSystemdUnits(): Promise<SystemdData> {
  const empty: SystemdData = { available: false, units: [] };
  try {
    const headers = new Headers();
    if (API_KEY) headers.set('Authorization', `Bearer ${API_KEY}`);
    const response = await fetch(`${API_URL}/self-model`, { headers });
    if (!response.ok) return empty;
    const data = await response.json();
    return data?.systemd ?? empty;
  } catch {
    return empty;
  }
}
