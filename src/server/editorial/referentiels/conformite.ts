/**
 * Console éditoriale — jeu INITIAL des règles de conformité (§8 du plan).
 *
 * Module PUR : aucun import `next`/prisma.
 *
 * ⚠️ Ce fichier amorce la base, il ne la remplace pas. Le protocole exige que
 * « toute règle métier vive EN BASE, pas dans le code » : l'évaluateur lit
 * `ed_regles_conformite`, jamais ce tableau. Un seuil se corrige depuis la
 * console, sans pull request. Ce registre n'est rejoué que sur une clé absente.
 *
 * ── Deux conventions, parce que le modèle ne peut pas tout porter en regex ──
 *
 * 1. **Les drapeaux ne sont pas stockés.** `motifRegex` est TOUJOURS évalué en
 *    `i` (insensible à la casse), jamais en `u` : le drapeau `u` durcirait des
 *    motifs qui contiennent des classes accentuées et les ferait échouer.
 *    Les bornes de mot sont donc écrites à la main en anti-recherche —
 *    `\b` est inutilisable ici, JavaScript ne considérant pas `é` comme un
 *    caractère de mot.
 *
 * 2. **`parametres.champs` dit OÙ chercher.** Le commentaire du modèle annonce
 *    « corps + premier commentaire + tags », et c'est le défaut. Mais deux
 *    règles seraient FAUSSES ainsi appliquées :
 *      - `lien-corps` ne vaut que sur le corps — un lien en PREMIER COMMENTAIRE
 *        est la pratique recommandée sur LinkedIn, l'interdire serait un bug ;
 *      - `tags-accent` ne vaut que sur les tags.
 *    D'où `champs`, porté par `parametres` et non par une colonne : le lot 0
 *    est le seul moment où l'on peut encore choisir, et une colonne de plus
 *    pour trois règles ne vaut pas une migration.
 */

/** Les seuls champs qu'une règle peut inspecter. */
export type ChampConformite = "corps" | "premierCommentaire" | "tags" | "lienUrl";

export const CHAMPS_PAR_DEFAUT: readonly ChampConformite[] = [
  "corps",
  "premierCommentaire",
  "tags",
];

/**
 * Les 17 tags autorisés (§8). Liste FERMÉE : un tag hors liste est refusé.
 * Sans accent et sans croisillon — deux autres règles le vérifient.
 */
export const TAGS_AUTORISES: readonly string[] = [
  "IAPourPME",
  "DirigeantPME",
  "AutomatisationPME",
  "ProcessusMetier",
  "ProductivitePME",
  "GainDeTemps",
  "ServiceClient",
  "FormationIA",
  "AIAct",
  "ConformiteIA",
  "RGPD",
  "SousLeCapot",
  "MaisonTemoin",
  "Recrutement",
  "CommercialIndependant",
  "Entrepreneuriat",
  "TransformationNumerique",
] as const;

/** Les quatre marqueurs UTM exigés sur tout lien sortant (§8, règle `utm`). */
export const UTM_REQUIS: readonly string[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
] as const;

/**
 * Encadre une alternance de littéraux par des anti-recherches de lettre.
 *
 * `\b` ne convient pas : en JavaScript sans drapeau `u`, `é` n'est PAS un
 * caractère de mot, donc `\bIsère\b` se comporte de façon surprenante aux
 * bords accentués. On borne donc explicitement sur « pas une lettre ».
 */
function motsEntiers(mots: readonly string[]): string {
  const alternance = mots.join("|");
  return `(?<![A-Za-zÀ-ÿ0-9])(?:${alternance})(?![A-Za-zÀ-ÿ0-9])`;
}

/**
 * Toponymes refusés (§8, règle `geo`).
 *
 * ⚠️ Liste volontairement PRUDENTE. Le protocole rappelle qu'« un détecteur qui
 * signale 53 défauts sur 61 se trompe » : un faux positif coûte plus cher qu'un
 * oubli, parce qu'il apprend à l'utilisateur à passer outre la règle. Sont donc
 * écartés les toponymes homographes d'un mot courant — « Ain », « Vienne »
 * (subjonctif de venir), « Nice », « Metz » — qui rougiraient sur du texte sain.
 * La liste s'étend depuis la console, à l'usage.
 */
export const TOPONYMES_REFUSES: readonly string[] = [
  // Villes
  "Grenoble",
  "Lyon",
  "Paris",
  "Marseille",
  "Toulouse",
  "Bordeaux",
  "Lille",
  "Nantes",
  "Strasbourg",
  "Montpellier",
  "Rennes",
  "Chambéry",
  "Annecy",
  "Valence",
  "Villeurbanne",
  "Voiron",
  "Clermont-Ferrand",
  "Saint-Étienne",
  "Saint-Etienne",
  // Départements
  "Isère",
  "Isere",
  "Savoie",
  "Haute-Savoie",
  "Drôme",
  "Drome",
  "Ardèche",
  "Ardeche",
  "Rhône",
  "Rhone",
  // Régions
  "Auvergne-Rhône-Alpes",
  "Auvergne-Rhone-Alpes",
  "Rhône-Alpes",
  "Rhone-Alpes",
  "Île-de-France",
  "Ile-de-France",
] as const;

export interface AmorcageRegleConformite {
  code: string;
  libelle: string;
  /** Le POURQUOI de la règle — lu par un humain qui conteste un refus. */
  motif: string;
  /** Vide pour une règle structurelle, évaluée par code sur `parametres`. */
  motifRegex: string;
  /** `true` = déclenche si TROUVÉ ; `false` = déclenche si ABSENT. */
  interdit: boolean;
  gravite: "info" | "avertissement" | "bloquant";
  /** Message de refus. Il DOIT citer la règle : un refus muet est un échec. */
  message: string;
  parametres: Record<string, unknown> | null;
}

export const ED_REGLES_CONFORMITE: readonly AmorcageRegleConformite[] = [
  {
    code: "geo",
    libelle: "Aucune mention géographique",
    motif:
      "Axion-IA s'adresse aux dirigeants de PME sans se laisser enfermer dans un territoire. " +
      "Une mention de ville ou de région rétrécit l'audience et date le propos.",
    motifRegex: motsEntiers(TOPONYMES_REFUSES),
    interdit: true,
    gravite: "bloquant",
    message:
      "Règle « geo » — mention géographique interdite. Le texte cite {extrait}. " +
      "Retirez le toponyme ou reformulez sans ancrage territorial.",
    parametres: { champs: CHAMPS_PAR_DEFAUT, valeurs: TOPONYMES_REFUSES },
  },
  {
    code: "financier",
    libelle: "Formulations financières interdites",
    motif:
      "Une promesse de prise en charge intégrale engage juridiquement et dépend d'un financeur " +
      "tiers. Elle ne peut pas être affirmée dans une publication.",
    motifRegex:
      "(?:jusqu['’]\\s*à\\s*100\\s*%" +
      "|100\\s*%\\s*(?:financ|pris)" +
      "|financ(?:é|e)e?s?\\s+(?:par|à)\\s+(?:le\\s+|la\\s+)?(?:Qualiopi|100\\s*%)" +
      "|prise?\\s+en\\s+charge\\s+(?:à\\s*)?100\\s*%" +
      "|sans\\s+avance\\s+de\\s+frais" +
      "|gratuit\\s+pour\\s+(?:vous|l['’]entreprise))",
    interdit: true,
    gravite: "bloquant",
    message:
      "Règle « financier » — formulation financière interdite. Le texte cite {extrait}. " +
      "Aucune promesse de financement total ou d'absence d'avance de frais.",
    parametres: { champs: CHAMPS_PAR_DEFAUT },
  },
  {
    code: "ai-act",
    libelle: "Pas d'affirmation de sanction",
    motif:
      "Affirmer qu'un manquement « expose à une sanction » relève du conseil juridique et " +
      "engage la responsabilité d'Axion-IA. L'AI Act s'explique, il ne se brandit pas.",
    motifRegex:
      "(?:expos(?:e|ez|ent|é|er|ant)s?\\s+(?:à|a)\\s+(?:une\\s+|des\\s+|de\\s+lourdes\\s+)?" +
      "(?:sanction|amende|poursuite|pénalité)" +
      "|risqu(?:e|ez|ent)\\s+(?:une\\s+|des\\s+)?(?:sanction|amende|pénalité)" +
      "|sous\\s+peine\\s+(?:de\\s+sanction|d['’]amende)" +
      "|passibles?\\s+d['’]une?\\s+(?:amende|sanction)" +
      "|encour(?:t|ez|ent)\\s+(?:une\\s+|des\\s+)?(?:sanction|amende))",
    interdit: true,
    gravite: "bloquant",
    message:
      "Règle « ai-act » — affirmation de sanction interdite. Le texte cite {extrait}. " +
      "Décrivez l'obligation, pas la peine encourue.",
    parametres: { champs: CHAMPS_PAR_DEFAUT },
  },
  {
    code: "sujets",
    libelle: "Sujets interdits",
    motif:
      "Ces quatre sujets désignent des surfaces non délivrées. Les annoncer, c'est promettre " +
      "ce qui n'existe pas — la faute exacte corrigée en août 2026 sur la certification.",
    motifRegex:
      "(?:volume\\s+de\\s+base" +
      "|chatbot|agent\\s+conversationnel" +
      "|paiement\\s+en\\s+ligne" +
      "|version\\s+anglaise|site\\s+en\\s+anglais)",
    interdit: true,
    gravite: "bloquant",
    message:
      "Règle « sujets » — sujet interdit. Le texte cite {extrait}. " +
      "Volume de base, chatbot, paiement en ligne et version anglaise ne se communiquent pas.",
    parametres: { champs: CHAMPS_PAR_DEFAUT },
  },
  {
    code: "tags-nombre",
    libelle: "3 à 4 tags",
    motif:
      "En dessous de trois, la publication ne se range nulle part ; au-delà de quatre, " +
      "LinkedIn dilue la portée. La fourchette est un réglage, pas un dogme : elle vit en base.",
    motifRegex: "",
    interdit: true,
    gravite: "bloquant",
    message:
      "Règle « tags-nombre » — il faut de {min} à {max} tags, la publication en porte {trouve}.",
    parametres: { min: 3, max: 4 },
  },
  {
    code: "tags-liste",
    libelle: "Tags hors liste fermée",
    motif:
      "Une taxonomie ouverte se disperse en un mois et rend toute analyse par thème " +
      "impossible. Les 17 valeurs sont la taxonomie.",
    motifRegex: "",
    interdit: true,
    gravite: "bloquant",
    message:
      "Règle « tags-liste » — tag hors liste fermée : {extrait}. " +
      "Choisissez parmi les {total} valeurs autorisées.",
    parametres: { valeurs: TAGS_AUTORISES },
  },
  {
    code: "tags-accent",
    libelle: "Aucun accent dans un tag",
    motif:
      "Un croisillon accentué est coupé par LinkedIn au premier caractère non ASCII : " +
      "#ConformitéIA devient #Conformit. Le tag est alors perdu.",
    motifRegex: "[À-ÿ]",
    interdit: true,
    gravite: "bloquant",
    message:
      "Règle « tags-accent » — un tag porte un accent : {extrait}. " +
      "LinkedIn tronque le croisillon au premier caractère accentué.",
    parametres: { champs: ["tags"] },
  },
  {
    code: "lien-corps",
    libelle: "Aucun lien dans le corps",
    motif:
      "Un lien dans le corps fait chuter la portée organique. Il se place en PREMIER " +
      "COMMENTAIRE — c'est pourquoi cette règle n'inspecte que le corps.",
    motifRegex: "https?://",
    interdit: true,
    gravite: "bloquant",
    message:
      "Règle « lien-corps » — lien interdit dans le corps : {extrait}. " +
      "Déplacez-le en premier commentaire, où il est autorisé.",
    parametres: { champs: ["corps"] },
  },
  {
    code: "utm",
    libelle: "Tout lien porte ses 4 UTM",
    motif:
      "Un lien sans marquage rend le rendez-vous qu'il génère inattribuable. La mesure " +
      "du §3 s'effondre alors, sans que rien ne le signale.",
    motifRegex: "",
    interdit: false,
    gravite: "bloquant",
    message:
      "Règle « utm » — marqueur(s) manquant(s) sur le lien : {extrait}. " +
      "Les quatre UTM sont exigés : {total} attendus.",
    parametres: { champs: ["lienUrl"], utm: UTM_REQUIS },
  },
  {
    code: "mentions",
    libelle: "2 mentions au maximum",
    motif:
      "Au-delà de deux mentions, LinkedIn traite la publication comme une sollicitation " +
      "et en réduit la portée.",
    motifRegex: "",
    interdit: true,
    gravite: "avertissement",
    message:
      "Règle « mentions » — {trouve} mentions pour un maximum de {max}. " +
      "Retirez les mentions superflues.",
    parametres: { max: 2, champs: ["corps", "premierCommentaire"] },
  },
  {
    code: "droit-image",
    libelle: "Autorisation signée",
    motif:
      "Diffuser l'image d'un invité sans autorisation SIGNÉE est une faute de droit. " +
      "Une autorisation seulement « envoyée » ne vaut pas consentement.",
    motifRegex: "",
    interdit: true,
    gravite: "bloquant",
    message:
      "Règle « droit-image » — l'autorisation de {extrait} est au statut « {trouve} », " +
      "et non « signee ». La publication ne peut pas être programmée.",
    parametres: { statutRequis: "signee" },
  },
  {
    code: "spec-plateforme",
    libelle: "Durée et ratio dans les limites",
    motif:
      "Un asset hors spec est recadré ou refusé à l'envoi — après le montage, quand " +
      "le corriger coûte le plus cher.",
    motifRegex: "",
    interdit: true,
    gravite: "bloquant",
    message:
      "Règle « spec-plateforme » — {extrait} sort des limites de la plateforme ({trouve}). " +
      "L'asset ne peut pas passer à « pret ».",
    parametres: { source: "ed_specs_plateforme" },
  },
] as const;

/** Garde d'amorçage : le §8 en compte exactement douze. */
export const ED_REGLES_CONFORMITE_ATTENDUES = 12;
