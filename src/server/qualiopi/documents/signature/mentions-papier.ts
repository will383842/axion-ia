/**
 * Signature manuscrite sur papier — versions et libellé (lot I3, décision D1 option c).
 *
 * Une signature versée par scan n'a ni mention affichée à l'écran ni consentement
 * électronique : le signataire a signé un papier. Plutôt que de faire passer les
 * versions « électroniques » (`mentions-document.ts`, non modifié) pour ce qui
 * n'a pas eu lieu, le canal papier scelle SES PROPRES versions.
 *
 * 🔴 RÈGLE : toute modification du texte du libellé impose d'incrémenter
 * `MENTION_VERSION_PAPIER`. `CONSENTEMENT_VERSION_PAPIER` dit qu'AUCUN
 * consentement électronique n'a été recueilli — il ne change que si cela change.
 *
 * ⚠️ LIBELLÉ À FAIRE VALIDER par le fondateur avant mise en service.
 * ⚠️ Ne jamais écrire « horodatage qualifié » : l'horodatage RFC 3161 du sceau
 * n'est pas qualifié.
 *
 * Logique pure — aucun import Prisma, aucune horloge.
 */

// Identifiant de version (pas un secret) : gitleaks le prend pour une clé d'API.
export const MENTION_VERSION_PAPIER = "papier-manuscrit-v1" as const; // gitleaks:allow
export const CONSENTEMENT_VERSION_PAPIER = "papier-aucun" as const;

export type VersionMentionPapier = typeof MENTION_VERSION_PAPIER;
export type VersionConsentementPapier = typeof CONSENTEMENT_VERSION_PAPIER;

/** Texte porté quand le client n'a pas daté sa signature sur l'original. */
export const DATE_NON_PORTEE_SUR_L_ORIGINAL = "date non portée sur l'original";

export interface ParametresMentionPapier {
  /** Date portée par le client sur l'original, déjà lisible ; absente si non portée. */
  datePorteeParLeClient?: string | null | undefined;
  /** Instant du versement, formaté « JJ/MM/AAAA à HH:MM » en heure de PARIS par l'appelant. */
  verseLeLisible: string;
  /** Nom de la personne de l'organisme qui a versé le scan. */
  verseParNom: string;
  /** Empreinte SHA-256 du scan (hex) : seuls les 12 premiers caractères sont imprimés. */
  empreinteScanSha256: string;
}

/** Libellé imprimé sur l'exemplaire signé (version `papier-manuscrit-v1`). */
export function mentionPapierV1(p: ParametresMentionPapier): string {
  const date =
    p.datePorteeParLeClient != null && p.datePorteeParLeClient.trim() !== ""
      ? p.datePorteeParLeClient.trim()
      : DATE_NON_PORTEE_SUR_L_ORIGINAL;
  return (
    `Signature manuscrite sur papier, apposée le ${date} ; ` +
    `copie numérisée versée au dossier le ${p.verseLeLisible} par ${p.verseParNom}, ` +
    `empreinte SHA-256 ${p.empreinteScanSha256.slice(0, 12)}. ` +
    `L'original papier est conservé par Axion-IA.`
  );
}
