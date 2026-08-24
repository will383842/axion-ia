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

// ─────────────────────────────────────────────────────────────────────────────
// LA CONTRESIGNATURE DU FORMATEUR — son propre texte, sa propre version
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Version du texte de CONTRESIGNATURE. À incrémenter à chaque modification.
 *
 * 🔴 2026-08-24, cahier D3-3 — pourquoi une version distincte de `MENTION_VERSION`.
 *
 * L'écran de contresignature servait au formateur les mentions du STAGIAIRE :
 * « J'atteste avoir **suivi** … » et, en finalité RGPD, « justifier de **votre
 * assiduité** ». Un formateur n'a pas suivi la formation, il l'a animée ; et il
 * n'a pas d'assiduité de stagiaire à justifier.
 *
 * Ce n'était pas qu'un défaut d'affichage : `mentionVersion` est **scellée dans
 * le tuple haché** de la contresignature. La pièce attestait donc, sous
 * empreinte, que le formateur avait lu un texte qui n'était pas le sien.
 *
 * Deux textes différents ne peuvent pas partager une version — c'est tout le
 * propos de `mention_version` : dire CE QUI A ÉTÉ SIGNÉ. Le dépôt porte déjà ce
 * motif avec `MENTION_VERSION_DOCUMENT` pour les pièces contractuelles.
 *
 * ⚠️ Le préfixe `cs-` évite toute confusion à la lecture d'une ligne en base :
 * un « v2 » dans `emargement_contresignatures.mention_version` et un « v2 » dans
 * `emargement_signatures.mention_version` ne désignent pas le même texte.
 *
 * 🔑 Les contresignatures DÉJÀ scellées conservent leur valeur en colonne et
 * restent vérifiables telles quelles : la reconstruction relit
 * `ligne.mentionVersion`, jamais cette constante.
 */
export const MENTION_VERSION_CONTRESIGNATURE = "cs-v1" as const;

/**
 * Bloc 1 de la contresignature — ce que le FORMATEUR atteste, précisément.
 *
 * Il n'atteste pas sa propre présence : il atteste avoir **animé** la
 * demi-journée devant le groupe. C'est cette affirmation-là qui donne à la
 * feuille sa valeur probante (CAA Nantes, 20/04/2021) — une feuille signée des
 * seuls stagiaires n'établit pas que la séance a été dispensée.
 *
 * ⚠️ Même précaution d'horaires que `mentionAttestation` : `session_jours` ne
 * déclare les horaires qu'au grain de la JOURNÉE. On nomme donc la plage pour ce
 * qu'elle est — « journée déclarée de … » — au lieu d'inventer un horaire de
 * demi-journée que personne n'a saisi.
 */
export function mentionAttestationContresignature(p: ParametresMention): string {
  return `J'atteste avoir animé ${p.demiJourneeLisible} du ${p.jourLisible} (journée déclarée de ${p.horaires}) de la formation « ${p.formationIntitule} », pour le compte de ${p.organisme}.`;
}

/**
 * Bloc RGPD de la contresignature — même collecte, finalité différente.
 *
 * On recueille du formateur exactement ce qu'on recueille d'un stagiaire : nom,
 * tracé rasterisé, horodatage, empreintes non réversibles d'IP et de navigateur.
 * L'information de l'art. 13 lui est donc due dans les mêmes termes — **sauf la
 * finalité**, qui n'est pas de justifier son assiduité mais d'établir la réalité
 * de l'action de formation.
 */
export const MENTION_RGPD_CONTRESIGNATURE = [
  `Données enregistrées : votre nom, votre adresse électronique, l'image de votre signature, la date et l'heure exactes, ainsi qu'une empreinte non réversible de votre adresse IP et de votre navigateur.`,
  `Seul le tracé de votre signature est conservé, sous forme d'image. Aucune donnée de dynamique de tracé — pression, vitesse, inclinaison — n'est enregistrée ni transmise.`,
  `Finalité : établir la réalité de l'action de formation en attestant que la séance a été animée, obligation légale de l'organisme de formation (articles L.6362-5 et R.6313-3 du Code du travail).`,
  `Conservation : ${DOCUMENT_RETENTION_YEARS} ans, conformément aux conditions particulières applicables aux organismes de formation.`,
  `Vos droits d'accès, de rectification et d'effacement s'exercent auprès de l'organisme. L'effacement ne peut toutefois pas porter sur les éléments nécessaires à la constatation d'un droit en justice (article 17.3.b du RGPD) : votre nom et l'attestation d'animation sont conservés, les autres données sont supprimées.`,
] as const;

/**
 * Le texte complet présenté au formateur qui contresigne, dans l'ordre
 * d'affichage. Exposé pour l'écran ET pour le PDF, comme son jumeau stagiaire.
 */
export function mentionCompleteContresignature(p: ParametresMention): string[] {
  return [
    mentionAttestationContresignature(p),
    MENTION_VALEUR_JURIDIQUE,
    ...MENTION_RGPD_CONTRESIGNATURE,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// LES LIBELLÉS DE CASE À COCHER — ils font partie du texte présenté
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 2026-08-24 — pourquoi ces deux libellés vivent ICI et non dans le JSX.
 *
 * Les deux cases à cocher des écrans de signature portaient leur phrase
 * d'attestation **codée en dur dans le composant**. Or c'est la phrase que le
 * signataire coche : elle fait partie de ce qu'il atteste, donc du texte que
 * `mentionVersion` est censée identifier.
 *
 * Écrite dans le JSX, elle échappait à la règle posée en tête de ce module :
 * on pouvait la réécrire sans incrémenter la version, et les empreintes déjà
 * scellées auraient pointé vers un texte qui n'existe plus.
 *
 * ⚠️ Toute modification de ces libellés impose donc d'incrémenter la version
 * correspondante — `MENTION_VERSION` pour le stagiaire,
 * `MENTION_VERSION_CONTRESIGNATURE` pour le formateur.
 */

/** Case cochée par le FORMATEUR avant de contresigner. Il a animé, pas suivi. */
export const CASE_ATTESTATION_CONTRESIGNATURE =
  "J'atteste avoir animé cette demi-journée de formation devant le groupe présent.";

/**
 * Case cochée par un STAGIAIRE qui signe sur SON PROPRE appareil (portail QR).
 *
 * Première personne : c'est lui qui tient l'appareil et qui coche.
 */
export const CASE_ATTESTATION_STAGIAIRE_SOI =
  "J'atteste avoir suivi cette demi-journée de formation.";

/**
 * Case cochée pour un STAGIAIRE qui signe sur le poste du formateur.
 *
 * Le nom est injecté par l'appelant : l'écran s'adresse au formateur qui tend
 * l'appareil, et nomme donc la personne qui signe.
 */
export function caseAttestationStagiaire(nomStagiaire: string): string {
  return `${nomStagiaire} atteste avoir suivi cette demi-journée de formation.`;
}
