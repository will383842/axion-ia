// Socle commun de La Journée IA : les textes et les calculs que partagent la
// landing `/fr/journee-ia`, l'accueil `/fr`, le nœud JSON-LD « Service » et les
// fichiers `llms*.txt`. Un seul endroit, donc une seule version de chaque phrase.
//
// 🔑 Aucun montant n'est écrit ici (ce fichier est balayé par
// `no-hardcoded-prices.spec.ts`). Le prix est un jeton, `JETON_PRIX`, que
// `remplacerJetons()` remplace par la valeur lue dans `pricing.ts`
// (`JOURNEE_IA_TIER`). Le gain de l'exemple est calculé, jamais recopié.
//
// Les apostrophes « ’ » et les espaces insécables (U+202F, U+00A0) sont ceux des
// maquettes validées : ne pas les « normaliser ».

import { JOURNEE_IA_TIER, formatAmount, formatTierPrice } from "@/content/pricing";

/** Le jeton que les textes portent à la place du prix de la journée. */
export const JETON_PRIX = "{{PRIX}}";

/** La seule phrase de remboursement : la fin exacte de `GARANTIE`. */
export const GARANTIE_PHRASE =
  "Si les gains identifiés ne dépassent pas 3 fois le prix de la journée, nous vous remboursons, sans discussion, sous 30 jours.";

/** La condition de la garantie, mot pour mot. */
export const CONDITION_GARANTIE =
  "Condition : votre équipe est disponible pendant la journée et nous fournit les chiffres demandés.";

/** Le rapport, remis sous 3 jours ouvrés (décision de Williams). */
export const RAPPORT_COMPLET =
  "Sous 3 jours ouvrés après la journée, vous recevez votre rapport complet : vos gains chiffrés, les tâches à automatiser classées par rentabilité, et votre plan d’action sur 90 jours.";

/**
 * La garantie : le rapport (`RAPPORT_COMPLET`, sous 3 jours ouvrés, comme `offre.ts`)
 * puis la phrase de remboursement. Composée, donc jamais en désaccord avec l'offre.
 */
export const GARANTIE = `${RAPPORT_COMPLET} ${GARANTIE_PHRASE}`;

/** Numéro de déclaration d'activité de l'organisme de formation. */
// Même valeur que `NDA_NUMERO` (src/server/qualiopi/legal/legal-mentions.ts) : recopiée ici pour que
// `src/content` n’importe pas le domaine Qualiopi (garde `qualiopi:isolation-check`).
export const NUMERO_DECLARATION_ACTIVITE = "84381100438";

/** La mention d'enregistrement, qui ne parle jamais d'agrément. */
export const MENTION_DECLARATION_OF = `Enregistré sous le numéro ${NUMERO_DECLARATION_ACTIVITE}. Cet enregistrement ne vaut pas agrément de l’État.`;

/** Le bloc « En bref » de l'accueil (le prix est un jeton). */
export const EN_BREF_ACCUEIL =
  "Axion-IA, partenaire IA des PME et des TPE fondé par Williams Jullin, intervient partout en France. Sa Journée IA se déroule dans les locaux de l’entreprise pour {{PRIX}}. Le matin, l’audit cartographie l’entreprise et chiffre ses plus gros gains, en heures et en euros. L’après-midi, les équipes sont formées sur leurs propres dossiers, avec une attestation par participant. Le rapport suit sous 3 jours ouvrés. Premier pas possible\u202f: un diagnostic IA gratuit de 45 minutes, en visio ou par téléphone.";

/**
 * Description de l'entité Axion-IA (nœuds JSON-LD `Organization` et `WebSite`).
 * Reprend mot pour mot les formulations déjà publiées (« partenaire IA des PME et
 * des TPE », « partout en France », « dans les locaux de l’entreprise », « le
 * matin, l’audit… l’après-midi, les équipes sont formées… ») : aucune nouvelle
 * promesse. Aucun montant : le prix reste porté par le seul nœud Service de la
 * Journée IA (`JOURNEE_IA_TIER`).
 */
export const DESCRIPTION_ENTITE_FR =
  "Axion-IA, partenaire IA des PME et des TPE, intervient partout en France. Offre phare\u202f: La Journée IA, dans les locaux de l’entreprise. Le matin, l’audit chiffre ses plus gros gains, en heures et en euros. L’après-midi, les équipes sont formées sur leurs propres dossiers.";

/**
 * Pendant anglais de `DESCRIPTION_ENTITE_FR`, pour le même nœud `#organization`
 * (layout `seo.ts` et graphe de la banque d'images). Avant (audit du
 * 2026-11-11) : deux textes anglais différents pour la même entité.
 */
export const DESCRIPTION_ENTITE_EN =
  "Axion-IA, the AI partner for SMEs and small businesses, works across France. Flagship offer: La Journée IA, at your premises: the audit in the morning, team training in the afternoon.";

/** Version courte pour le nœud `WebSite`. */
export const DESCRIPTION_SITE_FR =
  "Axion-IA, partenaire IA des PME et des TPE, partout en France. Offre phare\u202f: La Journée IA, l’audit le matin, la formation l’après-midi, dans vos locaux.";

/** Pendant anglais de `DESCRIPTION_SITE_FR`, nœud `WebSite`. */
export const DESCRIPTION_SITE_EN =
  "Axion-IA, the AI partner for SMEs and small businesses across France. Flagship offer: La Journée IA, audit in the morning, training in the afternoon, at your premises.";

/** Les trois paragraphes du « En bref » de la landing (le prix est un jeton). */
export const EN_BREF_JOURNEE_IA_PARAGRAPHES = [
  "La Journée IA est une journée d’audit et de formation à l’IA, menée par Axion-IA dans les locaux d’une PME ou d’une TPE (5 à 249 salariés), partout en France.",
  "Le matin, l’audit cartographie l’entreprise, fait le point avec le dirigeant sur ses priorités et chiffre ses plus gros gains, en heures et en euros. L’après-midi, les équipes sont formées 4 heures sur leurs propres dossiers, avec une attestation par participant.",
  "Rapport chiffré sous 3 jours ouvrés. Prix\u202f: {{PRIX}}, garantie écrite sous condition.",
] as const;

/** Le chemin de la landing (préfixé par la locale au rendu : `/fr/journee-ia`). */
export const CHEMIN_JOURNEE_IA = "/journee-ia";

/** Le déroulé de la journée : le deuxième paragraphe du « En bref » de la landing. */
export const DEROULE_JOURNEE_IA = EN_BREF_JOURNEE_IA_PARAGRAPHES[1];

/**
 * Le lien vers le diagnostic, avec l'emplacement cliqué (`depuis`), recopié par
 * `/appel` dans `utm_content`.
 */
export function lienDiagnostic(depuis: string): string {
  return `/appel?rdv=diagnostic&depuis=${encodeURIComponent(depuis)}`;
}

/** Le « En bref » de la landing, d'un seul tenant (pour `llms*.txt`). */
export const EN_BREF_JOURNEE_IA = EN_BREF_JOURNEE_IA_PARAGRAPHES.join(" ");

/** La description du nœud JSON-LD « Service » de la Journée IA (le prix est un jeton). */
export const DESCRIPTION_SERVICE_JOURNEE_IA =
  "Une journée dans l’entreprise, partout en France\u202f: le matin, 2 à 4\u00a0h d’audit qui cartographie l’entreprise service par service, fait le point avec le dirigeant sur ses priorités et retient les 3 à 5 tâches au meilleur retour sur investissement, chacune chiffrée en heures et en euros\u202f; l’après-midi, 4\u00a0h de formation des équipes sur leurs propres dossiers, qui s’inscrit dans l’article 4 du règlement européen sur l’IA, avec une attestation de formation par participant\u202f; priorités écrites le soir même, rapport chiffré et plan d’action sur 90 jours remis sous 3 jours ouvrés. {{PRIX}}, prix unique.";

/**
 * L'exemple chiffré montré sur la landing et l'accueil. Le gain est calculé :
 * 6 heures par semaine × 45 semaines × 35 euros de l'heure.
 */
export const EXEMPLE_TYPE = {
  heuresParSemaine: 6,
  semainesTravaillees: 45,
  tauxHoraireEur: 35,
} as const;

/** Le temps payé que représente l'exemple, sur une année. */
export function gainExempleEur(): number {
  return (
    EXEMPLE_TYPE.heuresParSemaine * EXEMPLE_TYPE.semainesTravaillees * EXEMPLE_TYPE.tauxHoraireEur
  );
}

/**
 * Date de dernière mise à jour éditoriale des pages La Journée IA et accueil :
 * date visible, `WebPage.dateModified` et `FAQPage.dateModified`. Réglée le jour
 * de la fusion ; elle ne bouge que quand le contenu change.
 */
export const DATE_MISE_A_JOUR_JOURNEE_IA = "2026-11-09";

/**
 * Remplace les jetons d'un texte par leur valeur, lue dans `pricing.ts` ou
 * calculée. Lève une erreur si un jeton inconnu subsiste : un `{{…}}` ne doit
 * jamais atteindre une page, un JSON-LD ou un fichier `llms*.txt`.
 */
export function remplacerJetons(texte: string): string {
  const resolu = texte
    .replaceAll(JETON_PRIX, formatTierPrice(JOURNEE_IA_TIER, "fr"))
    .replaceAll("{{GAIN_EXEMPLE}}", formatAmount(gainExempleEur(), "fr", { compact: true }))
    .replaceAll(
      "{{TAUX_HORAIRE}}",
      formatAmount(EXEMPLE_TYPE.tauxHoraireEur, "fr", { compact: true }),
    )
    .replaceAll("{{HEURES_EXEMPLE}}", `${EXEMPLE_TYPE.heuresParSemaine} h`);
  const inconnu = resolu.match(/\{\{[^}]*\}\}/);
  if (inconnu) {
    throw new Error(`Jeton inconnu dans le texte : ${inconnu[0]}`);
  }
  return resolu;
}
