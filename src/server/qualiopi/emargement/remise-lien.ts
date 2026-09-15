/**
 * Un lien d'émargement vivant est-il entre les mains de quelqu'un ? Module PUR.
 *
 * ## Pourquoi cette question existe
 *
 * Un seul jeton vivant par inscription (index unique partiel) : émettre un lien
 * neuf RÉVOQUE le précédent. L'envoi automatique ne peut donc pas « renvoyer »
 * un lien — il le remplace. Avant de remplacer, il faut savoir si le lien en
 * place sert à quelqu'un.
 *
 * ## Les quatre raisons de ne PAS remplacer
 *
 *  · **remis** — `envoyeAt` posé : l'e-mail est parti, le stagiaire l'a.
 *  · **héritage** — jeton antérieur à la colonne `envoyeAt` : on ne peut pas
 *    savoir s'il a été remis, et le révoquer fabriquerait un émargement perdu.
 *  · **ouvert** — `usedAt` posé : quelqu'un a déjà ouvert ce lien (QR scanné,
 *    lien cliqué). Il est entre ses mains, peu importe comment il y est arrivé.
 *  · **fabriqué aujourd'hui** (heure de Paris) — un QR fabriqué le jour même est
 *    à l'écran ou imprimé pour la séance du jour. Le tuer à la minute où la
 *    salle le scanne serait pire que de ne rien envoyer.
 *
 * ⚠️ Ce qui reste REMPLAÇABLE, et c'est voulu : un lien fabriqué un AUTRE jour,
 * jamais envoyé, jamais ouvert. C'est exactement AXI-SESS-2026-001 — jetons
 * fabriqués la veille par « Émettre les liens », qui n'envoie rien, et une
 * stagiaire qui n'a rien reçu. Le résidu est connu et DIT à l'écran : un QR
 * imprimé la veille et jamais scanné cesse de fonctionner quand l'envoi
 * automatique part.
 *
 * ## Deux écritures, une règle
 *
 * `raisonDeNePasRemplacer` juge en mémoire ; `whereJetonIntouchable` dit la
 * même chose à Postgres pour que le cron ne réveille pas une session sans
 * travail. Elles vivent ici côte à côte et se testent ensemble : une règle
 * recopiée dans un autre fichier diverge au premier changement.
 *
 * Aucun import Prisma, aucune horloge implicite : worker-safe et testable.
 */

import { parisDateISO, parisMinutesDuJour } from "@/server/qualiopi/presence/time";

/**
 * Frontière entre l'ancienne sémantique des jetons et la nouvelle.
 *
 * Un jeton créé AVANT la migration `20260906140000_emargement_token_envoye_at`
 * porte `envoyeAt = NULL` qu'il ait été remis ou non — la colonne n'existait
 * pas. Le lire comme « jamais envoyé » ferait réémettre, donc révoquer, un lien
 * peut-être déjà entre les mains d'un stagiaire.
 */
export const SEUIL_ENVOYE_AT = new Date("2026-09-06T14:00:00.000Z");

export interface JetonVivant {
  readonly envoyeAt: Date | null;
  readonly usedAt: Date | null;
  readonly createdAt: Date;
}

export type RaisonDeNePasRemplacer = "remis" | "heritage" | "ouvert" | "fabrique_aujourdhui";

/** Instant UTC de minuit, heure de Paris, du jour civil de `maintenant`. */
export function debutJourParis(maintenant: Date): Date {
  const minuitUtc = new Date(`${parisDateISO(maintenant)}T00:00:00.000Z`);
  // À minuit UTC, Paris affiche 01:00 (hiver) ou 02:00 (été) : c'est le décalage.
  return new Date(minuitUtc.getTime() - parisMinutesDuJour(minuitUtc) * 60_000);
}

/** `null` = le lien n'est entre les mains de personne : il peut être remplacé. */
export function raisonDeNePasRemplacer(
  jeton: JetonVivant,
  maintenant: Date,
): RaisonDeNePasRemplacer | null {
  if (jeton.envoyeAt !== null) return "remis";
  if (jeton.createdAt.getTime() < SEUIL_ENVOYE_AT.getTime()) return "heritage";
  if (jeton.usedAt !== null) return "ouvert";
  if (jeton.createdAt.getTime() >= debutJourParis(maintenant).getTime()) {
    return "fabrique_aujourdhui";
  }
  return null;
}

/**
 * L'inscription attend-elle encore son lien ?
 *
 * @param jetonsVivants jetons NON révoqués et NON expirés de l'inscription.
 */
export function inscriptionAttendSonLien(
  jetonsVivants: ReadonlyArray<JetonVivant>,
  maintenant: Date,
): boolean {
  return jetonsVivants.every((j) => raisonDeNePasRemplacer(j, maintenant) === null);
}

/**
 * Fragment de `where` sur `EmargementToken` : un jeton vivant intouchable.
 *
 * S'emploie sous `emargementTokens: { none: … }` pour sélectionner les
 * inscriptions qui attendent leur lien — la même règle que
 * `inscriptionAttendSonLien`, dite à la base.
 */
export function whereJetonIntouchable(maintenant: Date): Record<string, unknown> {
  return {
    revokedAt: null,
    expiresAt: { gt: maintenant },
    OR: [
      { envoyeAt: { not: null } },
      { createdAt: { lt: SEUIL_ENVOYE_AT } },
      { usedAt: { not: null } },
      { createdAt: { gte: debutJourParis(maintenant) } },
    ],
  };
}
