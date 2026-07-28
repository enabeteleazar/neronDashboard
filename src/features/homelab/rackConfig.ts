/** Presentation seule : la topologie vient du SelfModel. */

export type Display = { label: string; accentHex: string };

export const DISPLAY: Record<string, Display> = {
  core: { label: 'Néron Core', accentHex: '#a855f7' },
  llm: { label: 'Néron LLM', accentHex: '#22c55e' },
  goal: { label: 'Néron Goal', accentHex: '#22d3ee' },
  memory: { label: 'Néron Memory', accentHex: '#3b82f6' },
  voice: { label: 'Néron Voice', accentHex: '#f97316' },
  watchdog: { label: 'Watchdog', accentHex: '#f472b6' },
  doctor: { label: 'Doctor', accentHex: '#f472b6' },
  homeassistant: { label: 'Home Assistant', accentHex: '#f472b6' },
  searxng: { label: 'SearXNG', accentHex: '#f472b6' },
};

export const FALLBACK_ACCENT = '#64748b';

export function displayFor(key: string): Display {
  return DISPLAY[key] ?? { label: key, accentHex: FALLBACK_ACCENT };
}
