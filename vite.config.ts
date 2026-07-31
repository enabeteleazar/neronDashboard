import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// Source unique des secrets : le fichier designe par NERON_SECRETS_PATH,
// fourni par l'unite systemd. Aucune cle ne doit vivre dans .env.
const SECRETS_PATH = process.env.NERON_SECRETS_PATH ?? '/etc/neronOS/secrets.env';

function readSecret(name: string): string {
  try {
    for (const raw of readFileSync(SECRETS_PATH, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      if (line.slice(0, eq).trim() !== name) continue;
      return line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch (error) {
    console.warn(`[neron] secrets illisibles (${SECRETS_PATH}) :`, (error as Error).message);
  }
  return '';
}

const apiKey = readSecret('NERON_API_KEY');
if (!apiKey) {
  console.warn('[neron] ATTENTION : NERON_API_KEY introuvable, le bundle partira sans cle');
}

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_NERON_API_KEY': JSON.stringify(apiKey),
    'import.meta.env.VITE_NERON_TOKEN': JSON.stringify(apiKey),
  },
  server: {
    port: 8080,
    host: '0.0.0.0',
    // Necessaire depuis Vite 6 (protection anti DNS-rebinding) pour accepter
    // les requetes arrivant via le reverse proxy Tailscale Serve (Host
    // header = homebox.tail7f8e60.ts.net), en plus de localhost/IP locales.
    allowedHosts: ['homebox.tail7f8e60.ts.net'],
  }
});
