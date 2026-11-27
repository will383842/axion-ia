// Score IA TPE-PME — libellés, ordre d'affichage et valeurs ajoutées (revue experte B4, B5).
// Données pures : aucun écran. Les slugs de colonnes sont inchangés ; seules des valeurs de
// CHAÎNE s'ajoutent (sector, region, barriers = String / Json en base : aucune migration).
// Les listes de l'Observatoire (`@/content/observatoire/questions`) ne sont PAS modifiées.

import { BARRIER_VALUES, REGION_SLUGS, SECTOR_SLUGS } from "@/content/observatoire/questions";

export const SECTEUR_AUTRE = "autre";

export const SECTOR_SLUGS_SCORE: ReadonlyArray<string> = [...SECTOR_SLUGS, SECTEUR_AUTRE];
export const REGION_SLUGS_SCORE: ReadonlyArray<string> = [
  ...REGION_SLUGS,
  "outre-mer",
  "non-precisee",
];
export const BARRIER_VALUES_SCORE = [...BARRIER_VALUES, "none"] as const;

const LIBELLES_VALEURS_AJOUTEES: Readonly<
  Record<"sector" | "region", Readonly<Record<string, { fr: string; en: string }>>>
> = {
  sector: { [SECTEUR_AUTRE]: { fr: "Autre secteur", en: "Other sector" } },
  region: {
    "outre-mer": { fr: "Outre-mer", en: "Overseas territories" },
    "non-precisee": { fr: "Non précisée", en: "Not specified" },
  },
};

/** Libellé d'une valeur ajoutée par le Score (secteur / région), ou undefined si le slug n'en fait pas partie. */
export function libelleValeurScore(
  source: "sector" | "region",
  slug: string,
  lang: "fr" | "en",
): string | undefined {
  return LIBELLES_VALEURS_AJOUTEES[source][slug]?.[lang];
}

export interface LibelleQuestion {
  readonly label: string;
  readonly options?: Readonly<Record<string, string>>;
}

/** Libellés B5 (revue experte), repris tels quels. Secteurs et régions : libellés existants + ajouts. */
export const LIBELLES_SCORE: Readonly<Record<string, LibelleQuestion>> = {
  companySize: {
    label: "Combien de salariés compte votre entreprise ?",
    options: {
      TPE: "Moins de 10 (y compris sans salarié)",
      PME: "De 10 à 249",
      ETI: "De 250 à 4 999",
      GRANDE_ENTREPRISE: "5 000 ou plus",
    },
  },
  maturityLevel: {
    label: "Aujourd'hui, où en est l'IA dans votre entreprise ?",
    options: {
      none: "Nous ne l'utilisons pas",
      exploration: "Nous nous renseignons, ou quelques personnes l'essaient de leur côté",
      poc: "Nous la testons sur un cas précis, sans usage régulier",
      production: "Elle sert régulièrement pour 1 ou 2 tâches",
      scaled: "Elle sert régulièrement pour plusieurs tâches ou dans plusieurs services",
    },
  },
  useCases: {
    label:
      "Pour quoi l'entreprise utilise-t-elle l'IA aujourd'hui ? (plusieurs réponses possibles)",
    options: {
      automation: "Automatiser des tâches répétitives (saisie, tri, relances)",
      chatbot: "Répondre aux clients (assistant en ligne, messagerie)",
      content: "Rédiger ou créer des contenus (e-mails, textes, visuels)",
      data_analysis: "Analyser des chiffres, faire des tableaux de bord",
      internal_rag: "Retrouver l'information dans vos documents",
      sales: "Prospecter ou préparer des ventes",
      dev: "Écrire ou corriger du code informatique",
      none: "Aucun usage pour l'instant",
    },
  },
  tools: {
    label: "Quels outils d'IA utilisez-vous dans l'entreprise ? (plusieurs réponses possibles)",
    options: {
      chatgpt: "ChatGPT",
      copilot: "Microsoft Copilot",
      claude: "Claude",
      gemini: "Gemini (Google)",
      mistral: "Le Chat (Mistral AI)",
      internal: "Un outil sur mesure ou interne",
      none: "Aucun",
    },
  },
  timeSavedPerDay: {
    label:
      "À vous personnellement, combien de temps l'IA fait-elle gagner sur une journée de travail habituelle ?",
    options: {
      none: "Aucun, ou je ne l'utilise pas",
      lt_30min: "Moins de 30 minutes",
      m30_1h: "De 30 minutes à moins d'1 heure",
      h1_2: "D'1 heure à moins de 2 heures",
      h2_3: "De 2 à 3 heures",
      gt_3h: "Plus de 3 heures",
    },
  },
  teamTrained: {
    label: "Vous ou votre équipe avez-vous été formés à l'IA ?",
    options: {
      none: "Non, pas encore",
      informal: "Un peu : chacun apprend de son côté",
      formal: "Oui, par une formation organisée (interne ou externe)",
    },
  },
  hasStrategy: {
    label: "Avez-vous mis par écrit ce que l'entreprise veut faire (et ne pas faire) avec l'IA ?",
    options: {
      none: "Non",
      in_progress: "Nous y réfléchissons, rien n'est encore écrit",
      formalized: "Oui, c'est écrit (priorités, règles d'usage)",
    },
  },
  annualBudget: {
    label:
      "Sur une année, combien l'entreprise consacre-t-elle à l'IA (abonnements, logiciels, prestations, formations) ?",
    options: {
      zero: "Rien (outils gratuits ou aucun outil)",
      lt_1k: "Moins de 1 000 €",
      k1_5: "De 1 000 à moins de 5 000 €",
      k5_20: "De 5 000 à moins de 20 000 €",
      k20_100: "De 20 000 à 100 000 €",
      gt_100k: "Plus de 100 000 €",
      dont_know: "Je ne sais pas",
    },
  },
  barriers: {
    label: "Qu'est-ce qui freine le plus l'IA dans votre entreprise ? (3 réponses au plus)",
    options: {
      skills: "Nous ne savons pas bien nous en servir",
      budget: "Le coût",
      roi: "Nous ne voyons pas encore ce qu'elle apporterait",
      security_rgpd: "La confidentialité des données (RGPD)",
      data_quality: "Nos données sont dispersées ou peu fiables",
      internal_resistance: "Des réticences dans l'équipe",
      time: "Le manque de temps",
      not_priority: "Ce n'est pas une priorité",
      none: "Aucun frein particulier",
    },
  },
  rgpdConcern: {
    label:
      "La protection de vos données (RGPD, lieu de stockage) vous inquiète-t-elle quand vous utilisez l'IA ?",
    options: { not_at_all: "Pas du tout", little: "Peu", somewhat: "Plutôt", very: "Beaucoup" },
  },
  competitorsUseAi: {
    label: "À votre avis, vos concurrents utilisent-ils déjà l'IA ?",
    options: {
      no: "Non, je ne pense pas",
      probably: "Probablement",
      yes_clearly: "Oui, clairement",
      dont_know: "Je ne sais pas",
    },
  },
  investmentIntent: {
    label: "Dans les 12 prochains mois, vos dépenses liées à l'IA vont plutôt…",
    options: {
      decrease: "Baisser",
      stable: "Rester stables",
      increase: "Augmenter",
      strong_increase: "Beaucoup augmenter",
      none_budget: "Nous n'avons pas de dépense IA et n'en prévoyons pas",
    },
  },
  sector: {
    label: "Quel est le secteur principal de votre entreprise ?",
    // Les libellés des 30 secteurs viennent de `KB_SECTOR_TAGS` ; seul l'ajout est propre au Score.
    options: { autre: "Autre secteur" },
  },
  region: {
    label: "Dans quelle région se trouve le siège de votre entreprise ?",
    options: { "outre-mer": "Outre-mer", "non-precisee": "Je préfère ne pas le dire" },
  },
  respondentRole: {
    label: "Quelle est votre fonction dans l'entreprise ?",
    options: {
      ceo_founder: "Je dirige l'entreprise (gérance, présidence, fondation)",
      gm_coo: "Direction générale ou des opérations",
      cio_it: "Informatique ou numérique",
      business_director: "Direction d'un métier (commercial, comptabilité, RH, production)",
      ops_manager: "Encadrement d'une équipe ou d'un service",
      other: "Autre fonction",
    },
  },
};

/** Ordre d'affichage : échelles du plus faible au plus fort ; « Je ne sais pas », « Aucun », « Autre » en dernier. */
export const ORDRE_AFFICHAGE: Readonly<Record<string, readonly string[]>> = {
  maturityLevel: ["none", "exploration", "poc", "production", "scaled"],
  hasStrategy: ["none", "in_progress", "formalized"],
  teamTrained: ["none", "informal", "formal"],
  timeSavedPerDay: ["none", "lt_30min", "m30_1h", "h1_2", "h2_3", "gt_3h"],
  annualBudget: ["zero", "lt_1k", "k1_5", "k5_20", "k20_100", "gt_100k", "dont_know"],
  competitorsUseAi: ["no", "probably", "yes_clearly", "dont_know"],
  rgpdConcern: ["not_at_all", "little", "somewhat", "very"],
  investmentIntent: ["none_budget", "decrease", "stable", "increase", "strong_increase"],
  useCases: [
    "automation",
    "chatbot",
    "content",
    "data_analysis",
    "internal_rag",
    "sales",
    "dev",
    "none",
  ],
  tools: ["chatgpt", "copilot", "claude", "gemini", "mistral", "internal", "none"],
  barriers: [...BARRIER_VALUES_SCORE],
  sector: [...SECTOR_SLUGS_SCORE],
  region: [...REGION_SLUGS_SCORE],
  respondentRole: ["ceo_founder", "gm_coo", "cio_it", "business_director", "ops_manager", "other"],
  companySize: ["TPE", "PME", "ETI", "GRANDE_ENTREPRISE"],
};

/** Bornes [min, max exclu[ en euros par an ; `null` = sans plafond. Contiguës : aucun chevauchement. */
export const BORNES_BUDGET: Readonly<Record<string, readonly [number, number | null]>> = {
  zero: [0, 1],
  lt_1k: [1, 1000],
  k1_5: [1000, 5000],
  k5_20: [5000, 20000],
  k20_100: [20000, 100000],
  gt_100k: [100000, null],
};

/** Bornes [min, max exclu[ en minutes par jour. Contiguës : aucun chevauchement. */
export const BORNES_TEMPS: Readonly<Record<string, readonly [number, number | null]>> = {
  none: [0, 1],
  lt_30min: [1, 30],
  m30_1h: [30, 60],
  h1_2: [60, 120],
  h2_3: [120, 180],
  gt_3h: [180, null],
};
