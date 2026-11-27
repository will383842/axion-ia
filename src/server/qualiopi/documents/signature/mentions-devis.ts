/**
 * ⛔ NE PAS MODIFIER un texte de `devis-v1`. Toute retouche = nouvelle version `devis-v2`
 * (nouvelle fonction) ; l'ancienne reste rendable.
 *
 * Mentions de la page publique de signature d'un DEVIS, partie `client`, client professionnel.
 * Logique pure : aucun import Prisma, aucun import de `mentions-document.ts` (l'attestation est
 * recopiée en littéral pour qu'une retouche de `doc-vN` ne change jamais ce que `devis-v1` a affiché).
 *
 * C'est la VERSION (chaîne) qui entre dans le sceau, pas le texte : les lignes déjà scellées gardent
 * `doc-v1`, `doc-v2`, `doc-consent-v1`, `doc-consent-code-v1` et se vérifient comme avant.
 */

export const MENTION_VERSION_DEVIS = "devis-v1" as const;
export const CONSENTEMENT_VERSION_DEVIS = "devis-consent-v1" as const;
export const CONSENTEMENT_VERSION_DEVIS_CODE = "devis-consent-c-v1" as const;

export type VersionConsentementDevis =
  typeof CONSENTEMENT_VERSION_DEVIS | typeof CONSENTEMENT_VERSION_DEVIS_CODE;

export const CONTACT_PAR_DEFAUT = "contact@axion-ia.com";

/** Vrai pour la seule signature du CLIENT sur un DEVIS. */
export function estSignatureClientDevis(type: string, partie: string): boolean {
  return type === "devis" && partie === "client";
}

export function consentementVersionDevis(avecCode: boolean): VersionConsentementDevis {
  return avecCode ? CONSENTEMENT_VERSION_DEVIS_CODE : CONSENTEMENT_VERSION_DEVIS;
}

/**
 * Les 14 éléments (1 attestation + 13 dans le dépli), dans l'ordre : attestation (case cochée, hors du dépli), valeur de la
 * signature, qui recueille et conserve, consentement (2 phrases), information RGPD (9 phrases).
 */
export function mentionCompleteDevisV1(
  p: { numeroDevis: string; prestataire: string; contact: string },
  avecCode: boolean,
): string[] {
  const { numeroDevis, prestataire, contact } = p;
  return [
    `J'ai pris connaissance du devis n° ${numeroDevis} établi par ${prestataire} et je l'accepte, au nom et pour le compte de la structure que je représente.`,
    "Vous signez par une signature électronique simple, au sens du règlement (UE) n° 910/2014 dit « eIDAS » et de l'article 1367 du Code civil : ce n'est ni une signature avancée, ni une signature qualifiée. Le devis ainsi signé est un écrit électronique au sens de l'article 1366 du Code civil. La signature est horodatée et liée au devis par une empreinte numérique, qui permet de déceler toute modification ultérieure. La preuve contraire reste possible par tout moyen.",
    `Cette signature est recueillie et conservée par ${prestataire}, avec son propre outil, et non par un prestataire de services de confiance qualifié. Sa valeur repose sur les enregistrements que ${prestataire} conserve avec la signature.`,
    avecCode
      ? "J'accepte de signer ce devis par voie électronique, en saisissant le code à usage unique reçu à mon adresse électronique."
      : "J'accepte de signer ce devis par voie électronique.",
    "J'ai pu lire le devis et les conditions générales de vente en entier avant de signer. Je recevrai par courriel un exemplaire du devis signé par les deux parties, dans un format que je peux conserver.",
    `Responsable du traitement : ${prestataire}, dont l'adresse figure sur le devis, joignable à ${contact}.`,
    "Données enregistrées : votre nom, votre adresse électronique et votre qualité ; lorsqu'ils vous sont demandés, votre fonction, votre déclaration de pouvoir d'engager la structure et la preuve de la saisie du code à usage unique ; l'image de votre signature lorsqu'elle est tracée ; la date et l'heure de la signature ; une empreinte de votre adresse IP et une empreinte de votre navigateur (votre adresse IP elle-même n'est pas conservée).",
    "Seul le tracé de votre signature est conservé, sous forme d'image : aucune donnée sur la façon de tracer (pression, vitesse, inclinaison) n'est enregistrée.",
    "Finalité : conserver la preuve de la signature du devis et du contrat qu'il forme, et pouvoir la produire en cas de désaccord.",
    `Bases légales : l'intérêt légitime de ${prestataire} et de la structure que vous représentez à pouvoir prouver le contrat (article 6.1.f du RGPD) ; le respect des obligations légales de conservation de ${prestataire} (article 6.1.c du RGPD).`,
    `Destinataires : les personnes habilitées de ${prestataire} et ses prestataires techniques (hébergement, envoi des courriels, horodatage), qui n'agissent que sur ses instructions ; leur liste, et les garanties prévues lorsque l'un d'eux est situé hors de l'Union européenne, figurent sur la page « Sous-processeurs » du site. Le service d'horodatage ne reçoit qu'une empreinte numérique, jamais votre nom ni vos coordonnées.`,
    "Durée de conservation : pendant le contrat, puis 5 ans, durée de la prescription de droit commun (article 2224 du Code civil et article L.110-4 du Code de commerce) ; jusqu'à 10 ans lorsque le devis signé sert de pièce justificative comptable (article L.123-22 du Code de commerce).",
    `Vous pouvez demander l'accès à ces données, leur rectification, leur effacement ou la limitation de leur traitement, et vous opposer à leur traitement pour des raisons tenant à votre situation particulière, en écrivant à ${contact}. L'effacement et l'opposition ne peuvent pas porter sur ce que la loi oblige à conserver ni sur ce qui est nécessaire à la constatation, à l'exercice ou à la défense de droits en justice (articles 17.3, b et e, et 21.1 du RGPD) : votre nom, votre fonction, votre déclaration et le devis signé sont conservés ; l'image de votre signature et les empreintes de votre adresse IP et de votre navigateur peuvent être supprimées sur demande. Vous pouvez adresser une réclamation à la CNIL (www.cnil.fr).`,
    `Ces données sont nécessaires pour signer en ligne. Si vous préférez signer sur papier, écrivez-nous à ${contact} : nous vous adressons le devis, vous nous le retournez signé par courrier et nous conservons l'original papier.`,
  ];
}
