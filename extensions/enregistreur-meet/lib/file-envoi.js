// La FILE D'ENVOI vers le site — règles PURES (le stockage est dans
// `stockage-local.js`, l'exécution dans `service-worker.js`).
//
//   · RIEN NE PART AVANT L'ACCORD : un morceau ou une fin de tranche n'est
//     envoyable que si sa capture a un accord et un enregistrement côté site ;
//   · ordre : sessions, accords et refus, morceaux, fins de tranche, fins —
//     chacun par date de création (un accord passe avant le son qu’il libère) ;
//   · nouvel essai avec délai doublé (2 s → 5 min) ;
//   · un refus, une clôture ou un accord manquant détruisent ce qui reste ;
//   · LE REFUS LUI-MÊME survit à la destruction : c'est un élément sans
//     `cleClient` (l'index de `detruireCapture` ne le voit pas), renvoyé
//     jusqu'à ce que le site réponde 2xx. Sans lui, un refus perdu (réseau
//     coupé) laissait l'enregistrement vivre côté site, puis partir en
//     transcription.

import { DELAIS_LOCAUX } from "./constantes.js";

const ORDRE = { refus: -1, session: 0, accord: 1, morceau: 2, tranche: 3, battement: 4, fin: 5 };

/**
 * L'élément « refus » d'un enregistrement côté site. Pas de `cleClient` : il
 * n'appartient à aucune capture, donc aucune destruction locale ne l'emporte.
 * Un seul par enregistrement (même `id`).
 *
 * @param {string} enregistrementId
 * @param {number} refusLeMs
 * @param {number} maintenantMs
 */
export function elementRefus(enregistrementId, refusLeMs, maintenantMs) {
  return {
    id: `refus:${enregistrementId}`,
    type: "refus",
    enregistrementId,
    creeLe: maintenantMs,
    essais: 0,
    corps: { refusLe: new Date(refusLeMs).toISOString() },
  };
}

/** Le délai avant le prochain essai, après `essais` échecs. */
export function delaiRenvoi(essais) {
  const d = DELAIS_LOCAUX.renvoiInitialMs * 2 ** Math.max(0, essais);
  return Math.min(d, DELAIS_LOCAUX.renvoiMaxMs);
}

/**
 * Les éléments envoyables maintenant, dans l'ordre.
 * Un refus n'a pas de `cleClient` (il n'appartient à aucune capture).
 * @template {{ id: string, type: string, cleClient?: string, enregistrementId?: string, prochainEssaiMs?: number, creeLe: number }} E
 * @param {E[]} elements
 * @param {Record<string, { accord: boolean, enregistrementId: string | null, detruit?: boolean }>} captures
 */
export function envoyablesMaintenant(elements, captures, maintenantMs) {
  return elements
    .filter((el) => {
      if ((el.prochainEssaiMs ?? 0) > maintenantMs) return false;
      // Le refus ne dépend d'aucune capture : il part tant qu'il n'a pas abouti.
      if (el.type === "refus") return typeof el.enregistrementId === "string";
      const c = el.cleClient === undefined ? undefined : captures[el.cleClient];
      if (!c || c.detruit) return false;
      if (el.type === "session") return true;
      // Tout le reste vise un enregistrement existant côté site.
      if (!c.enregistrementId) return false;
      if (el.type === "morceau" || el.type === "tranche" || el.type === "fin")
        return c.accord === true;
      return true;
    })
    .sort((a, b) => (ORDRE[a.type] ?? 9) - (ORDRE[b.type] ?? 9) || a.creeLe - b.creeLe);
}

/** Que faire d'un élément après la réponse du site ? */
export function classerReponse(type, statut, erreur) {
  if (statut >= 200 && statut < 300) return "fait";
  if (statut === 401 || statut === 403) return "jeton";
  if (type === "refus") {
    // Un refus se renvoie jusqu'au succès ; il ne s'abandonne que si le site
    // dit qu'il n'a plus d'objet (enregistrement inconnu, déjà traité).
    if (statut === 400 || statut === 404 || statut === 409) return "abandonner";
    return "reessayer";
  }
  // Client actif sous préavis : rien ne s'enregistrera, le son local est détruit.
  if (statut === 409 && erreur === "client_actif_preavis_en_cours") return "detruire";
  if (statut === 409) {
    if (erreur === "accord_en_attente") return "reessayer";
    if (erreur === "enregistrement_actif") return "fait";
    if (erreur === "morceau_divergent") return "abandonner";
    if (type === "session") return "detruire"; // refus motivé : hors liste, opposition…
    if (erreur === "enregistrement_clos") return "detruire";
    return "abandonner";
  }
  if (statut === 400 || statut === 404 || statut === 413 || statut === 415) return "abandonner";
  return "reessayer"; // 429, 5xx, réseau
}

/**
 * Détruit tout ce qui appartient à une capture (refus, accord absent, cas A).
 * @template {{ id: string, cleClient?: string }} T
 * @param {T[]} elements
 * @param {string} cleClient
 * @returns {T[]}
 */
export function purgerCapture(elements, cleClient) {
  return elements.filter((el) => el.cleClient !== cleClient);
}

/**
 * Interprète la réponse de `POST sessions`. Un 409 « enregistrement actif »
 * rend l'enregistrement qui vit : la capture s'y rattache (reprise après un
 * plantage, ou seconde capture sur la même rencontre).
 */
export function interpreterReponseSession(statut, corps) {
  if (statut === 200 && corps && typeof corps.enregistrementId === "string") {
    return { etat: "ok", enregistrementId: corps.enregistrementId, repris: corps.repris === true };
  }
  if (
    statut === 409 &&
    corps &&
    corps.erreur === "enregistrement_actif" &&
    typeof corps.enregistrementId === "string"
  ) {
    return { etat: "ok", enregistrementId: corps.enregistrementId, repris: true };
  }
  if (statut === 409)
    return { etat: "refuse", motif: corps?.erreur ?? "refus", message: corps?.message ?? "" };
  if (statut === 401 || statut === 403) return { etat: "jeton", message: corps?.message ?? "" };
  return { etat: "reessayer" };
}

/**
 * Une capture commencée SANS rencontre (rendez-vous créé pendant l'appel) :
 * une fois la rencontre choisie, sa session est créée et ses morceaux déjà
 * gardés localement partent vers ELLE. Rien n'est perdu.
 */
export function rattacherCapture(captures, cleClient, rencontreId) {
  const c = captures[cleClient];
  if (!c || c.detruit) return captures;
  return { ...captures, [cleClient]: { ...c, rencontreId } };
}

/**
 * Cas A : aucune rencontre autorisée 24 h après la fin → destruction locale.
 * Rend les clés des captures à détruire.
 */
export function capturesADetruire(captures, maintenantMs) {
  return Object.entries(captures)
    .filter(
      ([, c]) =>
        !c.detruit &&
        !c.enregistrementId &&
        c.finMs !== null &&
        c.finMs !== undefined &&
        maintenantMs - c.finMs >= DELAIS_LOCAUX.destructionSansRencontreMs,
    )
    .map(([cle]) => cle);
}
