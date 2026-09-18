import "server-only";

/**
 * L'ACCUSÉ DE RÉCEPTION AUTOMATIQUE d'une candidature — lecture.
 *
 * ## Le défaut que ce module ferme (production, 2026-09-18)
 *
 * Le dépôt d'une candidature enfile un accusé (`candidature-recue`). Il part,
 * ou il échoue — pendant la panne du relais du 16 au 17/09, dix-huit sont
 * restés à quai. Mais la FICHE du candidat n'en disait rien : « Historique —
 * Rien n'a encore été consigné », que l'accusé soit livré, en échec ou jamais
 * enfilé. Le seul écran où on le voyait était « E-mails envoyés », qu'on
 * n'ouvre pas pour traiter un candidat.
 *
 * ## Ce que ce module rend, et ce qu'il ne rend pas
 *
 * L'ÉTAT de l'envoi, lu dans `email_logs` : envoyé (à quelle date, au bout de
 * combien d'essais), en file, en échec (avec un motif court), refusé par le
 * destinataire, annulé — ou ABSENT. Jamais le contenu : la console ne le
 * conserve pas, et n'a pas à le montrer.
 *
 * ⚠️ Un accusé n'est PAS une réponse. Il ne touche ni au statut, ni au drapeau
 * « à traiter » : c'est un automate qui accuse réception, pas quelqu'un qui a
 * lu le dossier.
 *
 * ## Le rattachement — exact d'abord, sinon par adresse et heure
 *
 * Depuis ce correctif, l'accusé est enfilé avec l'entité liée
 * (`JobApplication` / id) : le lien est EXACT. Les envois antérieurs n'en ont
 * pas. Pour eux, on retient l'accusé adressé au candidat le plus proche de
 * l'heure de dépôt, dans une fenêtre courte, en écartant ceux qui sont
 * exactement liés à une AUTRE candidature. Le cas qui l'impose est réel : une
 * même personne a candidaté à deux offres à deux minutes d'écart le 18/09 —
 * chaque fiche doit garder SON accusé, pas les deux.
 */

import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { lireAccuses } from "@/server/email/accuse-lecture";
import {
  choisirAccuse as choisirAccuseNoyau,
  decrireAccuse,
  type AccuseReception,
  type AccuseRetenu,
  type LigneEnvoiAccuse,
} from "@/server/email/accuse-noyau";

// La règle de rattachement, la lecture groupée et les faits décrits vivent dans
// le NOYAU commun (`server/email/accuse-noyau.ts`, `accuse-lecture.ts`),
// partagé avec les messages : deux copies divergeraient au premier correctif.
// Ce module ne garde que ce qui est propre aux candidatures — le gabarit,
// l'entité, et la garde de droit.
export { decrireAccuse };
export type { AccuseReception, AccuseRetenu, LigneEnvoiAccuse };
export type { EtatAccuse } from "@/server/email/accuse-noyau";

/** Gabarits d'accusé de réception d'une `JobApplication`. */
export const GABARITS_ACCUSE = ["candidature-recue"] as const;

/** `EmailLog.entityType` posé à l'enfilage de l'accusé. */
export const ENTITE_CANDIDATURE = "JobApplication";

/** Retient l'accusé de CETTE candidature parmi des envois candidats. */
export function choisirAccuse(
  lignes: ReadonlyArray<LigneEnvoiAccuse>,
  candidature: { id: string; submittedAt: Date },
): AccuseRetenu | null {
  return choisirAccuseNoyau(lignes, { type: ENTITE_CANDIDATURE, ...candidature });
}

/**
 * L'accusé de réception d'une candidature, tel qu'il est RÉELLEMENT parti.
 *
 * 🔴 Refuse par défaut, avec le même prédicat que l'ouverture du dossier : la
 * lecture porte sur l'adresse du candidat. `null` = pas le droit de savoir ;
 * `etat: "absent"` = on a cherché, il n'y a rien.
 *
 * `email` est l'adresse DÉCHIFFRÉE (celle de la fiche).
 */
export async function lireAccuseReception(
  candidature: { id: string; email: string; submittedAt: Date },
  acteur: { role: string | null | undefined },
): Promise<AccuseReception | null> {
  if (!peutOuvrirDossierCandidat(acteur.role)) return null;
  const accuses = await lireAccuses({ entityType: ENTITE_CANDIDATURE, gabarits: GABARITS_ACCUSE }, [
    candidature,
  ]);
  return accuses.get(candidature.id) ?? null;
}
