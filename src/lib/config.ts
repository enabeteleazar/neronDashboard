// Source unique des adresses et secrets du Dashboard.
// Secrets injectes au build par vite.config.ts depuis NERON_SECRETS_PATH.
// Adresses : chemins relatifs, tout transite par le reverse proxy Caddy sur
// une origine unique. Aucune variable d'environnement, donc rien a
// desynchroniser (panne silencieuse du 29/07).

// Bases d'URL : le prefixe est retire par Caddy (handle_path).
export const API_URL = '/api';
export const STT_URL = '/stt';

// WebSocket : URL absolue obligatoire. Suppose un acces via Caddy en HTTPS ;
// un acces direct sur :4400 ne fonctionnera pas.
export const WS_URL = 'wss://' + window.location.host + '/ws/';

// Repli vide et non 'changez_moi' : une absence de cle doit echouer franchement.
export const API_KEY = import.meta.env.VITE_NERON_API_KEY ?? '';
export const TOKEN = import.meta.env.VITE_NERON_TOKEN ?? '';
