/**
 * Identite d'appareil pour la presence multi-appareils (chantier avatar_presence).
 * L'id est un UUID genere une seule fois et stocke en localStorage : stable
 * tant que l'utilisateur ne vide pas les donnees du site. Le libelle est
 * choisi par l'utilisateur lui-meme (pas derive du user-agent).
 */

const ID_KEY = 'neron.device.id';
const LABEL_KEY = 'neron.device.label';

export function getDeviceId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getDeviceLabel(): string | null {
  return localStorage.getItem(LABEL_KEY);
}

export function setDeviceLabel(label: string): void {
  localStorage.setItem(LABEL_KEY, label);
}

/** Renvoie le libelle stocke, ou demande a l'utilisateur de le choisir. */
export function ensureDeviceLabel(): string {
  let label = getDeviceLabel();
  if (!label) {
    label = window.prompt('Comment veux-tu nommer cet appareil ? (ex. "PC du salon")', '') || 'Appareil sans nom';
    setDeviceLabel(label);
  }
  return label;
}
