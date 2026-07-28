/**
 * AFEST 1-to-1 — Mentions affichées aux signataires, et leur version.
 *
 * `coaching_seance_signatures.mention_version` est NOT NULL et entre dans le
 * tuple haché. Ce n'est pas un détail administratif : prouver qu'une personne a
 * signé suppose de pouvoir dire CE QU'ELLE A SIGNÉ. Sans version, on saurait
 * qu'une signature existe, sans savoir quel texte était à l'écran ce jour-là.
 *
 * 🔴 VERSION DÉDIÉE, et c'est le point. `MENTION_VERSION` (`emargement/mentions.ts`)
 * est PARTAGÉE et consommée par le flux collectif : l'incrémenter pour les
 * besoins de l'AFEST rendrait invérifiable ce qui a été présenté aux stagiaires
 * des sessions collectives déjà signées. On ne la touche pas.
 *
 * ⚠️ RÈGLE : toute modification d'un des textes ci-dessous impose d'incrémenter
 * `MENTION_VERSION_AFEST`. Réécrire une mention sans changer la version ferait
 * pointer des empreintes déjà scellées vers un texte qui n'existe plus.
 *
 * ## Trois rôles, trois textes — et ce n'est pas de la cosmétique
 *
 * Le bénéficiaire et le formateur attestent une PRÉSENCE. Le tuteur entreprise
 * atteste la RÉALITÉ d'une mise en situation de travail : il est un tiers, il
 * n'est pas partie au contrat de formation, et lui faire signer « j'atteste
 * avoir suivi » serait faux. Un texte unique aurait été plus simple à écrire et
 * indéfendable devant un contrôle.
 *
 * Logique pure — aucun import Prisma, aucune horloge.
 */

import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";
import type { RoleSignataireAfest } from "./seance-signature-hash";

/**
 * Version des textes ci-dessous. À INCRÉMENTER à chaque modification du contenu.
 * Stockée telle quelle en base (`VarChar(20)`) et hachée dans le tuple.
 */
export const MENTION_VERSION_AFEST = "afest-v1" as const;

export interface ParametresMentionAfest {
  /** Intitulé du parcours, tel qu'il sera figé dans l'empreinte. */
  formationIntitule: string;
  /** Jour civil lisible, ex. « mercredi 10 juin 2026 ». */
  jourLisible: string;
  /** Horaires RÉELS de la séance, ex. « 09:00–11:30 ». */
  horaires: string;
  /** Raison sociale de l'organisme, depuis l'identité configurée. */
  organisme: string;
  /** Nom du bénéficiaire — cité dans la mention du tuteur, qui atteste SUR lui. */
  beneficiaireNom: string;
}

/**
 * Bloc 1 — ce que le signataire atteste, précisément, selon son rôle.
 *
 * ⚠️ La formulation tuteur ne dit PAS « j'atteste la présence » : un tuteur qui
 * n'était pas en salle ne peut pas l'attester, et le lui faire signer
 * fabriquerait une preuve que le contrôle rejetterait. Il atteste ce qu'il a
 * réellement constaté — la mise en situation dans son entreprise.
 */
export function mentionAttestationAfest(
  role: RoleSignataireAfest,
  p: ParametresMentionAfest,
): string {
  const seance = `la séance du ${p.jourLisible} (${p.horaires}) du parcours « ${p.formationIntitule} », dispensé par ${p.organisme}`;
  switch (role) {
    case "beneficiaire":
      return `J'atteste avoir suivi ${seance}.`;
    case "formateur":
      return `J'atteste avoir animé ${seance}, et la réalité des mises en situation de travail correspondantes.`;
    case "tuteur":
      return `En qualité de tuteur en entreprise, j'atteste que ${p.beneficiaireNom} a réalisé les mises en situation de travail de ${seance}, au sein de l'entreprise et sous mon suivi.`;
  }
}

/**
 * Bloc 2 — la valeur juridique, sans surenchère.
 *
 * On revendique la VALIDITÉ (art. 1366 : identification + intégrité) et non la
 * présomption de fiabilité du qualifié eIDAS (art. 1367), qui n'est pas
 * atteinte ici. Écrire le contraire serait une affirmation fausse sur une pièce
 * probante — et l'objection « une signature simple ne suffit pas » se pare
 * précisément en disant juste ce que l'on fait.
 */
export const MENTION_VALEUR_JURIDIQUE_AFEST =
  "Cette signature électronique vaut signature au sens de l'article 1366 du Code civil : elle identifie son auteur et garantit l'intégrité de ce qui est signé. Elle est horodatée et scellée par une empreinte cryptographique chaînée à la signature précédente.";

/**
 * Bloc 2 bis — le plafond probant de la méthode A, écrit noir sur blanc.
 *
 * Quand les trois rôles signent sur le poste du formateur, la chaîne prouve
 * l'INTÉGRITÉ, pas l'INDÉPENDANCE. Le dire au signataire coûte une phrase et
 * évite de laisser croire à une garantie qu'on n'apporte pas.
 */
export const MENTION_RECUEIL_ATTESTE_PAR_OF =
  "Cette signature est recueillie sur l'appareil de l'organisme de formation, qui atteste l'identité du signataire — comme sur une feuille d'émargement papier.";

/** Bloc 3 — information RGPD due au signataire (art. 13), au moment de la collecte. */
export const MENTION_RGPD_AFEST = [
  `Données enregistrées : votre nom, le cas échéant votre adresse électronique, l'image de votre signature, la date et l'heure exactes, ainsi qu'une empreinte non réversible de votre adresse IP et de votre navigateur.`,
  `Seul le tracé de votre signature est conservé, sous forme d'image. Aucune donnée de dynamique de tracé — pression, vitesse, inclinaison — n'est enregistrée ni transmise.`,
  `Finalité : justifier de la réalisation de l'action de formation en situation de travail, obligation légale de l'organisme (articles L.6362-5, R.6313-3 et D.6313-3-1 du Code du travail).`,
  `Conservation : ${DOCUMENT_RETENTION_YEARS} ans, conformément aux conditions particulières applicables aux organismes de formation.`,
  `Vos droits d'accès, de rectification et d'effacement s'exercent auprès de l'organisme. L'effacement ne peut toutefois pas porter sur les éléments nécessaires à la constatation d'un droit en justice (article 17.3.b du RGPD) : votre nom et l'attestation sont conservés ; l'image de votre signature, votre adresse IP et votre navigateur sont supprimables.`,
] as const;

/**
 * Le texte complet, dans l'ordre d'affichage. Exposé pour l'écran ET pour le PDF.
 *
 * @param recueilliParOf `true` en méthode A (poste du formateur) : ajoute le
 *        plafond probant. En méthode B (lien propre), la phrase serait fausse.
 */
export function mentionCompleteAfest(
  role: RoleSignataireAfest,
  p: ParametresMentionAfest,
  recueilliParOf: boolean,
): string[] {
  return [
    mentionAttestationAfest(role, p),
    MENTION_VALEUR_JURIDIQUE_AFEST,
    ...(recueilliParOf ? [MENTION_RECUEIL_ATTESTE_PAR_OF] : []),
    ...MENTION_RGPD_AFEST,
  ];
}
