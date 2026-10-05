/**
 * État du formulaire VSL apporteurs : en MÉMOIRE (module) + `sessionStorage`.
 *
 * Pourquoi un magasin externe et pas un `useState` rempli dans un effet : le
 * serveur rend l'étape 1 vide ; relire `sessionStorage` à l'hydratation par un
 * `setState` dans un effet coûterait un rendu de plus (et la règle du dépôt
 * `react-hooks/set-state-in-effect` l'interdit). `useSyncExternalStore` donne le
 * snapshot serveur (étape 1, vide) à l'hydratation puis bascule sur la reprise
 * s'il y en a une — sans saut de mise en page (les deux étapes ont la même
 * hauteur minimale).
 *
 * Ce qui est gardé dans `sessionStorage` : l'étape, le prénom, l'e-mail, la
 * case de consentement, le jeton de reprise. JAMAIS le téléphone ni la réponse
 * (restent en mémoire). `sessionStorage` meurt avec l'onglet.
 */

import type { ReponseNombreDirigeants } from "@/features/commercial-application/lead-vsl-contrat";

const CLE = "axion-vsl-apporteur-v1";

export interface EtatVsl {
  etape: 1 | 2;
  prenom: string;
  email: string;
  consent: boolean;
  telephone: string;
  reponse: ReponseNombreDirigeants | "";
  jeton: string;
  leadId: string;
}

export const ETAT_VSL_INITIAL: EtatVsl = {
  etape: 1,
  prenom: "",
  email: "",
  consent: false,
  telephone: "",
  reponse: "",
  jeton: "",
  leadId: "",
};

let courant: EtatVsl = ETAT_VSL_INITIAL;
let charge = false;
const abonnes = new Set<() => void>();

function lireSession(): EtatVsl | null {
  try {
    const brut = window.sessionStorage.getItem(CLE);
    if (!brut) return null;
    const o = JSON.parse(brut) as Partial<EtatVsl>;
    const jeton = typeof o.jeton === "string" ? o.jeton.slice(0, 600) : "";
    return {
      ...ETAT_VSL_INITIAL,
      // Sans jeton, l'étape 2 n'a pas de sens : retour à l'étape 1.
      etape: o.etape === 2 && jeton ? 2 : 1,
      prenom: typeof o.prenom === "string" ? o.prenom.slice(0, 60) : "",
      email: typeof o.email === "string" ? o.email.slice(0, 180) : "",
      consent: o.consent === true,
      jeton,
      leadId: typeof o.leadId === "string" ? o.leadId.slice(0, 80) : "",
    };
  } catch {
    return null;
  }
}

function ecrireSession(e: EtatVsl): void {
  try {
    const { telephone: _telephone, reponse: _reponse, ...sauvegarde } = e;
    window.sessionStorage.setItem(CLE, JSON.stringify(sauvegarde));
  } catch {
    // Navigation privée / stockage bloqué : l'état reste en mémoire pour l'onglet.
  }
}

/**
 * Reprise depuis l'e-mail d'abandon : `?r=<jeton>` sur la page. Le jeton ne
 * permet QUE de terminer l'inscription de la personne qui a reçu le message
 * (elle a coché la case de consentement à l'étape 1) : on ouvre l'étape 2.
 */
function lireReprise(): EtatVsl | null {
  try {
    const r = new URLSearchParams(window.location.search).get("r");
    if (!r || r.length > 600 || !/^[A-Za-z0-9._~-]+$/.test(r)) return null;
    return { ...ETAT_VSL_INITIAL, etape: 2, consent: true, jeton: r };
  } catch {
    return null;
  }
}

export function lireEtatVsl(): EtatVsl {
  if (!charge) {
    charge = true;
    const reprise = lireReprise();
    const session = lireSession();
    // Un jeton de reprise plus récent que la session de l'onglet l'emporte.
    courant = reprise
      ? { ...(session ?? ETAT_VSL_INITIAL), etape: 2, consent: true, jeton: reprise.jeton }
      : (session ?? ETAT_VSL_INITIAL);
  }
  return courant;
}

export function lireEtatVslServeur(): EtatVsl {
  return ETAT_VSL_INITIAL;
}

export function abonnerEtatVsl(rappel: () => void): () => void {
  abonnes.add(rappel);
  return () => {
    abonnes.delete(rappel);
  };
}

export function majEtatVsl(patch: Partial<EtatVsl>): void {
  courant = { ...lireEtatVsl(), ...patch };
  ecrireSession(courant);
  abonnes.forEach((a) => a());
}

/** Prénom + e-mail mémorisés, pour préremplir Calendly sur la page de merci. */
export function lireIdentitePourMerci(): { prenom: string; email: string } | null {
  const e = lireSession();
  if (!e || !e.email) return null;
  return { prenom: e.prenom, email: e.email };
}

/** Réservé aux tests. */
export function __reinitialiserEtatVslPourTests(): void {
  courant = ETAT_VSL_INITIAL;
  charge = false;
  try {
    window.sessionStorage.removeItem(CLE);
  } catch {
    // ignoré
  }
  abonnes.forEach((a) => a());
}
