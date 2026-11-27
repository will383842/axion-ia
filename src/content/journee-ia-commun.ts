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

/** Délai de remise du rapport, valeur par défaut de l'art. 47.1 (c) des CGV, décision du 25/11/2026. */
export const DELAI_RAPPORT_JOURS_OUVRES = 10;

/** Délai, après la remise du rapport, pour demander le remboursement par écrit (CGV art. 47.10 f). */
export const DELAI_DEMANDE_REMBOURSEMENT_JOURS = 30;

/** Délai de réponse écrite d'Axion-IA à la demande (CGV art. 47.10 f). */
export const DELAI_REPONSE_REMBOURSEMENT_JOURS = 15;

/** Délai du virement, après l'acceptation de la demande (CGV art. 47.10 f). */
export const DELAI_VIREMENT_REMBOURSEMENT_JOURS = 30;

/** La seule phrase de remboursement : la fin exacte de `GARANTIE`. */
export const GARANTIE_PHRASE =
  "Si les gains identifiés dans votre rapport n’atteignent pas 3 fois le prix HT de la journée, vous êtes remboursé sur demande écrite.";

/** La garantie, mot pour mot (rapport + remboursement sur demande). */
export const GARANTIE = `Sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés après la journée, vous recevez votre rapport complet : vos gains chiffrés, les tâches à automatiser classées par rentabilité, et votre plan d’action sur 90 jours. ${GARANTIE_PHRASE}`;

/** La condition de la garantie, mot pour mot. */
export const CONDITION_GARANTIE =
  "Condition : le décideur et les personnes prévues sont présents pendant l’audit.";

/** Le rapport, remis sous le délai de l'art. 47.1 (c) des CGV. */
export const RAPPORT_COMPLET = `Sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés après la journée, vous recevez votre rapport complet : vos gains chiffrés, les tâches à automatiser classées par rentabilité, et votre plan d’action sur 90 jours.`;

/**
 * Multiple du prix HT de la journée sous lequel la journée est remboursée (garantie, CGV
 * art. 47.10). Décision du dirigeant du 25/11/2026.
 */
export const MULTIPLE_GARANTIE = 3;

/** Seuil de la garantie en euros HT : le multiple × le prix de la journée (`pricing.ts`). */
export function seuilGarantieEur(): number {
  if (JOURNEE_IA_TIER.priceFlat == null) {
    throw new Error(
      "JOURNEE_IA_TIER.priceFlat est absent : le seuil de la garantie est incalculable.",
    );
  }
  return MULTIPLE_GARANTIE * JOURNEE_IA_TIER.priceFlat;
}

/** Montant minimum HT, avant déduction, du devis de projet qui ouvre droit à la déduction du prix de la Journée IA (CGV art. 47.7). */
export const SEUIL_DEVIS_DEDUCTION_EUR = 5000;

/** Plancher du coût horaire retenu pour la garantie : salaire minimum horaire brut majoré de 40 % (CGV art. 47.10 b). */
export const MAJORATION_PLANCHER_COUT_HORAIRE_PCT = 40;

/** Numéro de déclaration d'activité de l'organisme de formation. */
// Même valeur que `NDA_NUMERO` (src/server/qualiopi/legal/legal-mentions.ts) : recopiée ici pour que
// `src/content` n’importe pas le domaine Qualiopi (garde `qualiopi:isolation-check`).
export const NUMERO_DECLARATION_ACTIVITE = "84381100438";

/** La mention d'enregistrement, qui ne parle jamais d'agrément. */
export const MENTION_DECLARATION_OF = `Enregistré sous le numéro ${NUMERO_DECLARATION_ACTIVITE}. Cet enregistrement ne vaut pas agrément de l’État.`;

/** Le bloc « En bref » de l'accueil (le prix est un jeton). */
export const EN_BREF_ACCUEIL = `Axion-IA, partenaire IA des PME et des TPE fondé par Williams Jullin, intervient partout en France. Sa Journée IA se déroule dans les locaux de l’entreprise pour {{PRIX}}. Le matin, l’audit cartographie l’entreprise et repère ses plus gros gains, classés par priorité. L’après-midi, les équipes sont formées sur leurs propres dossiers, avec une attestation par participant. Le rapport, remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés, chiffre ces gains en heures et en euros. Premier pas possible\u202f: un Diagnostic IA de 45 minutes, en visio ou par téléphone.`;

/**
 * La présentation officielle d'Axion-IA (décision du dirigeant, 20/11/2026). SOURCE UNIQUE :
 * nœud JSON-LD `Organization`, graphe de la banque d'images, FAQ de la page À propos, citation
 * en tête de `llms.txt` et `llms-full.txt`. Ne jamais la recopier ailleurs : importer la
 * constante.
 *
 * Ce qu'elle dit, dans l'ordre : savoir où l'IA rapporte avant d'acheter des outils ; ce que
 * fait l'entreprise (audit, formation, solutions sur mesure) ; chaque prestation peut être
 * prise seule ou s'inscrire dans un plan d'ensemble ; le but, écrit comme un but et non comme
 * un résultat ; la Journée IA, offre phare. Aucun montant : le prix reste porté par le seul
 * nœud Service de la Journée IA (`JOURNEE_IA_TIER`).
 */
export const DESCRIPTION_ENTITE_FR =
  "Axion-IA est une entreprise française qui aide les TPE et PME à passer à l’IA en sachant où elle leur rapporte, plutôt que d’acheter des outils au hasard. Partout en France, outre-mer compris, elle audite, forme selon l’entreprise et son secteur, et met en place des solutions sur mesure : implémentation, intégration, automatisation. Chaque prestation peut être prise seule ou s’inscrire dans un plan d’ensemble. Le but : moins de tâches répétitives, plus de temps, de productivité, de rentabilité et de chiffre d’affaires. Offre phare, pour savoir par où commencer : la Journée IA, avec un audit le matin et, l’après-midi, une formation des équipes qui s’inscrit dans l’article 4 du règlement européen sur l’IA, avec une attestation par participant.";

/**
 * Pendant anglais de `DESCRIPTION_ENTITE_FR`, pour le même nœud `#organization`
 * (layout `seo.ts` et graphe de la banque d'images) : traduction fidèle, rien d'ajouté.
 */
export const DESCRIPTION_ENTITE_EN =
  "Axion-IA is a French company that helps small and medium-sized businesses adopt AI knowing where it pays off for them, rather than buying tools at random. Across France, overseas territories included, it audits, trains according to the company and its sector, and puts tailor-made solutions in place: implementation, integration, automation. Each service can be taken on its own or be part of an overall plan. The aim: fewer repetitive tasks, more time, productivity, profitability and revenue. Flagship offer, to know where to start: La Journée IA, with an audit in the morning and, in the afternoon, team training that falls within Article 4 of the European AI regulation, with an attestation for each participant.";

/** Version courte de la présentation, pour le nœud `WebSite` et les usages limités en longueur. */
export const DESCRIPTION_SITE_FR =
  "Axion-IA aide les TPE et PME à passer à l’IA en sachant où elle leur rapporte : audit, formation, implémentation, intégration, automatisation, partout en France. Offre phare : la Journée IA.";

/** Pendant anglais de `DESCRIPTION_SITE_FR`, nœud `WebSite`. */
export const DESCRIPTION_SITE_EN =
  "Axion-IA helps small and medium-sized businesses adopt AI knowing where it pays off for them: audit, training, implementation, integration, automation, across France. Flagship offer: La Journée IA.";

/** Les trois paragraphes du « En bref » de la landing (le prix est un jeton). */
export const EN_BREF_JOURNEE_IA_PARAGRAPHES = [
  "La Journée IA est une journée d’audit et de formation à l’IA, menée par Axion-IA dans les locaux d’une PME ou d’une TPE (2 à 250 salariés), partout en France.",
  "Le matin, l’audit cartographie l’entreprise, fait le point avec le dirigeant sur ses priorités et repère ses plus gros gains, classés par priorité. L’après-midi, les équipes sont formées 4 heures sur leurs propres dossiers, avec une attestation par participant.",
  `Gains chiffrés en heures et en euros dans le rapport, remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés. Prix\u202f: {{PRIX}}, garantie écrite sous condition.`,
] as const;

/**
 * Déduction du prix de la Journée IA sur un devis d'automatisation ou d'intégration
 * (décision du dirigeant, 18/11/2026). Jamais applicable à une formation : ne l'écrire
 * sur aucune page formations. Le prix est le jeton, remplacé par `remplacerJetons()`.
 */
export const DEDUCTION_JOURNEE_IA = `Si vous signez, dans les 60 jours suivant la journée, un devis de mise en place d'une automatisation ou d'une intégration d'au moins ${formatAmount(SEUIL_DEVIS_DEDUCTION_EUR, "fr")} avant déduction, les {{PRIX}} de la Journée IA sont déduits de ce devis, une seule fois. Cette déduction ne se cumule pas avec un remboursement au titre de la garantie.`;

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
export const DESCRIPTION_SERVICE_JOURNEE_IA = `Audit IA et formation des équipes en une seule journée, dans l’entreprise, partout en France\u202f: le matin, 2 à 4\u00a0h d’audit qui cartographie l’entreprise service par service, fait le point avec le dirigeant sur ses priorités et retient les 3 à 5 tâches au meilleur retour sur investissement\u202f; l’après-midi, 4\u00a0h de formation des équipes sur leurs propres dossiers, qui s’inscrit dans l’article 4 du règlement européen sur l’IA, avec une attestation de formation par participant\u202f; rapport détaillé, gains chiffrés en heures et en euros et plan d’action sur 90 jours remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés. {{PRIX}}, prix unique.`;

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
