export type DeviceType = 'switch' | 'firewall' | 'server' | 'gpu_server' | 'nas' | 'ups' | 'home_assistant';

export type UnitId = 'U1' | 'U2' | 'U3' | 'U4' | 'U5';

export type MetricSpec = { label: string; unit: string; generate: () => number | string };

type Base = { label: string; accentHex: string; status: 'online' | 'alert' | 'offline'; isReal?: boolean };

export type SwitchConfig = Base & { type: 'switch'; portCount: 8 | 16 | 24 | 48; speed: string };
export type FirewallConfig = Base & { type: 'firewall'; software: string };
export type ServerConfig = Base & { type: 'server'; cpuCores: number; ramGB: number; services: string[] };
export type GPUServerConfig = Base & { type: 'gpu_server'; gpuModel: string; vramGB: number; services: string[] };
export type NASConfig = Base & { type: 'nas'; driveCount: number; raidType: string; filesystem: string };
export type UPSConfig = Base & { type: 'ups'; brand: string; capacityVA: number };
export type HomeAssistantConfig = Base & { type: 'home_assistant'; deviceCount: number };

export type SlotConfig =
  | SwitchConfig
  | FirewallConfig
  | ServerConfig
  | GPUServerConfig
  | NASConfig
  | UPSConfig
  | HomeAssistantConfig;

export type RackState = Record<UnitId, SlotConfig>;

export function getServices(config: SlotConfig): string[] {
  if (config.type === 'server') return config.services;
  if (config.type === 'gpu_server') return config.services;
  if (config.type === 'firewall') return [config.software, 'WireGuard', 'Suricata'];
  if (config.type === 'switch') return [`${config.portCount}p ${config.speed}`, 'VLAN', 'QoS'];
  if (config.type === 'nas') return [config.filesystem, config.raidType, 'SMB/NFS'];
  if (config.type === 'ups') return [config.brand, `${config.capacityVA}VA`];
  if (config.type === 'home_assistant') return ['HASS Core', 'Mosquitto', 'Zigbee2MQTT'];
  return [];
}

export const DEFAULT_RACK: RackState = {
  U1: { type: 'switch', label: 'Switch 10 GbE', accentHex: '#22d3ee', status: 'online', portCount: 24, speed: '10G' },
  U2: { type: 'firewall', label: 'Firewall / Routeur', accentHex: '#f97316', status: 'online', software: 'OPNsense' },
  U3: {
    type: 'server', label: 'Néron Core', accentHex: '#a855f7', status: 'online', isReal: true,
    cpuCores: 16, ramGB: 64, services: ['NéronOS', 'API Gateway', 'Orchestrateur'],
  },
  U4: {
    type: 'server', label: 'Néron Memory', accentHex: '#3b82f6', status: 'online',
    cpuCores: 8, ramGB: 32, services: ['Oblivia', 'SQLite', 'Redis'],
  },
  U5: {
    type: 'gpu_server', label: 'Provider LLM', accentHex: '#22c55e', status: 'online',
    gpuModel: 'RTX 3090', vramGB: 24, services: ['Ollama', 'vLLM'],
  },
};

export const UNIT_IDS: UnitId[] = ['U1', 'U2', 'U3', 'U4', 'U5'];
