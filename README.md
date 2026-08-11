# NéronWeb

Application centrale et interface unifiée plein écran de NéronOS. Anciennement
`neron-app`, ce shell regroupe désormais tous les anciens frontends (`legacy/dashboard`,
`legacy/homelab`, `legacy/vocal`, `legacy/web`) sous forme de fenêtres flottantes,
déplaçables à la souris, à l'intérieur d'une seule application.

## Architecture

- **Shell** (`NeronConsole.tsx`) : orbe central, sidebar de navigation, gestion des
  fenêtres (position, z-index, minimize, pin) et de la command bar.
- **`components/FloatingWindow.tsx`** : fenêtre flottante draggable (pointer events),
  mise au premier plan au focus, réductible et épinglable.
- **`features/<domaine>/`** : chaque ancien module devient un domaine fonctionnel isolé :
  - `conversation` — chat en direct via la Gateway WebSocket JSON-RPC de Néron
    (porté depuis `legacy/web/hooks/useNeron.ts`).
  - `vocal` — enregistrement micro (MediaRecorder), machine à états, statut des agents
    (porté depuis `legacy/vocal`, branché directement sur `/input/audio` et `/status`
    du Core plutôt que sur les routes proxy Next.js, puisque NéronWeb est un SPA Vite
    sans backend propre).
  - `homelab` — visualisation du rack avec métriques simulées en direct
    (modèle de données porté depuis `legacy/homelab/web/src/data/rackConfig.ts`).
  - `dashboard` (Système) — santé réelle du Core (`/health`) + statut des agents
    (`/status`) en plus des métriques.
  - `memory`, `selfmodel` — panneaux déjà présents, conservés tels quels.

Le shell reste seul responsable de la navigation et des fenêtres ; une feature ne doit
pas créer une seconde application.

## Installation et développement

```bash
cd /etc/neron/web/neronWeb
npm install
npm run dev
```

## Build

```bash
npm run build
npm run typecheck
npm run preview
```

## Connexion Néron Core

Configurer l'URL API dans `.env` :

```env
VITE_NERON_API_URL=http://localhost:8010
VITE_NERON_API_KEY=change-me
VITE_NERON_WS_URL=ws://localhost:18789
VITE_NERON_TOKEN=change-me
VITE_NERON_STT_URL=http://localhost:8001
```

Les appels REST sont centralisés dans `src/lib/neronApi.ts` (health, status, goal,
input texte/audio). Le chat temps réel passe par `src/hooks/useNeron.ts` (WebSocket
JSON-RPC vers la Gateway).

## Ce qui n'a volontairement pas été porté

- L'édition interactive du rack (`RackConfigModal`, 618 lignes, shadcn/ui) : le panneau
  Homelab actuel est en lecture seule. À réintroduire si besoin d'édition en direct.
- Les routes serveur Next.js de `legacy/vocal` (`/api/audio`, `/api/agents`, `/api/stt`) :
  leur logique de proxy a été portée côté client dans `neronApi.ts`, en appelant le Core
  directement. Cela suppose que `VITE_NERON_API_KEY` reste acceptable côté client (déjà
  le cas dans l'architecture existante de neron-app).
- Le backend Express + Drizzle de `legacy/dashboard` (chat storage, métriques serveur
  réelles via `os`) : non porté, car neronWeb reste un SPA statique sans serveur propre.
  Les dossiers `legacy/*` sont conservés intacts si ce backend doit être redéployé
  séparément et exposé au Core plus tard.

## Avatar

Le Dashboard attend un modèle VRM en `public/neron-avatar.vrm`.
Ce fichier n'est pas versionné (14 Mo, licence du modèle) : le déposer
manuellement après un clone, sinon l'avatar ne s'affiche pas.
