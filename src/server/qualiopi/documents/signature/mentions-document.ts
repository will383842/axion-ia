/**
 * Signature au grain document — mentions affichées au signataire, et versions.
 *
 * `document_signatures.mention_version` et `consentement_version` sont NOT NULL
 * et entrent toutes deux dans le tuple haché. Ce n'est pas un détail
 * administratif : prouver qu'une personne a signé suppose de pouvoir dire CE
 * QU'ELLE A SIGNÉ. Sans version, on saurait qu'une signature existe, sans savoir
 * quel texte était à l'écran ce jour-là.
 *
 * 🔴 VERSIONS DÉDIÉES. `MENTION_VERSION` (`emargement/mentions.ts`) est PARTAGÉE
 * et consommée par le flux collectif vivant en production : l'incrémenter pour
 * les besoins du contractuel rendrait invérifiable ce qui a été présenté aux
 * stagiaires des sessions déjà signées. On ne la touche pas.
 *
 * ## Deux versions, et pourquoi pas une seule
 *
 * - `MENTION_VERSION_DOCUMENT` — le texte AFFICHÉ (ce que le signataire lit) ;
 * - `CONSENTEMENT_VERSION_DOCUMENT` — ce à quoi il CONSENT (procédé de signature
 *   électronique, conservation, valeur probante).
 *
 * Les deux évoluent séparément : reformuler une phrase d'attestation ne change
 * pas le consentement recueilli, et durcir le consentement ne change pas
 * l'attestation. Les confondre obligerait à bumper les deux à chaque retouche de
 * style, et un bump inutile est un bump qu'on finit par ne plus faire.
 *
 * ⚠️ RÈGLE : toute modification d'un des textes ci-dessous impose d'incrémenter
 * la version correspondante. Réécrire une mention sans changer la version ferait
 * pointer des empreintes déjà scellées vers un texte qui n'existe plus.
 *
 * Logique pure — aucun import Prisma, aucune horloge.
 */

import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";
import type { PartieSignataire } from "./document-signature-hash";

/** Version du texte AFFICHÉ. À incrémenter à chaque modification du contenu. */
export const MENTION_VERSION_DOCUMENT = "doc-v1" as const;

/** Version du CONSENTEMENT recueilli. Évolue indépendamment de la précédente. */
export const CONSENTEMENT_VERSION_DOCUMENT = "doc-consent-v1" as const;

export interface ParametresMentionDocument {
  /** Type lisible de la pièce, ex. « convention de formation ». */
  pieceLibelle: string;
  /** Numéro IMMUABLE de la pièce — c'est lui qui la désigne, pas son identifiant. */
  pieceNumero: string;
  /** Raison sociale de l'organisme, depuis l'identité configurée. */
  organisme: string;
}

/**
 * Bloc 1 — ce que la partie atteste, précisément, selon son titre.
 *
 * ⚠️ Un texte unique aurait été plus simple à écrire et indéfendable. Le client
 * s'ENGAGE contractuellement ; le financeur ne s'engage pas à suivre une
 * formation, il accepte de la PRENDRE EN CHARGE ; le tuteur est un tiers non
 * contractant ; l'organisme, lui, CONCLUT. Leur faire signer la même phrase
 * ferait dire à chacun ce qu'un contrôle lui reprocherait.
 */
export function mentionAttestationDocument(
  partie: PartieSignataire,
  p: ParametresMentionDocument,
): string {
  const piece = `la ${p.pieceLibelle} n° ${p.pieceNumero} établie par ${p.organisme}`;
  switch (partie) {
    case "client":
      return `J'ai pris connaissance de ${piece} et je l'accepte, au nom et pour le compte de la structure que je représente.`;
    case "beneficiaire":
      return `J'ai pris connaissance de ${piece} et je l'accepte.`;
    case "financeur":
      return `En qualité de financeur, j'accepte ${piece} et la prise en charge qu'elle prévoit. Cette acceptation ne vaut pas engagement de suivre l'action de formation.`;
    case "formateur":
      return `En qualité de formateur, j'accepte ${piece} et les missions qu'elle me confie.`;
    case "sous_traitant":
      return `En qualité de prestataire, j'accepte ${piece} et je m'engage à respecter les exigences du référentiel national qualité qu'elle rappelle.`;
    case "tuteur":
      return `En qualité de tuteur en entreprise, j'ai pris connaissance de ${piece} et j'accepte le rôle d'accompagnement qu'elle me confie.`;
    case "responsable_pedagogique":
      return `En qualité de responsable pédagogique, j'atteste l'exactitude de ${piece}.`;
    case "axionia":
      return `Pour ${p.organisme}, j'accepte ${piece} et je la conclus.`;
  }
}

/**
 * Bloc 2 — la valeur juridique, sans surenchère.
 *
 * On revendique la VALIDITÉ (art. 1366 : identification + intégrité) et non la
 * présomption de fiabilité du qualifié eIDAS (art. 1367), qui n'est pas atteinte
 * par le canal maison. Écrire le contraire serait une affirmation fausse sur une
 * pièce contractuelle — et l'objection « une signature simple ne suffit pas » se
 * pare précisément en disant juste ce que l'on fait.
 */
export const MENTION_VALEUR_JURIDIQUE_DOCUMENT =
  "Cette signature électronique vaut signature au sens de l'article 1366 du Code civil : elle identifie son auteur et garantit l'intégrité de ce qui est signé. Elle est horodatée, scellée par une empreinte cryptographique de la pièce signée, et chaînée à la signature précédente apposée sur cette même pièce.";

/**
 * Bloc 2 bis — le plafond probant du canal MAISON, écrit noir sur blanc.
 *
 * La chaîne de hachage prouve qu'un registre interne n'a pas été retouché ; elle
 * ne remet aucun certificat au signataire. Le dire coûte une phrase et évite de
 * laisser croire à une garantie qu'on n'apporte pas — c'est aussi la raison pour
 * laquelle le contractuel avec un tiers passe par le canal fournisseur.
 */
export const MENTION_PLAFOND_CANAL_MAISON =
  "Cette signature est recueillie et conservée par l'organisme de formation. Elle ne s'accompagne pas d'un certificat délivré par un prestataire de services de confiance : sa force probante repose sur le registre scellé de l'organisme, dont une copie vous est remise sur simple demande.";

/**
 * Bloc 3 — le consentement au procédé, distinct de l'attestation.
 *
 * Versionné par `CONSENTEMENT_VERSION_DOCUMENT`.
 */
export const MENTION_CONSENTEMENT_DOCUMENT = [
  `J'accepte de signer cette pièce par voie électronique.`,
  `J'ai pu prendre connaissance de la pièce dans son intégralité avant de signer, et j'en recevrai un exemplaire.`,
] as const;

/** Bloc 4 — information RGPD due au signataire (art. 13), au moment de la collecte. */
export const MENTION_RGPD_DOCUMENT = [
  `Données enregistrées : votre nom, le cas échéant votre adresse électronique et votre qualité, l'image de votre signature lorsqu'elle est tracée, la date et l'heure exactes, ainsi qu'une empreinte non réversible de votre adresse IP et de votre navigateur.`,
  `Seul le tracé de votre signature est conservé, sous forme d'image. Aucune donnée de dynamique de tracé — pression, vitesse, inclinaison — n'est enregistrée ni transmise.`,
  `Finalité : établir et conserver la preuve des engagements contractuels de l'action de formation, obligation légale de l'organisme (articles L.6353-1 et L.6362-5 du Code du travail).`,
  `Conservation : ${DOCUMENT_RETENTION_YEARS} ans, conformément aux conditions particulières applicables aux organismes de formation.`,
  `Vos droits d'accès, de rectification et d'effacement s'exercent auprès de l'organisme. L'effacement ne peut toutefois pas porter sur les éléments nécessaires à la constatation d'un droit en justice (article 17.3.b du RGPD) : votre nom et la pièce signée sont conservés ; l'image de votre signature, votre adresse IP et votre navigateur sont supprimables.`,
] as const;

/**
 * Le texte complet, dans l'ordre d'affichage. Exposé pour l'écran ET pour le PDF.
 *
 * @param canalMaison `true` pour le canal interne : ajoute le plafond probant.
 *        En canal fournisseur, la phrase serait fausse — un certificat est bien
 *        remis au signataire.
 */
export function mentionCompleteDocument(
  partie: PartieSignataire,
  p: ParametresMentionDocument,
  canalMaison: boolean,
): string[] {
  return [
    mentionAttestationDocument(partie, p),
    MENTION_VALEUR_JURIDIQUE_DOCUMENT,
    ...(canalMaison ? [MENTION_PLAFOND_CANAL_MAISON] : []),
    ...MENTION_CONSENTEMENT_DOCUMENT,
    ...MENTION_RGPD_DOCUMENT,
  ];
}
