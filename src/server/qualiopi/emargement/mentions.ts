/**
 * Qualiopi T13 — Mention affichée au signataire, et sa version.
 *
 * `emargement_signatures.mention_version` est NOT NULL et entre dans le tuple
 * haché. Ce n'est pas un détail administratif : prouver qu'une personne a signé
 * suppose de pouvoir dire CE QU'ELLE A SIGNÉ. Sans version, on saurait qu'une
 * signature existe, sans savoir quel texte était à l'écran ce jour-là.
 *
 * ⚠️ RÈGLE : toute modification du texte impose d'incrémenter `MENTION_VERSION`.
 * Réécrire la mention sans changer la version rendrait invérifiable ce qui a été
 * présenté aux signataires précédents — et les empreintes déjà scellées
 * pointeraient vers un texte qui n'existe plus.
 *
 * Logique pure — aucun import Prisma, aucune horloge.
 */

import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";

/**
 * Version du texte ci-dessous. À INCRÉMENTER à chaque modification du contenu.
 *
 * Stockée telle quelle en base (`VarChar(20)`) et hachée dans le tuple.
 */
export const MENTION_VERSION = "v2" as const;

/**
 * Texte affiché au-dessus du pavé de signature.
 *
 * Trois blocs, et aucun n'est décoratif :
 *
 * 1. **Ce qui est attesté** — une signature qui ne dit pas sur quoi elle porte
 *    ne prouve rien. Les paramètres (date, demi-journée, formation) sont
 *    injectés par l'appelant, pas figés ici.
 * 2. **La valeur juridique** — art. 1366 C. civ. : identification + intégrité
 *    suffisent à la VALIDITÉ. On ne revendique PAS la présomption de fiabilité
 *    du qualifié eIDAS (art. 1367), qui n'est pas atteinte ici. Écrire le
 *    contraire serait une affirmation fausse sur une pièce probante.
 * 3. **RGPD** — ce qui est collecté, pourquoi, combien de temps, et la limite du
 *    droit à l'effacement. Le tracé n'est conservé que RASTERISÉ : la dynamique
 *    de tracé (pression, timing, inclinaison) serait de la biométrie
 *    comportementale au sens de la CNIL, donc de l'art. 9. Le dire au signataire
 *    fait partie de l'information due.
 */
export interface ParametresMention {
  /** Intitulé de la formation, tel qu'il sera figé dans l'empreinte. */
  formationIntitule: string;
  /** Jour civil lisible, ex. « mercredi 10 juin 2026 ». */
  jourLisible: string;
  /** « la matinée », « l'après-midi », « la journée ». */
  demiJourneeLisible: string;
  /** Horaires RÉELS de la journée, ex. « 09:00–17:00 ». */
  horaires: string;
  /** Raison sociale de l'organisme, depuis l'identité configurée. */
  organisme: string;
}

/**
 * Bloc 1 — ce que le signataire atteste, précisément.
 *
 * 🔴 v1 → v2 (constat du parcours à blanc 2026-07-27). La v1 écrivait
 * « J'atteste avoir suivi la matinée du 22 juillet 2026 (09:30–13:30) » : les
 * parenthèses se lisaient comme les horaires DE LA MATINÉE, alors que ce sont
 * ceux de la JOURNÉE. Sur une journée à deux demi-journées, l'auditeur recevait
 * deux attestations affirmant chacune la même plage de 4 h — soit 8 h attestées
 * pour 4 h animées.
 *
 * Le correctif est dans la FORMULATION, pas dans la donnée : `session_jours` ne
 * déclare les horaires qu'au grain de la journée, et `fenetreDemiJournee` dit en
 * toutes lettres que son pivot « ne sert qu'à répartir, jamais à afficher un
 * horaire sur la feuille ». Découper « 09:30–13:30 » en un matin « 09:30–13:00 »
 * inventerait une pause que personne n'a saisie — sur une pièce probante.
 *
 * On nomme donc la plage pour ce qu'elle est. Rien d'autre ne change : le tuple
 * haché garde sa forme (`hashVersion` reste 1), et les signatures déjà scellées
 * conservent « v1 » dans leur colonne — elles restent vérifiables telles quelles.
 */
export function mentionAttestation(p: ParametresMention): string {
  return `J'atteste avoir suivi ${p.demiJourneeLisible} du ${p.jourLisible} (journée déclarée de ${p.horaires}) de la formation « ${p.formationIntitule} », dispensée par ${p.organisme}.`;
}

/** Bloc 2 — la valeur juridique, sans surenchère. */
export const MENTION_VALEUR_JURIDIQUE =
  "Cette signature électronique vaut signature au sens de l'article 1366 du Code civil : elle identifie son auteur et garantit l'intégrité de ce qui est signé. Elle est horodatée et scellée par une empreinte cryptographique.";

/** Bloc 3 — information RGPD due au signataire. */
export const MENTION_RGPD = [
  `Données enregistrées : votre nom, votre adresse électronique, l'image de votre signature, la date et l'heure exactes, ainsi qu'une empreinte non réversible de votre adresse IP et de votre navigateur.`,
  `Seul le tracé de votre signature est conservé, sous forme d'image. Aucune donnée de dynamique de tracé — pression, vitesse, inclinaison — n'est enregistrée ni transmise.`,
  `Finalité : justifier de votre assiduité, obligation légale de l'organisme de formation (articles L.6362-5 et R.6313-3 du Code du travail).`,
  `Conservation : ${DOCUMENT_RETENTION_YEARS} ans, conformément aux conditions particulières applicables aux organismes de formation.`,
  `Vos droits d'accès, de rectification et d'effacement s'exercent auprès de l'organisme. L'effacement ne peut toutefois pas porter sur les éléments nécessaires à la constatation d'un droit en justice (article 17.3.b du RGPD) : votre nom et l'attestation de présence sont conservés, les autres données sont supprimées.`,
] as const;

/** Le texte complet, dans l'ordre d'affichage. Exposé pour l'écran ET pour le PDF. */
export function mentionComplete(p: ParametresMention): string[] {
  return [mentionAttestation(p), MENTION_VALEUR_JURIDIQUE, ...MENTION_RGPD];
}
