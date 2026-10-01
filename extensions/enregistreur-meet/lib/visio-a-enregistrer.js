// « Enregistrer cette visio ? » → « Oui, enregistrer » (1.3.0, 2026-10-01).
//
// Module PUR : le relais de la console (`relais-console.js`) transmet
// l'identifiant du lien cliqué ; le service worker le MÉMORISE 30 minutes et
// le panneau PRÉ-SÉLECTIONNE le rendez-vous. Rien ne démarre ici : la capture
// exige toujours le clic « Démarrer » au moment de l'annonce.

import { BASE_API } from "./constantes.js";

/** Attributs posés par la console (`RejoindreVisioBouton`), recopiés dans le relais. */
export const ATTRIBUT_OUI = "data-enregistrer-visio";
export const ATTRIBUT_NON = "data-sans-enregistrement";

/**
 * Badge de l'icône quand Chrome refuse d'ouvrir le panneau : neutre, jamais
 * « REC » (rien n'enregistre tant que « Démarrer » n'est pas cliqué).
 */
export const BADGE_PRET = "PRÊT";

/** Alarme qui efface la mémoire (et le badge) à son expiration. */
export const ALARME_MEMOIRE = "visio-a-enregistrer";

/** Durée de vie du « rendez-vous à enregistrer ». */
export const DUREE_MEMOIRE_MS = 30 * 60 * 1000;

/** Rencontre (uuid) ou `CalendlyEvent.id` : jamais un texte libre. */
const IDENTIFIANT = /^[A-Za-z0-9_-]{1,64}$/;

const ORIGINE_CONSOLE = new URL(BASE_API).origin;
const TYPES_DU_RELAIS = new Set(["visio_a_enregistrer", "visio_sans_enregistrement"]);

/**
 * Trie un message reçu : `interne` (panneau, options, offscreen), `relais`
 * (l'un des deux messages du relais, depuis la console) ou `refuse`. Un onglet
 * ne pilote JAMAIS l'enregistreur : seuls ses deux messages passent.
 */
export function messageAccepte(msg, envoyeur, idExtension) {
  if (!envoyeur || envoyeur.id !== idExtension) return "refuse";
  if (!envoyeur.tab) return "interne";
  let origine = envoyeur.origin ?? null;
  if (!origine && envoyeur.url) {
    try {
      origine = new URL(envoyeur.url).origin;
    } catch {
      origine = null;
    }
  }
  if (origine !== ORIGINE_CONSOLE || !TYPES_DU_RELAIS.has(msg?.type)) return "refuse";
  if (msg.type === "visio_a_enregistrer" && !IDENTIFIANT.test(String(msg.identifiant ?? ""))) {
    return "refuse";
  }
  return "relais";
}

/** Ce qui est gardé en stockage de session : l'identifiant et son expiration. */
export function memoriserVisio(identifiant, maintenant) {
  if (typeof identifiant !== "string" || !IDENTIFIANT.test(identifiant)) return null;
  return { identifiant, expireLe: maintenant + DUREE_MEMOIRE_MS };
}

/** L'identifiant mémorisé, ou `null` s'il n'y en a pas ou s'il a expiré. */
export function visioMemorisee(memoire, maintenant) {
  if (!memoire || typeof memoire.expireLe !== "number" || maintenant >= memoire.expireLe) {
    return null;
  }
  return memoire.identifiant ?? null;
}

const PHASES_AU_REPOS = new Set(["repos", "termine", "detruit"]);

/**
 * La rencontre à pré-sélectionner, au repos seulement (une capture en cours
 * n'est jamais touchée), retrouvée par son identifiant ou par l'identifiant
 * Calendly du rendez-vous. `null` : rien à pré-sélectionner.
 */
export function preselection({ phase, rencontres }, memoire, maintenant) {
  if (!PHASES_AU_REPOS.has(phase)) return null;
  const id = visioMemorisee(memoire, maintenant);
  if (!id) return null;
  const r = (rencontres ?? []).find((x) => x.rencontreId === id || x.calendlyEventId === id);
  return r ? { rencontreChoisie: r.rencontreId, miseEnAvant: true } : null;
}
