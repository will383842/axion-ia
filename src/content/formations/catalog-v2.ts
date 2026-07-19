// ============================================================================
// CATALOGUE FORMATIONS — SSOT des 21 formations intra-entreprise + 1 séminaire.
//
// Refonte 2026-07-19 (décision Will) : le catalogue est réorganisé en
// 3 CATÉGORIES — offres générales (4), offres par métier (9), offres par
// secteur d'activité (8) — qui REMPLACENT l'axe durée et l'axe gamme comme axes
// de navigation. La durée reste un badge par carte. Le séminaire est conservé
// À PART (rubrique dédiée, hors catégories). Prix PUBLICS fixes par groupe
// (2 à 15 participants), dérivés de `FORMATION_PRICE_MATRIX` (pricing.ts) via
// (catégorie × durée) — jamais de prix en dur ici.
//
// Contenu 100 % FRANÇAIS (EN désactivé 301→FR ; `slugEn` = mapping de route
// uniquement, pas de contenu EN). Sources du contenu :
// `Downloads/Fiches_Formations_Axion-IA.md` (fiches commerciales) +
// `Downloads/Programmes_Qualiopi_Axion-IA.md` (programmes réglementaires).
//
// Le SEO de chaque page (h1/metaTitle/metaDescription/termes/faqs) vit ICI →
// la page dérive. Le déroulé minute-par-minute complet (kit pédagogique
// Qualiopi) relève de la DB (Formation Engine) ; ici = programme public.
//
// ⚠️ Aucun claim Qualiopi/OPCO dans ce fichier : les mentions de financement
// passent par les composants auto-gatés `OF_PUBLIC_DISCLOSURE_ENABLED`.
// ============================================================================

import type { FormationCategorie, FormationDuree, FormationGamme } from "../pricing";
import { getFormationBrackets, getFormationEntryPrice, getFormationPrice } from "../pricing";
import type { FormationBracket } from "../pricing";
import type { ModalitePedagogique } from "./modalites";

export interface FormationV2Faq {
  question: string;
  reponse: string;
}

export interface FormationCasUsage {
  texteFr: string;
  /** Petite image d'illustration (Unsplash → crédit obligatoire). */
  imageSrc?: string;
  imageCredit?: { name: string; url: string };
}

export interface FormationProgrammeStep {
  /** Repère de temps (« 35' », « Pause », « Matin »). Optionnel. */
  temps?: string;
  titre: string;
}

export interface FormationProgrammeSection {
  /** Ex. « Module 1 — … », « Jour 1 — … ». */
  titreFr: string;
  steps: ReadonlyArray<FormationProgrammeStep>;
}

export interface FormationV2 {
  /** Identifiant stable = slug FR (clé d'URL + lookup). */
  id: string;
  slugFr: string;
  /** Slug EN — mapping de route uniquement (pas de contenu EN). */
  slugEn: string;
  /** Numéro d'ordre source (catalogue 1-21 ; séminaire : 22). */
  numero: number;
  /**
   * Gamme historique — conservée pour les défauts visuels/outils
   * (catalog-v2-facts.ts) et la colonne `OffreSite.gamme` des offres archivées.
   * Toutes les formations de la refonte 2026-07 sont `ia-standard`.
   */
  gamme: FormationGamme;
  /**
   * Catégorie du catalogue (axe de navigation principal, refonte 2026-07-19).
   * `undefined` pour le séminaire (rubrique à part, hors catégories).
   */
  categorie?: FormationCategorie;
  /** Libellé de l'axe (« RH », « Santé »…) — badges et regroupements listing. */
  axeLabelFr?: string;
  duree: FormationDuree;
  /** Formation sans prix affiché (« Sur devis ») — court-circuite la matrice. */
  surDevis?: boolean;
  /** Séminaire (rubrique dédiée, présentiel, jusqu'à 50 pers). */
  seminaire?: boolean;
  /** « À LA UNE ». */
  featured?: boolean;
  /** Formation 2 jours scindable en 2 × 1 jour (affichage badge + FAQ). */
  scindable?: boolean;
  /** Pré-requis explicite (sinon aucun). */
  prerequisFr?: string;
  // ---- Identité / accroche ----
  titreFr: string;
  /** Sous-titre bénéfice (le « > » des fiches commerciales). */
  accrocheFr: string;
  // ---- SEO (FR) ----
  h1Fr: string;
  metaTitleFr: string;
  metaDescriptionFr: string;
  termesSemantiquesFr: ReadonlyArray<string>;
  // ---- Contenu ----
  publicViseFr: string;
  /** « À l'issue, le participant est capable de » (objectifs pédagogiques). */
  objectifsFr: ReadonlyArray<string>;
  beneficeDirigeantFr: string;
  /** « Concrètement : … » (ordre de grandeur illustratif, pas un engagement). */
  equationTempsFr: string;
  programme: ReadonlyArray<FormationProgrammeSection>;
  faqs: ReadonlyArray<FormationV2Faq>;
  // ---- Modalités & pratique (défauts centralisés dans catalog-v2-facts.ts) ----
  /** Format. Défaut = présentiel + distanciel possible. Surcharge si différent. */
  modalites?: ReadonlyArray<ModalitePedagogique>;
  /** Matériel requis. Défaut = « un ordinateur avec connexion internet ». */
  materielFr?: string;
  /** Effectif du groupe. Défaut = « Jusqu'à 15 participants ». */
  effectifFr?: string;
  /** Outils réellement pratiqués (phrase complète, rendue en FAQ). */
  outilsFr?: string;
  /** Délai d'accès (indicateur 1). Défaut centralisé dans catalog-v2-facts.ts. */
  delaiAccesFr?: string;
  /** Méthodes pédagogiques (indicateur 1). Défaut centralisé. */
  methodesFr?: string;
  /** Modalités d'évaluation (indicateur 1). Défaut centralisé. */
  modalitesEvaluationFr?: string;
  /** Accessibilité handicap (indicateur 1). Défaut centralisé. */
  accessibiliteHandicapFr?: string;
  // ---- Contenu enrichi (optionnel — fallback template si absent) ----
  /** Cas d'usage concrets (« ce que vos équipes en retirent »). Fallback = objectifs. */
  casUsageFr?: ReadonlyArray<FormationCasUsage>;
  /** Avant / après la formation (transformation concrète). */
  avantApresFr?: { avant: string; apres: string };
  /** Résultats concrets & mesurables (ex. { valeur: "1 à 2 h", label: "gagnées / jour" }). */
  resultatsFr?: ReadonlyArray<{ valeur: string; label: string }>;
  /** Image spécifique (sinon fallback par gamme, cf. catalog-v2-facts.ts). */
  imageSrc?: string;
  imageAltFr?: string;
  /** Crédit photographe si l'image est une photo Unsplash (CGU §6). */
  imageCredit?: { name: string; url: string };
}

// ============================================================================
// OFFRES GÉNÉRALES (4)
// ============================================================================

const BIEN_COMMENCER_4H: FormationV2 = {
  id: "ia-pour-bien-commencer",
  slugFr: "ia-pour-bien-commencer",
  slugEn: "ai-for-getting-started",
  numero: 1,
  gamme: "ia-standard",
  categorie: "generale",
  duree: "4h",
  featured: true,
  titreFr: "IA pour bien commencer",
  accrocheFr:
    "Prenez une longueur d'avance sur l'IA en une demi-journée — comprendre l'IA et l'utiliser dès aujourd'hui",
  h1Fr: "Formation IA pour bien commencer : comprendre l'IA et l'utiliser dès aujourd'hui (4 heures)",
  metaTitleFr: "Formation IA pour bien commencer — 4h",
  metaDescriptionFr:
    "Formation IA d'initiation en entreprise, 4 h, sans prérequis : comprendre l'IA, choisir le bon outil et l'utiliser dès aujourd'hui. 1 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA débutant",
    "initiation intelligence artificielle entreprise",
    "comprendre l'IA",
    "ChatGPT Claude Gemini",
    "formation IA 4 heures",
    "premiers pas IA",
  ],
  publicViseFr:
    "Tout collaborateur, toutes fonctions : de ceux qui n'ont jamais ouvert un outil d'IA à ceux qui en entendent parler partout sans savoir par où commencer. En 4 heures, l'équipe passe de « on en entend parler partout » à « je sais m'en servir » — une immersion dense et concrète, sans jargon, pour lever les blocages.",
  casUsageFr: [
    { texteFr: "Une vision claire de ce que l'IA peut — et ne peut pas — faire pour son poste" },
    {
      texteFr: "Les meilleurs outils du moment (ChatGPT, Claude, Gemini) et lequel utiliser quand",
    },
    {
      texteFr:
        "Les premières techniques pour obtenir des résultats utiles, pas des réponses génériques",
    },
    { texteFr: "Des cas d'usage directement applicables à son poste, dès le lendemain" },
  ],
  objectifsFr: [
    "Décrire ce qu'est une IA générative, ce qu'elle fait bien et ses limites",
    "Identifier l'outil adapté (ChatGPT, Claude, Gemini) selon la tâche",
    "Formuler une demande structurée (méthode AXION) donnant un résultat exploitable",
    "Réaliser une tâche courante de son poste à l'aide de l'IA",
    "Appliquer les règles de confidentialité : identifier les données à ne pas soumettre",
  ],
  beneficeDirigeantFr:
    "En une demi-journée, toute l'équipe a fait ses premiers pas : chacun connaît les bons outils, sait les utiliser sur une tâche réelle de son quotidien et repart avec les bons réflexes de confidentialité — sans désorganiser votre activité.",
  equationTempsFr:
    "4 h d'immersion → ce qui prenait une demi-heure — rédiger un e-mail délicat, résumer un long document — peut souvent se faire en quelques minutes.",
  avantApresFr: {
    avant: "L'IA paraît complexe, réservée aux experts, un peu inquiétante.",
    apres:
      "Chacun a fait ses premiers pas, connaît les bons outils et sait les utiliser sur une tâche réelle de son quotidien.",
  },
  materielFr:
    "Ordinateur portable et connexion internet ; accès aux outils IA préparé avec vous en amont si besoin",
  programme: [
    {
      titreFr: "Module 1 — Comprendre l'IA générative, sans jargon",
      steps: [
        {
          titre:
            "Ce qu'est une IA générative : principes expliqués simplement, démonstration en direct",
        },
        { titre: "Ce qu'elle fait bien, où elle se trompe : hallucinations, excès de confiance" },
        {
          titre:
            "Panorama des outils du moment — ChatGPT, Claude, Gemini — et lequel ouvrir selon la tâche",
        },
        { titre: "Ce que l'IA change (et ne change pas) pour chaque poste de l'équipe" },
      ],
    },
    {
      titreFr: "Module 2 — Bien formuler sa demande : la méthode AXION",
      steps: [
        {
          titre: "Pourquoi une demande vague donne une réponse générique — démonstration comparée",
        },
        { titre: "La méthode de formulation AXION appliquée pas à pas sur des cas réels" },
        { titre: "Itérer : préciser, reformuler, faire relire l'IA pour fiabiliser le résultat" },
        { titre: "Exercice : chacun formule une demande structurée sur une tâche de son poste" },
      ],
    },
    {
      titreFr: "Module 3 — Premiers cas d'usage appliqués au poste",
      steps: [
        { titre: "Rédiger un e-mail délicat, résumer un long document, préparer une réunion" },
        { titre: "Atelier : chaque participant réalise une tâche courante de son poste avec l'IA" },
        {
          titre: "Tour de table des résultats : ce qui marche, ce qui surprend, ce qu'on améliore",
        },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité, fiabilité et envol",
      steps: [
        { titre: "Les règles de confidentialité : ce qu'on ne soumet jamais à une IA" },
        { titre: "Vérifier avant de réutiliser : les réflexes de fiabilité" },
        { titre: "Chacun repart avec ses cas d'usage à tester dès le lendemain" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Mémo de la méthode AXION + guide des bonnes pratiques de confidentialité",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il un niveau en informatique ou en IA pour participer ?",
      reponse:
        "Aucun. La formation est conçue pour des débutants complets : chaque notion est expliquée sans jargon avant d'être mise en pratique. Les collaborateurs qui utilisent déjà l'IA occasionnellement y gagnent une méthode et des réflexes qu'ils n'ont pas.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance, avec le même contenu et le même niveau d'interactivité. L'accès aux outils IA est préparé avec vous en amont si besoin.",
    },
    {
      question: "4 heures suffisent-elles vraiment ?",
      reponse:
        "Pour bien commencer, oui : le format condensé lève les blocages et donne à chacun des usages applicables dès le lendemain. Pour aller plus loin et pratiquer davantage sur les cas de chacun, la version journée complète ajoute autant de pratique que de théorie.",
    },
  ],
};

const BIEN_COMMENCER_JOURNEE: FormationV2 = {
  id: "ia-pour-bien-commencer-journee",
  slugFr: "ia-pour-bien-commencer-journee",
  slugEn: "ai-for-getting-started-full-day",
  numero: 2,
  gamme: "ia-standard",
  categorie: "generale",
  duree: "1j",
  titreFr: "IA pour bien commencer — journée complète",
  accrocheFr:
    "Donnez à vos équipes le temps de vraiment s'approprier l'IA — comprendre l'IA et l'utiliser dès aujourd'hui",
  h1Fr: "Formation IA pour bien commencer — journée complète : s'approprier l'IA sur ses propres tâches",
  metaTitleFr: "Formation IA pour bien commencer — 1 jour",
  metaDescriptionFr:
    "Formation IA d'initiation sur une journée : autant de pratique que de théorie, sur les cas réels de chaque participant. 1 900 € HT par groupe, sans prérequis.",
  termesSemantiquesFr: [
    "formation IA débutant 1 jour",
    "initiation IA entreprise",
    "s'approprier l'IA",
    "formation IA pratique",
    "ChatGPT Claude Gemini",
    "cas d'usage IA métier",
  ],
  publicViseFr:
    "Tout collaborateur, toutes fonctions. Le format d'une journée pour aller plus loin que la découverte : autant de pratique que de théorie, sur les cas d'usage réels de chaque participant. On ne repart pas avec des notes, mais avec des méthodes déjà testées sur son propre travail.",
  casUsageFr: [
    { texteFr: "Tout l'essentiel de la version condensée, avec le temps de le mettre en pratique" },
    { texteFr: "Des ateliers guidés sur les cas d'usage propres à chaque participant" },
    { texteFr: "Des techniques approfondies pour des résultats fiables et réutilisables" },
    {
      texteFr:
        "Un premier aperçu des usages avancés : traitement de documents, automatisation légère",
    },
  ],
  objectifsFr: [
    "Décrire ce qu'est une IA générative, ce qu'elle fait bien et ses limites",
    "Identifier l'outil adapté selon la tâche",
    "Formuler une demande structurée (méthode AXION) et l'itérer pour fiabiliser le résultat",
    "Réaliser plusieurs tâches de son poste à l'aide de l'IA",
    "Analyser un document : synthèse et points de vigilance",
    "Appliquer les règles de confidentialité et vérifier une production avant diffusion",
  ],
  beneficeDirigeantFr:
    "À la fin de la journée, chaque participant a testé plusieurs usages sur ses propres tâches et sait par où continuer seul — l'appropriation est faite pendant la formation, pas remise à plus tard.",
  equationTempsFr:
    "1 journée de pratique → chaque participant repart avec plusieurs usages déjà essayés sur ses propres tâches, plutôt qu'une simple démonstration.",
  avantApresFr: {
    avant: "L'IA paraît complexe, réservée aux experts, un peu inquiétante.",
    apres:
      "Chaque participant a testé plusieurs usages sur ses propres tâches et sait par où continuer seul.",
  },
  materielFr:
    "Ordinateur portable et connexion internet ; accès aux outils IA préparé avec vous en amont si besoin",
  programme: [
    {
      titreFr: "Module 1 — Comprendre l'IA générative et choisir son outil",
      steps: [
        { titre: "Ce qu'est une IA générative, ce qu'elle fait bien, ses limites" },
        { titre: "Panorama ChatGPT, Claude, Gemini : lequel ouvrir selon la tâche" },
        { titre: "Démonstrations commentées sur des tâches types de l'entreprise" },
        {
          titre: "Les risques à connaître : hallucinations, confiance excessive, fuite de données",
        },
      ],
    },
    {
      titreFr: "Module 2 — Formuler, itérer, fiabiliser (méthode AXION)",
      steps: [
        { titre: "La méthode de formulation AXION appliquée pas à pas" },
        {
          titre:
            "Itérer une demande jusqu'au résultat exploitable : préciser, reformuler, faire relire",
        },
        { titre: "Exercice guidé : chacun construit et affine une demande sur une tâche réelle" },
      ],
    },
    {
      titreFr: "Module 3 — Ateliers sur les cas de chaque participant",
      steps: [
        {
          titre:
            "Chaque participant travaille sur 2 à 3 tâches réelles de son poste, guidé par le formateur",
        },
        { titre: "Analyse de documents : synthèse d'un document long, points de vigilance" },
        { titre: "Mise en commun : les usages qui marchent, partagés à toute l'équipe" },
      ],
    },
    {
      titreFr: "Module 4 — Aller plus loin : documents, automatisation légère, confidentialité",
      steps: [
        { titre: "Premier aperçu du traitement de documents et de l'automatisation légère" },
        { titre: "Vérifier une production avant diffusion : les réflexes de fiabilité" },
        {
          titre:
            "Règles de confidentialité : ce qu'on ne soumet jamais, et comment travailler malgré tout",
        },
        { titre: "Temps de questions-réponses étendu, adapté à votre contexte" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre:
            "Mémo AXION + trames réutilisables construites en séance + guide de bonnes pratiques",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Quelle différence avec la version condensée de 4 heures ?",
      reponse:
        "Le contenu essentiel est le même, mais la journée complète ajoute autant de pratique que de théorie : chaque participant travaille sur ses propres tâches en atelier guidé, approfondit les techniques de fiabilisation et découvre le traitement de documents et l'automatisation légère.",
    },
    {
      question: "Faut-il avoir déjà utilisé l'IA ?",
      reponse:
        "Non, aucun prérequis. La formation accueille aussi bien des débutants complets que des collaborateurs qui utilisent déjà l'IA sans méthode — chacun progresse sur ses propres cas.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance, avec exactement le même contenu et le même niveau d'interactivité.",
    },
  ],
};

const IA_POUR_LES_EQUIPES: FormationV2 = {
  id: "ia-pour-les-equipes",
  slugFr: "ia-pour-les-equipes",
  slugEn: "ai-for-teams",
  numero: 3,
  gamme: "ia-standard",
  categorie: "generale",
  duree: "1j",
  featured: true,
  titreFr: "IA pour les équipes",
  accrocheFr:
    "Et si vos équipes gagnaient du temps chaque jour ? Gagner du temps au quotidien grâce à l'IA",
  h1Fr: "Formation IA pour les équipes : gagner du temps au quotidien",
  metaTitleFr: "Formation IA pour les équipes — 1 jour",
  metaDescriptionFr:
    "Formation IA en entreprise, 1 jour : transformer des usages dispersés en pratique commune — rédaction, synthèse, prompts réutilisables. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA équipe",
    "gagner du temps IA",
    "pratique IA commune",
    "prompts réutilisables",
    "formation IA entreprise 1 jour",
    "productivité IA",
  ],
  publicViseFr:
    "Collaborateurs de tous services qui utilisent déjà l'IA, mais chacun à sa façon, avec des résultats inégaux. Cette journée transforme des usages dispersés en une pratique commune, efficace et partagée — sur les vraies tâches de votre entreprise.",
  casUsageFr: [
    { texteFr: "Des techniques avancées pour obtenir exactement ce qu'on attend de l'IA" },
    { texteFr: "La rédaction, la synthèse et la recherche accélérées" },
    { texteFr: "Des prompts réutilisables, construits pendant la formation" },
    { texteFr: "Des ateliers sur les tâches réelles apportées par les participants" },
  ],
  objectifsFr: [
    "Formuler des demandes structurées avancées (méthode AXION) adaptées à ses tâches",
    "Accélérer la rédaction, la synthèse et la recherche d'informations à l'aide de l'IA",
    "Construire et réutiliser des prompts sur ses tâches récurrentes",
    "Vérifier et fiabiliser une production avant diffusion",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Une équipe qui partage les mêmes bons réflexes et gagne un temps mesurable sur ses tâches récurrentes — au lieu d'un usage au cas par cas, dépendant de la personne.",
  equationTempsFr:
    "1 journée → un compte-rendu de réunion mis au propre en quelques minutes plutôt qu'en fin de journée.",
  avantApresFr: {
    avant: "Un usage de l'IA au cas par cas, dépendant de la personne.",
    apres:
      "Une équipe qui partage les mêmes bons réflexes et gagne un temps mesurable sur ses tâches récurrentes.",
  },
  programme: [
    {
      titreFr: "Module 1 — Techniques de formulation avancées",
      steps: [
        { titre: "Ce qui sépare une réponse générique d'un résultat directement exploitable" },
        { titre: "La méthode AXION en pratique avancée : contraintes, exemples, itération" },
        {
          titre:
            "Exercice : chacun transforme une demande vague en demande structurée sur sa tâche",
        },
      ],
    },
    {
      titreFr: "Module 2 — Rédaction, synthèse et recherche accélérées",
      steps: [
        { titre: "Rédiger plus vite : e-mails, comptes-rendus, notes internes, documents clients" },
        { titre: "Synthétiser un document long ou un fil d'échanges en quelques minutes" },
        { titre: "Rechercher et recouper une information avec l'IA, puis la vérifier" },
        { titre: "Atelier : chaque participant applique sur une tâche réelle apportée en séance" },
      ],
    },
    {
      titreFr: "Module 3 — Construire ses prompts réutilisables",
      steps: [
        { titre: "Identifier ses tâches récurrentes à fort volume : le meilleur terrain de gain" },
        { titre: "Construire un prompt réutilisable : structure, ton, format de sortie" },
        { titre: "Atelier : chacun construit et teste 2 à 3 prompts sur ses tâches de la semaine" },
      ],
    },
    {
      titreFr: "Module 4 — Fiabiliser, sécuriser, ancrer la pratique commune",
      steps: [
        { titre: "Vérifier et fiabiliser une production avant diffusion" },
        { titre: "Les règles de confidentialité partagées par toute l'équipe" },
        { titre: "Mise en commun : la bibliothèque de prompts de l'équipe, constituée en séance" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Bibliothèque de prompts d'équipe construite en séance + mémo AXION",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Nos équipes utilisent déjà l'IA — que va leur apporter cette journée ?",
      reponse:
        "C'est précisément le public visé : des usages existent, mais dispersés et inégaux. La journée installe une pratique commune — mêmes méthodes, mêmes réflexes de fiabilité, prompts partagés — et chacun repart avec des gains mesurables sur ses tâches récurrentes.",
    },
    {
      question: "Sur quels outils travaille-t-on ?",
      reponse:
        "Sur les outils que vos équipes utilisent déjà ou que vous envisagez : ChatGPT, Claude, Gemini. La méthode enseignée est valable quel que soit l'outil.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux ou à distance, avec le même contenu. Les ateliers portent dans les deux cas sur les tâches réelles apportées par les participants.",
    },
  ],
};

const IA_POUR_L_AUTOMATISATION: FormationV2 = {
  id: "ia-pour-l-automatisation",
  slugFr: "ia-pour-l-automatisation",
  slugEn: "ai-for-automation",
  numero: 4,
  gamme: "ia-standard",
  categorie: "generale",
  duree: "2j",
  scindable: true,
  featured: true,
  titreFr: "IA pour l'automatisation",
  accrocheFr:
    "Arrêtez de refaire chaque semaine les mêmes tâches à la main — vos premières automatisations concrètes",
  h1Fr: "Formation IA pour l'automatisation : vos premières automatisations concrètes (2 jours)",
  metaTitleFr: "Formation IA automatisation — 2 jours",
  metaDescriptionFr:
    "Formation automatisation IA, 2 jours scindables : repérer les tâches répétitives et bâtir une première automatisation sur un cas réel. 3 600 € HT par groupe.",
  termesSemantiquesFr: [
    "formation automatisation IA",
    "automatiser tâches répétitives",
    "premières automatisations",
    "processus automatisé entreprise",
    "formation IA 2 jours",
    "prototype automatisation",
  ],
  publicViseFr:
    "Référents IA, responsables opérationnels et volontaires motivés. Deux jours pour identifier ce qui vous fait perdre du temps et poser, ensemble, vos premières automatisations sur un cas réel de votre entreprise. Vous ne repartez pas avec une théorie, mais avec une première réalisation.",
  prerequisFr:
    "Aucun prérequis technique poussé. Une pratique régulière des outils bureautiques suffit ; aucune compétence en programmation n'est demandée.",
  casUsageFr: [
    { texteFr: "La capacité à repérer les tâches qui méritent d'être automatisées" },
    { texteFr: "La conception d'un premier processus automatisé simple" },
    { texteFr: "Un panorama des outils compatibles avec votre environnement" },
    { texteFr: "Une première réalisation, construite et testée sur un cas de votre activité" },
  ],
  objectifsFr: [
    "Identifier les tâches répétitives automatisables dans son activité",
    "Concevoir un processus automatisé simple assisté par l'IA",
    "Choisir un outil adapté à son environnement",
    "Construire et tester un premier prototype sur un cas réel",
    "Appliquer les règles de confidentialité et de fiabilité",
  ],
  beneficeDirigeantFr:
    "Une première automatisation en place à la fin des deux jours, et une méthode pour en repérer d'autres — les tâches refaites à la main chaque semaine commencent à disparaître.",
  equationTempsFr:
    "2 jours → une tâche répétée chaque semaine — un rapport à compiler, des données à trier — préparée une fois pour être reproduite ensuite.",
  avantApresFr: {
    avant: "Des tâches répétitives faites manuellement, semaine après semaine.",
    apres: "Une première automatisation en place et une méthode pour en repérer d'autres.",
  },
  materielFr:
    "Ordinateur portable, connexion internet, accès aux outils IA et aux données concernées par les cas pratiques",
  programme: [
    {
      titreFr: "Jour 1 — Identifier et concevoir",
      steps: [
        { titre: "Repérer les tâches automatisables : volume, répétitivité, règles claires" },
        { titre: "Cartographier ses processus : ce qui se fait à la main, semaine après semaine" },
        { titre: "Concevoir un processus automatisé simple : entrées, étapes, sorties, contrôles" },
        { titre: "Panorama des outils compatibles avec votre environnement de travail" },
        { titre: "Atelier : chaque participant choisit et cadre son cas d'automatisation" },
        {
          temps: "Livrable",
          titre: "Cartographie des tâches automatisables de l'équipe + fiche de cadrage par cas",
        },
      ],
    },
    {
      titreFr: "Jour 2 — Construire et tester",
      steps: [
        { titre: "Construction guidée du premier prototype, pas à pas, sur le cas réel de chacun" },
        {
          titre:
            "Tester, corriger, fiabiliser : les contrôles qui rendent l'automatisation digne de confiance",
        },
        {
          titre:
            "Confidentialité et fiabilité : ce qu'une automatisation ne doit jamais faire seule",
        },
        {
          titre: "Passer du prototype à l'usage quotidien : bonnes pratiques de mise en production",
        },
        {
          titre: "Feuille de route : les prochaines automatisations à lancer, priorisées ensemble",
        },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Un prototype d'automatisation construit et testé + méthode pour les suivantes",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il savoir coder pour participer ?",
      reponse:
        "Non. La formation ne demande aucun prérequis technique poussé : une pratique régulière des outils bureautiques suffit. Les automatisations sont construites de façon guidée, avec des outils accessibles.",
    },
    {
      question: "Peut-on scinder les 2 jours ?",
      reponse:
        "Oui, la formation est scindable en 2 sessions d'une journée — par exemple à une ou deux semaines d'intervalle, ce qui permet de tester entre les deux journées.",
    },
    {
      question: "Repart-on vraiment avec une automatisation qui fonctionne ?",
      reponse:
        "Oui : le jour 2 est consacré à la construction et au test d'un premier prototype sur un cas réel de votre activité. Vous repartez avec cette première réalisation et une méthode pour en repérer et construire d'autres.",
    },
  ],
};

// ============================================================================
// OFFRES PAR MÉTIER (9)
// ============================================================================

const IA_POUR_LES_RH: FormationV2 = {
  id: "ia-pour-les-rh",
  slugFr: "ia-pour-les-rh",
  slugEn: "ai-for-hr",
  numero: 5,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "RH",
  duree: "1j",
  titreFr: "IA pour les RH",
  accrocheFr:
    "Rendez du temps à vos RH pour ce qui compte vraiment : l'humain — simplifier le quotidien de toute la fonction",
  h1Fr: "Formation IA pour les RH : simplifier le quotidien de toute la fonction",
  metaTitleFr: "Formation IA pour les RH — 1 jour",
  metaDescriptionFr:
    "Formation IA pour les RH (1 jour, intra) : offres et fiches de poste, tri des candidatures, communication interne, réflexes RGPD. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA RH",
    "IA recrutement",
    "rédaction offre d'emploi IA",
    "tri candidatures IA",
    "RGPD données RH",
    "formation IA ressources humaines",
  ],
  publicViseFr:
    "Chargés et responsables RH, recrutement et administration du personnel. Entre les offres à rédiger, les candidatures à trier et l'administratif qui s'accumule, les équipes RH courent après le temps : cette journée met l'IA au service de leur quotidien, pour alléger les tâches répétitives et se recentrer sur la relation.",
  casUsageFr: [
    { texteFr: "La rédaction d'offres et de fiches de poste en quelques minutes" },
    { texteFr: "Le tri et la présynthèse des candidatures" },
    { texteFr: "Des supports de communication interne prêts plus vite" },
    { texteFr: "Les bons réflexes RGPD sur les données RH" },
  ],
  objectifsFr: [
    "Rédiger offres et fiches de poste à l'aide de l'IA (méthode AXION)",
    "Trier et présynthétiser des candidatures",
    "Produire des supports de communication interne",
    "Appliquer les règles RGPD aux données RH",
    "Vérifier et fiabiliser une production avant diffusion",
  ],
  beneficeDirigeantFr:
    "Un temps RH redirigé vers les entretiens et l'accompagnement : les tâches répétitives sont largement allégées, la fonction se recentre sur l'humain.",
  equationTempsFr:
    "1 journée → une offre d'emploi rédigée en quelques minutes plutôt qu'en une demi-heure.",
  avantApresFr: {
    avant: "Des process RH chronophages, une charge administrative lourde.",
    apres:
      "Un temps redirigé vers les entretiens et l'accompagnement, des tâches répétitives largement allégées.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA appliquée à la fonction RH",
      steps: [
        { titre: "Ce que l'IA change pour la fonction RH : panorama des usages qui marchent" },
        { titre: "La méthode AXION appliquée aux écrits RH" },
        { titre: "Rédiger offres d'emploi et fiches de poste : atelier sur vos postes réels" },
      ],
    },
    {
      titreFr: "Module 2 — Recrutement : trier et présynthétiser",
      steps: [
        { titre: "Présynthétiser un lot de candidatures pour préparer la sélection humaine" },
        { titre: "Préparer ses entretiens : grilles de questions et synthèses par profil" },
        { titre: "La limite à connaître : l'IA prépare, l'humain décide — jamais l'inverse" },
      ],
    },
    {
      titreFr: "Module 3 — Communication interne et administratif",
      steps: [
        { titre: "Notes internes, annonces, supports d'onboarding produits plus vite" },
        { titre: "Courriers et documents types du quotidien RH" },
        { titre: "Atelier : chaque participant traite une tâche réelle apportée en séance" },
      ],
    },
    {
      titreFr: "Module 4 — RGPD, confidentialité et ancrage",
      steps: [
        { titre: "Les règles RGPD appliquées aux données RH : ce qu'on ne soumet jamais à l'IA" },
        { titre: "Vérifier et fiabiliser une production avant diffusion" },
        {
          titre:
            "Feuille de route : les usages à installer dans la fonction dès la semaine suivante",
        },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Bibliothèque de prompts RH + trames d'offres, de synthèses et de courriers",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA va-t-elle décider à la place des RH ?",
      reponse:
        "Non, et c'est une règle posée dès le premier module : l'IA prépare (rédaction, tri préliminaire, synthèses), l'humain décide. Aucune décision de recrutement ou d'évaluation n'est déléguée à l'IA.",
    },
    {
      question: "Comment sont protégées les données des candidats et des salariés ?",
      reponse:
        "Un module entier est consacré aux règles RGPD appliquées aux données RH : ce qu'on ne soumet jamais à une IA, comment anonymiser, et comment travailler efficacement malgré ces contraintes.",
    },
    {
      question: "Faut-il déjà utiliser l'IA pour participer ?",
      reponse:
        "Non, aucun prérequis. La journée s'adresse à toute la fonction RH, du débutant complet à l'utilisateur occasionnel qui veut des méthodes fiables.",
    },
  ],
};

const IA_POUR_LE_MARKETING: FormationV2 = {
  id: "ia-pour-le-marketing",
  slugFr: "ia-pour-le-marketing",
  slugEn: "ai-for-marketing",
  numero: 6,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Marketing / Communication",
  duree: "1j",
  titreFr: "IA pour le marketing",
  accrocheFr:
    "Produisez plus de contenu, sans épuiser vos équipes — gagner en efficacité sur l'ensemble des missions",
  h1Fr: "Formation IA pour le marketing : gagner en efficacité sur l'ensemble des missions",
  metaTitleFr: "Formation IA pour le marketing — 1 jour",
  metaDescriptionFr:
    "Formation IA marketing (1 jour, intra) : génération de contenus, déclinaison multi-formats, analyse de campagnes, veille concurrentielle. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA marketing",
    "génération de contenu IA",
    "IA communication",
    "déclinaison multi-formats",
    "analyse campagne IA",
    "veille concurrentielle IA",
  ],
  publicViseFr:
    "Chargés et responsables marketing, communication et contenu. La pression du contenu ne redescend jamais — posts, newsletters, campagnes : cette journée donne à l'équipe les moyens de produire plus vite, en interne, sans sacrifier la qualité ni exploser le budget.",
  casUsageFr: [
    { texteFr: "La génération de contenus : posts, newsletters, visuels" },
    { texteFr: "La déclinaison d'un message sur tous les formats" },
    { texteFr: "L'analyse de campagnes assistée par l'IA" },
    { texteFr: "Une veille concurrentielle plus rapide" },
  ],
  objectifsFr: [
    "Générer des contenus (posts, newsletters, visuels) à l'aide de l'IA",
    "Décliner un message sur plusieurs formats",
    "Analyser des résultats de campagne avec l'appui de l'IA",
    "Mener une veille concurrentielle assistée",
    "Vérifier et fiabiliser une production avant diffusion",
  ],
  beneficeDirigeantFr:
    "Une production de contenu interne accélérée et plus de campagnes testées à budget constant — sans dépendre systématiquement de prestataires.",
  equationTempsFr:
    "1 journée → une série de posts déclinée en quelques minutes à partir d'une seule idée de départ.",
  avantApresFr: {
    avant: "Une production de contenu lente, souvent dépendante de prestataires.",
    apres: "Une production interne accélérée et plus de campagnes testées à budget constant.",
  },
  programme: [
    {
      titreFr: "Module 1 — Générer des contenus qui vous ressemblent",
      steps: [
        { titre: "La méthode AXION appliquée au marketing : ton de marque, cibles, formats" },
        { titre: "Posts, newsletters, pages : produire un premier jet exploitable en minutes" },
        { titre: "Créer des visuels avec l'IA : possibilités et limites actuelles" },
      ],
    },
    {
      titreFr: "Module 2 — Décliner un message sur tous les formats",
      steps: [
        { titre: "D'une idée à une série : post, newsletter, script vidéo, communiqué" },
        { titre: "Garder la cohérence de marque sur toutes les déclinaisons" },
        { titre: "Atelier : chaque participant décline un message réel de l'entreprise" },
      ],
    },
    {
      titreFr: "Module 3 — Analyser ses campagnes et surveiller son marché",
      steps: [
        { titre: "Faire parler ses résultats de campagne : synthèses et enseignements assistés" },
        { titre: "Veille concurrentielle : dégrossir vite, vérifier ensuite" },
        { titre: "Atelier : analyse d'une campagne récente apportée par les participants" },
      ],
    },
    {
      titreFr: "Module 4 — Qualité, droits et ancrage",
      steps: [
        { titre: "Vérifier et fiabiliser avant diffusion : la qualité ne se délègue pas" },
        { titre: "Confidentialité et bonnes pratiques : données clients, briefs, embargo" },
        { titre: "Feuille de route contenu : les gains à installer dès la semaine suivante" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Bibliothèque de prompts marketing + trames de déclinaison multi-formats",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Le contenu généré ne va-t-il pas ressembler à celui de tout le monde ?",
      reponse:
        "C'est tout l'objet de la journée : on apprend à faire produire des contenus dans votre ton de marque, à partir de vos messages et de vos cibles — puis à les retravailler. L'IA accélère le premier jet ; la voix reste la vôtre.",
    },
    {
      question: "Travaille-t-on sur nos vraies campagnes ?",
      reponse:
        "Oui : les ateliers portent sur des messages et campagnes réels apportés par les participants — vous repartez avec des contenus et des trames directement réutilisables.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux ou à distance, avec le même contenu et les mêmes ateliers pratiques.",
    },
  ],
};

const IA_POUR_LES_COMMERCIAUX: FormationV2 = {
  id: "ia-pour-les-commerciaux",
  slugFr: "ia-pour-les-commerciaux",
  slugEn: "ai-for-sales",
  numero: 7,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Commercial / Vente",
  duree: "1j",
  titreFr: "IA pour les commerciaux",
  accrocheFr:
    "Plus de temps pour vendre, moins pour l'administratif — vendre plus, sur tous les fronts",
  h1Fr: "Formation IA pour les commerciaux : vendre plus, sur tous les fronts",
  metaTitleFr: "Formation IA pour les commerciaux — 1 jour",
  metaDescriptionFr:
    "Formation IA commerciale (1 jour, intra) : préparation de rendez-vous, propositions percutantes, relances, qualification de prospects. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA commerciaux",
    "IA vente",
    "proposition commerciale IA",
    "préparation rendez-vous IA",
    "relance client IA",
    "qualification prospects IA",
  ],
  publicViseFr:
    "Commerciaux terrain et sédentaires, responsables commerciaux. Un bon commercial passe trop d'heures à préparer, rédiger et relancer : cette journée met l'IA au service de leur efficacité, pour libérer du temps de terrain et accélérer chaque étape du cycle de vente.",
  casUsageFr: [
    { texteFr: "La préparation de rendez-vous et d'argumentaires en un temps record" },
    { texteFr: "La rédaction de propositions commerciales percutantes" },
    { texteFr: "Des relances et un suivi client mieux tenus" },
    { texteFr: "La qualification de prospects assistée par l'IA" },
  ],
  objectifsFr: [
    "Préparer rendez-vous et argumentaires à l'aide de l'IA",
    "Rédiger des propositions commerciales structurées (méthode AXION)",
    "Rédiger relances et suivis client",
    "Qualifier des prospects avec l'appui de l'IA",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Plus d'heures consacrées au terrain et des propositions produites bien plus vite — le temps administratif cesse de grignoter le temps de vente.",
  equationTempsFr:
    "1 journée → une proposition commerciale mise en forme en quelques minutes à partir de vos notes.",
  avantApresFr: {
    avant: "Un temps administratif qui grignote le temps de vente.",
    apres: "Plus d'heures consacrées au terrain, des propositions produites bien plus vite.",
  },
  programme: [
    {
      titreFr: "Module 1 — Préparer ses rendez-vous en un temps record",
      steps: [
        { titre: "Se renseigner sur un prospect et son secteur en quelques minutes" },
        { titre: "Construire un argumentaire ciblé : la méthode AXION appliquée à la vente" },
        { titre: "Atelier : chaque participant prépare un rendez-vous réel de sa semaine" },
      ],
    },
    {
      titreFr: "Module 2 — Des propositions commerciales percutantes",
      steps: [
        { titre: "De vos notes à une proposition structurée et mise en forme" },
        { titre: "Adapter le ton et l'angle au client : décideur, technique, achat" },
        { titre: "Atelier : rédaction d'une proposition sur un cas réel en cours" },
      ],
    },
    {
      titreFr: "Module 3 — Relances, suivi et qualification",
      steps: [
        { titre: "Des relances qui n'ont pas l'air de relances : ton, timing, personnalisation" },
        { titre: "Tenir son suivi client à jour sans y passer ses soirées" },
        { titre: "Qualifier des prospects avec l'appui de l'IA : critères et présynthèse" },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité et passage à l'action",
      steps: [
        { titre: "Ce qu'on ne soumet jamais à l'IA : données clients, prix négociés, contrats" },
        { titre: "Vérifier avant d'envoyer : les réflexes qui protègent la relation client" },
        { titre: "Feuille de route individuelle : les gains à installer dès la semaine suivante" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Bibliothèque de prompts commerciaux + trames de propositions et de relances",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Est-ce adapté aux commerciaux terrain, pas très « outils » ?",
      reponse:
        "Oui : aucun prérequis technique, et les cas travaillés sont ceux du quotidien commercial — préparation de rendez-vous, propositions, relances. Chaque participant travaille sur ses propres affaires en cours.",
    },
    {
      question: "Nos données clients sont-elles en sécurité ?",
      reponse:
        "Un module est consacré à la confidentialité : données clients nominatives, prix négociés et contrats ne sont jamais soumis à l'IA. On apprend à travailler efficacement dans ce cadre.",
    },
    {
      question: "Peut-on former ensemble commerciaux sédentaires et terrain ?",
      reponse:
        "Oui, c'est même recommandé : les techniques sont communes et les ateliers s'adaptent aux cas de chacun — prospection, rendez-vous, propositions ou suivi.",
    },
  ],
};

const IA_POUR_LA_FINANCE: FormationV2 = {
  id: "ia-pour-la-finance",
  slugFr: "ia-pour-la-finance",
  slugEn: "ai-for-finance",
  numero: 8,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Finance / Comptabilité",
  duree: "1j",
  titreFr: "IA pour la finance",
  accrocheFr:
    "Des chiffres plus fiables, produits plus vite — fiabiliser et accélérer le quotidien",
  h1Fr: "Formation IA pour la finance : fiabiliser et accélérer le quotidien",
  metaTitleFr: "Formation IA pour la finance — 1 jour",
  metaDescriptionFr:
    "Formation IA finance, 1 jour : analyse de documents financiers, rapprochements simples, rapports et tableaux de bord assistés par l'IA. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA finance",
    "IA comptabilité",
    "analyse documents financiers IA",
    "reporting financier IA",
    "tableaux de bord IA",
    "contrôle de gestion IA",
  ],
  publicViseFr:
    "Comptables, contrôleurs de gestion, responsables administratifs et financiers. Analyses, contrôles, rapports : la finance manipule des volumes qui laissent peu de place à l'erreur et beaucoup de place à la lenteur — cette journée montre comment l'IA sécurise et accélère les tâches à faible valeur ajoutée.",
  casUsageFr: [
    { texteFr: "L'analyse et la synthèse de documents financiers" },
    { texteFr: "L'automatisation de rapprochements simples" },
    { texteFr: "L'aide à la rédaction de rapports et tableaux de bord" },
    { texteFr: "Des contrôles et vérifications assistés par l'IA" },
  ],
  objectifsFr: [
    "Analyser et synthétiser des documents financiers à l'aide de l'IA",
    "Automatiser des rapprochements simples",
    "Produire rapports et tableaux de bord assistés",
    "Contrôler et vérifier une production avant diffusion",
    "Appliquer les règles de confidentialité aux données financières",
  ],
  beneficeDirigeantFr:
    "Des contrôles plus rapides, des rapports produits plus vite et moins d'erreurs de saisie — la fonction finance gagne en fiabilité en gagnant du temps.",
  equationTempsFr:
    "1 journée → la synthèse d'un rapport de plusieurs pages ramenée à l'essentiel en quelques minutes.",
  avantApresFr: {
    avant: "Un traitement manuel de gros volumes, un risque d'erreur permanent.",
    apres:
      "Des contrôles plus rapides, des rapports produits plus vite, moins d'erreurs de saisie.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA appliquée à la fonction finance",
      steps: [
        {
          titre:
            "Le partage des rôles : les chiffres restent dans vos systèmes, l'IA travaille autour",
        },
        { titre: "La méthode AXION appliquée aux écrits et analyses financiers" },
        { titre: "Analyser et synthétiser un document financier long : démonstration et pratique" },
      ],
    },
    {
      titreFr: "Module 2 — Rapprochements et contrôles assistés",
      steps: [
        { titre: "Automatiser des rapprochements simples : périmètre, méthode, garde-fous" },
        { titre: "Contrôles et vérifications assistés : détecter l'anomalie plus vite" },
        { titre: "La règle d'or : tout chiffre produit est vérifié par un humain avant diffusion" },
      ],
    },
    {
      titreFr: "Module 3 — Rapports et tableaux de bord",
      steps: [
        {
          titre:
            "Rédiger l'analyse autour de vos indicateurs : commentaires de gestion, notes de synthèse",
        },
        { titre: "Adapter le niveau de lecture : direction, opérationnels, partenaires" },
        { titre: "Atelier : chaque participant produit l'analyse de son dernier reporting" },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité et ancrage",
      steps: [
        {
          titre: "Confidentialité des données financières : ce qui ne sort jamais de l'entreprise",
        },
        {
          titre:
            "Feuille de route : les usages à installer dans la fonction dès la semaine suivante",
        },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Bibliothèque de prompts finance + trames d'analyses et de rapports",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA va-t-elle manipuler nos chiffres ?",
      reponse:
        "Non : les chiffres restent dans vos systèmes (ERP, comptabilité, tableur). L'IA travaille sur tout ce qui les entoure — analyses, synthèses, commentaires, contrôles — et tout chiffre produit est vérifié par un humain avant diffusion.",
    },
    {
      question: "Comment est traitée la confidentialité des données financières ?",
      reponse:
        "C'est un fil rouge de la journée : données financières sensibles et informations nominatives ne sont jamais soumises à l'IA. On travaille sur des données factices ou anonymisées pendant les ateliers.",
    },
    {
      question: "Est-ce adapté à un service comptable de PME ?",
      reponse:
        "Oui : la journée s'adresse aussi bien aux services comptables et financiers internes de PME qu'aux équipes de contrôle de gestion — les ateliers portent sur vos documents et rapports réels.",
    },
  ],
};

const IA_POUR_LE_JURIDIQUE: FormationV2 = {
  id: "ia-pour-le-juridique",
  slugFr: "ia-pour-le-juridique",
  slugEn: "ai-for-legal",
  numero: 9,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Juridique",
  duree: "1j",
  titreFr: "IA pour le juridique",
  accrocheFr:
    "Traitez vos dossiers plus vite, sans rien laisser passer — sécuriser et accélérer le traitement des dossiers",
  h1Fr: "Formation IA pour le juridique : sécuriser et accélérer le traitement des dossiers",
  metaTitleFr: "Formation IA pour le juridique — 1 jour",
  metaDescriptionFr:
    "Formation IA juridique (1 jour, intra) : synthèse de contrats, repérage de clauses à risque, documents types, veille réglementaire. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA juridique",
    "analyse contrat IA",
    "clauses à risque IA",
    "IA juriste entreprise",
    "veille réglementaire IA",
    "synthèse contrat IA",
  ],
  publicViseFr:
    "Juristes, responsables administratifs et dirigeants qui gèrent le juridique. Relire un contrat, repérer une clause à risque, rédiger un courrier type : autant de tâches précises et chronophages — cette journée montre comment l'IA fait gagner du temps tout en renforçant la vigilance sur les points sensibles.",
  casUsageFr: [
    { texteFr: "L'analyse et la synthèse de contrats" },
    { texteFr: "Le repérage de clauses à risque" },
    { texteFr: "La rédaction de courriers et de documents types" },
    { texteFr: "Une veille réglementaire assistée (sans remplacer le conseil juridique)" },
  ],
  objectifsFr: [
    "Synthétiser un contrat à l'aide de l'IA",
    "Repérer des clauses à risque pour préparer sa relecture",
    "Rédiger courriers et documents types",
    "Mener une veille réglementaire assistée",
    "Appliquer les règles de confidentialité (sans substituer le conseil juridique)",
  ],
  beneficeDirigeantFr:
    "Des dossiers traités plus vite et des points de vigilance repérés plus tôt — la rigueur juridique reste humaine, mais elle est mieux outillée.",
  equationTempsFr:
    "1 journée → la synthèse d'un contrat de plusieurs pages obtenue en quelques minutes pour préparer sa relecture.",
  avantApresFr: {
    avant: "Une relecture et une rédaction chronophages, des risques parfois mal identifiés.",
    apres: "Des dossiers traités plus vite, des points de vigilance repérés plus tôt.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA appliquée au travail juridique",
      steps: [
        { titre: "Ce que l'IA sait faire sur un texte juridique — et où elle s'arrête" },
        {
          titre:
            "La règle du métier : l'IA prépare la relecture, elle ne remplace ni le juriste ni le conseil",
        },
        { titre: "La méthode AXION appliquée aux demandes juridiques" },
      ],
    },
    {
      titreFr: "Module 2 — Analyser et synthétiser des contrats",
      steps: [
        { titre: "Synthétiser un contrat de plusieurs pages pour préparer sa relecture" },
        {
          titre:
            "Repérer les clauses à risque : responsabilité, résiliation, pénalités, exclusivité",
        },
        { titre: "Comparer des versions et poser des questions ciblées à un document" },
        { titre: "Atelier : chaque participant analyse un contrat réel (anonymisé)" },
      ],
    },
    {
      titreFr: "Module 3 — Documents types et veille réglementaire",
      steps: [
        { titre: "Rédiger courriers et documents types du quotidien juridique" },
        {
          titre: "Veille réglementaire assistée : dégrossir vite, vérifier aux sources officielles",
        },
        { titre: "Atelier : production d'un document type réutilisable" },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité et limites",
      steps: [
        {
          titre:
            "Confidentialité absolue : dossiers clients et données nominatives ne sortent jamais",
        },
        {
          titre:
            "Les limites à connaître : hallucinations juridiques, références inventées, périmètre du conseil",
        },
        { titre: "Feuille de route : les usages à installer dès la semaine suivante" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Bibliothèque de prompts juridiques + trames de synthèse et de documents types",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA peut-elle donner un avis juridique fiable ?",
      reponse:
        "Non, et la formation le pose clairement : l'IA prépare le travail (synthèses, repérage de clauses, premiers jets), mais l'analyse juridique et le conseil restent humains. On apprend aussi à repérer ses erreurs typiques — références inventées, approximations.",
    },
    {
      question: "Peut-on soumettre nos contrats réels à l'IA ?",
      reponse:
        "Les ateliers se font sur des documents anonymisés ou factices. La journée consacre un module entier à la confidentialité : ce qui peut être soumis, ce qui ne le peut jamais, et comment anonymiser efficacement.",
    },
    {
      question: "Est-ce utile sans juriste dédié dans l'entreprise ?",
      reponse:
        "Oui : la formation s'adresse aussi aux responsables administratifs et aux dirigeants qui gèrent le juridique au quotidien — elle aide à traiter plus vite les dossiers courants et à mieux repérer quand consulter un avocat.",
    },
  ],
};

const IA_POUR_LA_PRODUCTION: FormationV2 = {
  id: "ia-pour-la-production",
  slugFr: "ia-pour-la-production",
  slugEn: "ai-for-operations",
  numero: 10,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Production / Opérations",
  duree: "2j",
  scindable: true,
  titreFr: "IA pour la production",
  accrocheFr:
    "Un suivi de production plus fiable, moins de paperasse — optimiser l'ensemble des opérations",
  h1Fr: "Formation IA pour la production : optimiser l'ensemble des opérations (2 jours)",
  metaTitleFr: "Formation IA pour la production — 2 jours",
  metaDescriptionFr:
    "Formation IA production, 2 jours scindables : suivi et reporting, planification, documentation qualité, automatisations de suivi. 3 600 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA production",
    "IA opérations",
    "reporting production IA",
    "documentation qualité IA",
    "planification IA",
    "automatisation suivi production",
  ],
  publicViseFr:
    "Responsables de production, chefs d'atelier, agents de maîtrise. Le reporting, la planification et la documentation qualité prennent un temps précieux sur le terrain : ces deux jours mettent l'IA au service de vos opérations, jusqu'aux premiers cas d'automatisation.",
  prerequisFr:
    "Aucun prérequis technique poussé. Une pratique régulière des outils bureautiques suffit.",
  casUsageFr: [
    { texteFr: "Le suivi et le reporting de production assistés par l'IA" },
    { texteFr: "L'aide à la planification" },
    { texteFr: "La documentation qualité et des procédures facilitée" },
    { texteFr: "Les premiers cas d'automatisation sur des tâches de suivi ou de contrôle" },
  ],
  objectifsFr: [
    "Produire suivi et reporting de production à l'aide de l'IA",
    "Utiliser l'IA en appui à la planification",
    "Rédiger documentation qualité et procédures",
    "Identifier et prototyper une première automatisation de suivi",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Un suivi plus fiable, une documentation tenue à jour plus facilement et des décisions plus rapides — le terrain récupère le temps que prenait la paperasse.",
  equationTempsFr:
    "2 jours → un compte-rendu de production mis en forme en quelques minutes à partir de quelques notes.",
  avantApresFr: {
    avant: "Un reporting manuel, des procédures rarement à jour.",
    apres:
      "Un suivi plus fiable, une documentation tenue à jour plus facilement, des décisions plus rapides.",
  },
  materielFr:
    "Ordinateur portable, connexion internet, accès aux outils IA et aux données de production concernées",
  programme: [
    {
      titreFr: "Jour 1 — Suivi, reporting et documentation",
      steps: [
        { titre: "Ce que l'IA change pour les opérations : usages qui marchent en production" },
        { titre: "La méthode AXION appliquée aux écrits de production" },
        { titre: "Comptes-rendus et reporting de production : de vos notes au document propre" },
        {
          titre: "L'IA en appui à la planification : préparer, simuler des scénarios, communiquer",
        },
        {
          titre:
            "Documentation qualité et procédures : formaliser ce qui se fait déjà sans être écrit",
        },
        { titre: "Atelier : chaque participant produit un reporting ou une procédure réelle" },
        {
          temps: "Livrable",
          titre: "Trames de comptes-rendus, de reporting et de procédures qualité",
        },
      ],
    },
    {
      titreFr: "Jour 2 — Automatiser le suivi et ancrer les usages",
      steps: [
        { titre: "Identifier les tâches de suivi et de contrôle automatisables" },
        { titre: "Concevoir et prototyper une première automatisation de suivi, pas à pas" },
        {
          titre:
            "Tester et fiabiliser : les contrôles qui rendent l'automatisation digne de confiance",
        },
        {
          titre:
            "Confidentialité : données de production et clients ne sortent jamais de l'entreprise",
        },
        {
          titre: "Feuille de route : les usages et automatisations à installer, priorisés ensemble",
        },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Un prototype d'automatisation de suivi + bibliothèque de prompts production",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Pourquoi 2 jours pour la production ?",
      reponse:
        "Le jour 1 couvre les écrits du métier (reporting, planification, documentation qualité) ; le jour 2 va jusqu'aux premiers cas d'automatisation de suivi, construits et testés en séance. La formation est scindable en 2×1 jour.",
    },
    {
      question:
        "Nos équipes terrain ne sont pas des habituées des outils numériques — est-ce un problème ?",
      reponse:
        "Non : aucun prérequis technique poussé. Chaque notion est démontrée puis pratiquée immédiatement sur les tâches réelles des participants, avec un accompagnement pas à pas.",
    },
    {
      question: "L'IA va-t-elle piloter notre production ?",
      reponse:
        "Non : vos systèmes de production restent maîtres des données et des décisions. L'IA travaille sur ce qui les entoure — comptes-rendus, documentation, analyses, suivi — là où partent des heures chaque semaine.",
    },
  ],
};

const IA_POUR_LES_ACHATS: FormationV2 = {
  id: "ia-pour-les-achats",
  slugFr: "ia-pour-les-achats",
  slugEn: "ai-for-procurement",
  numero: 11,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Achats / Logistique",
  duree: "1j",
  titreFr: "IA pour les achats",
  accrocheFr: "Décidez plus vite, achetez mieux — optimiser achats et logistique au quotidien",
  h1Fr: "Formation IA pour les achats : optimiser achats et logistique au quotidien",
  metaTitleFr: "Formation IA pour les achats — 1 jour",
  metaDescriptionFr:
    "Formation IA achats et logistique (1 jour, intra) : analyse de devis, cahiers des charges, suivi de commandes, anticipation des ruptures. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA achats",
    "IA logistique",
    "analyse devis IA",
    "cahier des charges IA",
    "comparatif fournisseurs IA",
    "suivi commandes IA",
  ],
  publicViseFr:
    "Acheteurs, responsables logistique et approvisionnement. Comparer des devis, rédiger un cahier des charges, suivre les commandes : le quotidien des achats est fait de tâches précises et répétitives — cette journée montre comment l'IA les accélère pour vous laisser le temps de la négociation.",
  casUsageFr: [
    { texteFr: "L'analyse de devis et les comparatifs fournisseurs" },
    { texteFr: "La rédaction de cahiers des charges" },
    { texteFr: "Le suivi des commandes et les relances" },
    { texteFr: "L'anticipation des ruptures assistée par l'IA" },
  ],
  objectifsFr: [
    "Analyser devis et comparatifs fournisseurs à l'aide de l'IA",
    "Rédiger un cahier des charges",
    "Produire suivi de commandes et relances",
    "Anticiper les ruptures avec l'appui de l'IA",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Des décisions d'achat plus rapides et un meilleur suivi des commandes en cours — l'équipe garde son énergie pour la négociation.",
  equationTempsFr:
    "1 journée → un comparatif de plusieurs devis résumé en quelques minutes pour éclairer la décision.",
  avantApresFr: {
    avant: "Des comparatifs longs à produire, un suivi dispersé.",
    apres: "Des décisions d'achat plus rapides, un meilleur suivi des commandes en cours.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA appliquée aux achats et à la logistique",
      steps: [
        { titre: "Ce que l'IA change pour les achats : les usages à plus fort gain" },
        {
          titre:
            "Le partage des rôles : les données restent dans vos systèmes, l'IA travaille autour",
        },
        { titre: "La méthode AXION appliquée aux écrits du service achats" },
      ],
    },
    {
      titreFr: "Module 2 — Devis, comparatifs et cahiers des charges",
      steps: [
        { titre: "Analyser et comparer plusieurs devis : synthèse décisionnelle en minutes" },
        { titre: "Rédiger un cahier des charges structuré à partir de vos besoins" },
        {
          titre:
            "Atelier : comparatif réel sur des devis apportés par les participants (anonymisés)",
        },
      ],
    },
    {
      titreFr: "Module 3 — Suivi des commandes, relances et anticipation",
      steps: [
        { titre: "Relances fournisseurs : trouver le ton juste selon la situation et la relation" },
        { titre: "Suivi des commandes en cours : synthèses et alertes rédigées plus vite" },
        {
          titre: "Anticiper les ruptures : dégrossir une veille fournisseurs et marchés avec l'IA",
        },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité et ancrage",
      steps: [
        { titre: "Ce qui ne sort jamais : tarifs négociés, contrats, données fournisseurs" },
        {
          titre:
            "Feuille de route : les usages à installer dans le service dès la semaine suivante",
        },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de prompts achats + trames de comparatifs, cahiers des charges et relances",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA va-t-elle calculer nos stocks ou nos prévisions ?",
      reponse:
        "Non : les chiffres restent dans vos systèmes (ERP, WMS, tableur). L'IA excelle sur tout ce qui entoure les flux — comparatifs, cahiers des charges, relances, synthèses — là où part une grande partie du temps du service.",
    },
    {
      question: "Comment garantir la confidentialité des données fournisseurs ?",
      reponse:
        "Tarifs négociés, contrats et données fournisseurs nominatives ne sont jamais soumis à l'IA : les ateliers utilisent des documents anonymisés, et la règle est posée dès le premier module.",
    },
    {
      question: "Est-ce adapté à une petite équipe achats de PME ?",
      reponse:
        "Oui : la journée est conçue pour des équipes de toutes tailles, y compris quand une même personne cumule achats et logistique — les ateliers portent sur vos cas réels.",
    },
  ],
};

const IA_POUR_LA_RELATION_CLIENT: FormationV2 = {
  id: "ia-pour-la-relation-client",
  slugFr: "ia-pour-la-relation-client",
  slugEn: "ai-for-customer-service",
  numero: 12,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "Support / Relation client",
  duree: "1j",
  titreFr: "IA pour la relation client",
  accrocheFr:
    "Répondez plus vite, sans jamais baisser en qualité — gagner en réactivité et en qualité",
  h1Fr: "Formation IA pour la relation client : gagner en réactivité et en qualité",
  metaTitleFr: "Formation IA relation client — 1 jour",
  metaDescriptionFr:
    "Formation IA relation client, 1 jour : réponses personnalisées, réclamations, synthèse des échanges, base de connaissances. 1 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA relation client",
    "IA service client",
    "réponse réclamation IA",
    "IA support client",
    "base de connaissances IA",
    "SAV IA",
  ],
  publicViseFr:
    "Conseillers clientèle, responsables support, SAV. Chaque minute compte dans la relation client, et la qualité ne doit jamais en pâtir : cette journée outille vos équipes pour répondre plus vite, plus juste, et de façon homogène quel que soit le conseiller.",
  casUsageFr: [
    { texteFr: "Des réponses types et personnalisées assistées par l'IA" },
    { texteFr: "Un traitement des réclamations facilité" },
    { texteFr: "La synthèse rapide des échanges clients" },
    { texteFr: "Une base de connaissances interne alimentée par l'IA" },
  ],
  objectifsFr: [
    "Rédiger des réponses types et personnalisées à l'aide de l'IA",
    "Traiter une réclamation avec l'appui de l'IA",
    "Synthétiser des échanges clients",
    "Contribuer à une base de connaissances interne",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Des réponses plus rapides et plus homogènes, une satisfaction client mieux suivie — la qualité ne dépend plus de la personne qui répond.",
  equationTempsFr:
    "1 journée → une réponse claire à une réclamation client préparée en quelques minutes, prête à être personnalisée.",
  avantApresFr: {
    avant: "Des délais de réponse longs, une qualité variable selon les personnes.",
    apres: "Des réponses plus rapides et plus homogènes, une satisfaction client mieux suivie.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA au service de la relation client",
      steps: [
        { titre: "Ce que l'IA change pour le support : réactivité, homogénéité, traçabilité" },
        {
          titre:
            "La méthode AXION appliquée aux réponses clients : ton, contexte, personnalisation",
        },
        {
          titre: "Démonstration : d'une demande client réelle à une réponse prête à personnaliser",
        },
      ],
    },
    {
      titreFr: "Module 2 — Réponses types et réclamations",
      steps: [
        { titre: "Construire des réponses types qui ne sonnent pas « robot »" },
        { titre: "Traiter une réclamation : structure, ton juste, désescalade" },
        { titre: "Atelier : chaque participant traite des demandes réelles (anonymisées)" },
      ],
    },
    {
      titreFr: "Module 3 — Synthèses et base de connaissances",
      steps: [
        { titre: "Synthétiser un historique d'échanges pour reprendre un dossier en minutes" },
        { titre: "Alimenter une base de connaissances interne à partir des réponses qui marchent" },
        { titre: "Atelier : constitution des premières fiches de la base de connaissances" },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité et ancrage",
      steps: [
        { titre: "Données clients : ce qu'on ne soumet jamais à l'IA, comment anonymiser" },
        {
          titre: "Vérifier avant d'envoyer : la personnalisation et la relecture restent humaines",
        },
        {
          titre: "Feuille de route : les usages à installer dans l'équipe dès la semaine suivante",
        },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de réponses types + trames de réclamations + premières fiches de base de connaissances",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Les clients vont-ils recevoir des réponses « robot » ?",
      reponse:
        "Non : l'IA prépare une réponse structurée et documentée, que le conseiller personnalise et valide avant envoi. L'objectif est l'homogénéité et la rapidité — le ton humain reste, et la relecture est systématique.",
    },
    {
      question: "Comment sont protégées les données clients ?",
      reponse:
        "Les données clients nominatives ne sont jamais soumises à l'IA : la journée enseigne les réflexes d'anonymisation et les règles de confidentialité, appliqués dans tous les ateliers.",
    },
    {
      question: "Est-ce compatible avec notre outil de ticketing ?",
      reponse:
        "La formation est indépendante de l'outil : les méthodes s'appliquent quel que soit votre système (e-mail, ticketing, CRM). Les ateliers travaillent sur vos types de demandes réels.",
    },
  ],
};

const IA_POUR_L_IT: FormationV2 = {
  id: "ia-pour-l-it",
  slugFr: "ia-pour-l-it",
  slugEn: "ai-for-it",
  numero: 13,
  gamme: "ia-standard",
  categorie: "metier",
  axeLabelFr: "IT / Développement",
  duree: "2j",
  scindable: true,
  titreFr: "IA pour l'IT",
  accrocheFr: "Livrez plus vite, documentez enfin sans y penser — accélérer l'ensemble des projets",
  h1Fr: "Formation IA pour l'IT : accélérer l'ensemble des projets (2 jours)",
  metaTitleFr: "Formation IA pour l'IT — 2 jours",
  metaDescriptionFr:
    "Formation IA pour l'IT, 2 jours scindables : assistance au code, documentation, débogage, spécifications, automatisation de tâches IT. 3 600 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA développeurs",
    "IA assistance code",
    "documentation technique IA",
    "débogage IA",
    "IA DSI",
    "automatisation tâches IT",
  ],
  publicViseFr:
    "Développeurs, administrateurs systèmes, responsables IT. La dette technique et la documentation en retard pèsent sur chaque équipe IT : ces deux jours montrent comment l'IA accélère le développement et allège les tâches récurrentes, sans remplacer l'expertise de vos équipes.",
  prerequisFr:
    "Aisance en développement ou en administration système utile. Les exercices s'adaptent au niveau et à l'environnement technique des participants.",
  casUsageFr: [
    { texteFr: "L'assistance au code et à la documentation technique" },
    { texteFr: "Le débogage assisté par l'IA" },
    { texteFr: "La rédaction de spécifications facilitée" },
    { texteFr: "Les premiers cas d'automatisation de tâches IT récurrentes" },
  ],
  objectifsFr: [
    "Utiliser l'IA en assistance au code et à la documentation technique",
    "Déboguer avec l'appui de l'IA",
    "Rédiger des spécifications assistées",
    "Identifier et prototyper une automatisation de tâche IT récurrente",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Un développement plus rapide et une documentation tenue à jour plus facilement — l'équipe IT livre plus sans s'épuiser sur les tâches récurrentes.",
  equationTempsFr:
    "2 jours → la documentation d'une fonction rédigée en quelques minutes plutôt que repoussée à plus tard.",
  avantApresFr: {
    avant: "Une dette technique et une documentation qui prennent du retard.",
    apres: "Un développement plus rapide, une documentation tenue à jour plus facilement.",
  },
  materielFr:
    "Ordinateur portable, connexion internet, accès aux outils IA, environnement de développement habituel",
  programme: [
    {
      titreFr: "Jour 1 — Code, documentation et débogage assistés",
      steps: [
        { titre: "Panorama des usages IA en développement : ce qui fait vraiment gagner du temps" },
        { titre: "Assistance au code : générer, refactorer, expliquer — avec les bons garde-fous" },
        { titre: "Documentation technique : documenter au fil de l'eau plutôt que jamais" },
        { titre: "Débogage assisté : analyser une erreur, formuler des hypothèses, tester" },
        { titre: "Atelier : chaque participant applique sur son code et ses projets réels" },
        {
          temps: "Livrable",
          titre: "Recueil de prompts IT (code, doc, debug) calibrés sur votre stack",
        },
      ],
    },
    {
      titreFr: "Jour 2 — Spécifications, automatisation et sécurité",
      steps: [
        { titre: "Rédiger des spécifications assistées : du besoin métier au document structuré" },
        {
          titre: "Identifier les tâches IT récurrentes automatisables : scripts, revues, rapports",
        },
        { titre: "Prototyper une automatisation de tâche récurrente, pas à pas" },
        {
          titre: "Confidentialité et sécurité : code propriétaire, secrets, données de production",
        },
        { titre: "Feuille de route de l'équipe : usages et automatisations priorisés ensemble" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Un prototype d'automatisation + trames de spécifications réutilisables",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Quel niveau technique faut-il ?",
      reponse:
        "Une aisance en développement ou en administration système est utile : les exercices s'adaptent au niveau et à la stack des participants. Un profil IT généraliste (responsable IT, admin) y trouve autant que des développeurs.",
    },
    {
      question: "Notre code propriétaire est-il en sécurité ?",
      reponse:
        "La sécurité est traitée en profondeur au jour 2 : ce qui peut être soumis à l'IA, ce qui ne le peut jamais (secrets, données de production, code sensible), et comment configurer les outils en conséquence.",
    },
    {
      question: "Peut-on scinder les 2 jours ?",
      reponse:
        "Oui, la formation est scindable en 2 sessions d'une journée — utile pour tester les pratiques du jour 1 avant d'aborder l'automatisation au jour 2.",
    },
  ],
};

// ============================================================================
// OFFRES PAR SECTEUR D'ACTIVITÉ (8)
// ============================================================================

const IA_POUR_LA_SANTE: FormationV2 = {
  id: "ia-pour-la-sante",
  slugFr: "ia-pour-la-sante",
  slugEn: "ai-for-healthcare",
  numero: 14,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Santé",
  duree: "1j",
  titreFr: "IA pour la santé",
  accrocheFr:
    "Rendez du temps aux soignants en allégeant l'administratif — gagner en efficacité sur l'ensemble de l'activité",
  h1Fr: "Formation IA pour la santé : gagner en efficacité sur l'ensemble de l'activité",
  metaTitleFr: "Formation IA pour la santé — 1 jour",
  metaDescriptionFr:
    "Formation IA santé, 1 jour : comptes-rendus, courriers, gestion administrative et confidentialité stricte des données de santé. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA santé",
    "IA établissement de santé",
    "compte-rendu médical IA",
    "IA administratif santé",
    "confidentialité données de santé",
    "formation IA cabinet clinique EHPAD",
  ],
  publicViseFr:
    "Personnel administratif et soignant non-médical, direction d'établissement — cabinet, clinique, EHPAD, structure médico-sociale. Comptes-rendus, courriers, gestion des rendez-vous : la charge administrative empiète sur le temps de soin ; cette journée montre comment l'IA soulage ces tâches, dans le respect strict de la confidentialité des données de santé.",
  casUsageFr: [
    { texteFr: "L'aide à la rédaction de comptes-rendus et de courriers" },
    { texteFr: "La gestion administrative et la prise de rendez-vous assistées" },
    { texteFr: "La synthèse rapide de documents" },
    { texteFr: "Les bons réflexes de confidentialité des données de santé" },
  ],
  objectifsFr: [
    "Rédiger comptes-rendus et courriers à l'aide de l'IA",
    "Utiliser l'IA en appui à la gestion administrative et aux rendez-vous",
    "Synthétiser des documents",
    "Appliquer strictement les règles de confidentialité des données de santé",
    "Vérifier une production avant diffusion",
  ],
  beneficeDirigeantFr:
    "Un temps administratif réduit et plus de disponibilité pour le cœur de métier — sans jamais compromettre la confidentialité des données de santé.",
  equationTempsFr:
    "1 journée → un compte-rendu mis en forme en quelques minutes à partir de notes dictées.",
  avantApresFr: {
    avant: "Une charge administrative qui empiète sur le temps de soin.",
    apres: "Un temps administratif réduit, plus de disponibilité pour le cœur de métier.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA dans un établissement de santé : cadre et possibilités",
      steps: [
        { titre: "Ce que l'IA peut alléger dans l'activité — et ce qu'elle ne touche jamais" },
        { titre: "La règle absolue posée d'emblée : aucune donnée de santé nominative ne sort" },
        { titre: "La méthode AXION appliquée aux écrits de l'établissement" },
      ],
    },
    {
      titreFr: "Module 2 — Comptes-rendus et courriers",
      steps: [
        { titre: "De notes dictées ou manuscrites à un compte-rendu propre, en minutes" },
        { titre: "Courriers types : confrères, familles, administrations, fournisseurs" },
        { titre: "Atelier : chaque participant produit un document réel (données factices)" },
      ],
    },
    {
      titreFr: "Module 3 — Gestion administrative et synthèses",
      steps: [
        { titre: "Appui à la gestion administrative : plannings, rendez-vous, suivis" },
        { titre: "Synthétiser un document long : protocole, rapport, réglementation" },
        { titre: "Atelier : synthèse d'un document apporté par les participants" },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité stricte et ancrage",
      steps: [
        { titre: "Données de santé : le cadre (secret médical, RGPD santé) appliqué à l'IA" },
        { titre: "Anonymiser et travailler sur données factices : la pratique systématique" },
        { titre: "Vérifier une production avant diffusion : la relecture humaine obligatoire" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de prompts santé + trames de comptes-rendus et de courriers + mémo confidentialité",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Peut-on utiliser l'IA avec des données de patients ?",
      reponse:
        "Non, et c'est la règle absolue de la journée : aucune donnée de santé nominative n'est soumise à l'IA. On travaille sur données factices ou strictement anonymisées, et les réflexes d'anonymisation sont pratiqués dans chaque atelier.",
    },
    {
      question: "À qui s'adresse la formation dans un établissement de santé ?",
      reponse:
        "Au personnel administratif, au personnel soignant non-médical et à la direction — toutes les personnes dont la charge administrative empiète sur le temps consacré aux patients et aux résidents.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans votre établissement ou à distance, avec le même contenu et les mêmes ateliers.",
    },
  ],
};

const IA_POUR_LE_BTP: FormationV2 = {
  id: "ia-pour-le-btp",
  slugFr: "ia-pour-le-btp",
  slugEn: "ai-for-construction",
  numero: 15,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "BTP / Construction",
  duree: "1j",
  titreFr: "IA pour le BTP",
  accrocheFr:
    "Devis, chantiers, comptes-rendus : reprenez la main sur l'administratif — optimiser l'ensemble de son activité",
  h1Fr: "Formation IA pour le BTP : optimiser l'ensemble de son activité",
  metaTitleFr: "Formation IA pour le BTP — 1 jour",
  metaDescriptionFr:
    "Formation IA BTP (1 jour, intra) : devis, comptes-rendus de chantier, suivi de planning, réponses aux appels d'offres. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA BTP",
    "IA construction",
    "devis BTP IA",
    "compte-rendu chantier IA",
    "appel d'offres IA",
    "IA conducteur de travaux",
  ],
  publicViseFr:
    "Conducteurs de travaux, chargés d'affaires, personnel administratif des entreprises du BTP. Sur un chantier, chaque heure passée sur la paperasse est une heure de perdue : cette journée montre comment l'IA accélère les devis, les comptes-rendus et le suivi, pour vous garder sur le terrain.",
  casUsageFr: [
    { texteFr: "La rédaction de devis et de comptes-rendus de chantier" },
    { texteFr: "Le suivi de planning facilité" },
    { texteFr: "L'aide à la réponse aux appels d'offres" },
    { texteFr: "La synthèse de documents techniques" },
  ],
  objectifsFr: [
    "Rédiger devis et comptes-rendus de chantier à l'aide de l'IA",
    "Utiliser l'IA en appui au suivi de planning",
    "Préparer une réponse à un appel d'offres",
    "Synthétiser des documents techniques",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Des documents produits plus vite et un meilleur suivi administratif des chantiers — les équipes restent sur le terrain, pas derrière un clavier.",
  equationTempsFr:
    "1 journée → un compte-rendu de chantier rédigé en quelques minutes depuis quelques notes prises sur place.",
  avantApresFr: {
    avant: "Des devis et comptes-rendus chronophages, un suivi de chantier dispersé.",
    apres: "Des documents produits plus vite, un meilleur suivi administratif des chantiers.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA sur le chantier et au bureau",
      steps: [
        { titre: "Ce que l'IA change pour une entreprise du BTP : les usages à plus fort gain" },
        { titre: "La méthode AXION appliquée aux écrits du bâtiment" },
        { titre: "Démonstration : de notes de chantier à un compte-rendu diffusable" },
      ],
    },
    {
      titreFr: "Module 2 — Devis et comptes-rendus de chantier",
      steps: [
        { titre: "Structurer et rédiger un devis plus vite à partir de vos métrés et descriptifs" },
        { titre: "Comptes-rendus de chantier et de réunion : dictée, notes, photos commentées" },
        { titre: "Atelier : chaque participant produit un document réel de son chantier en cours" },
      ],
    },
    {
      titreFr: "Module 3 — Appels d'offres, planning et documents techniques",
      steps: [
        {
          titre: "Préparer une réponse à un appel d'offres : mémoire technique dégrossi avec l'IA",
        },
        { titre: "Suivi de planning : synthèses d'avancement et communications aux intervenants" },
        { titre: "Synthétiser un document technique long : CCTP, notices, réglementations" },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité et ancrage",
      steps: [
        {
          titre: "Ce qui ne sort pas : prix de revient, marges, données clients et sous-traitants",
        },
        { titre: "Feuille de route : les usages à installer dès la semaine suivante" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de prompts BTP + trames de devis, comptes-rendus et mémoires techniques",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Est-ce adapté à une petite entreprise du bâtiment ?",
      reponse:
        "Oui : la journée est conçue pour les entreprises de toutes tailles — de l'artisan avec un conducteur de travaux aux PME du BTP. Les ateliers portent sur vos chantiers et documents réels.",
    },
    {
      question: "Peut-on vraiment gagner du temps sur les appels d'offres ?",
      reponse:
        "Oui, notamment sur le mémoire technique : l'IA aide à structurer et dégrossir la rédaction à partir de vos références et méthodes. La relecture et la personnalisation restent humaines — c'est votre expertise qui gagne le marché.",
    },
    {
      question:
        "Nos équipes terrain ne sont pas à l'aise avec l'informatique — est-ce un problème ?",
      reponse:
        "Non : aucun prérequis, et les cas travaillés partent de ce qui existe déjà (notes, dictées, photos). Chaque notion est démontrée puis pratiquée avec un accompagnement pas à pas.",
    },
  ],
};

const IA_POUR_L_IMMOBILIER: FormationV2 = {
  id: "ia-pour-l-immobilier",
  slugFr: "ia-pour-l-immobilier",
  slugEn: "ai-for-real-estate",
  numero: 16,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Immobilier",
  duree: "1j",
  titreFr: "IA pour l'immobilier",
  accrocheFr:
    "Des annonces qui sortent plus vite, des prospects mieux suivis — gagner en efficacité sur l'ensemble de l'activité",
  h1Fr: "Formation IA pour l'immobilier : gagner en efficacité sur l'ensemble de l'activité",
  metaTitleFr: "Formation IA pour l'immobilier — 1 jour",
  metaDescriptionFr:
    "Formation IA immobilier, 1 jour : annonces et descriptifs de biens, estimations, réponses aux prospects, suivi des dossiers. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA immobilier",
    "annonce immobilière IA",
    "IA agence immobilière",
    "estimation bien IA",
    "suivi prospects immobilier",
    "IA gestion locative",
  ],
  publicViseFr:
    "Agents immobiliers, gestionnaires, personnel administratif des agences et cabinets. Rédiger une annonce, estimer un bien, relancer un prospect : le métier est fait de tâches répétitives qui s'accumulent — cette journée met l'IA au service de votre réactivité commerciale.",
  casUsageFr: [
    { texteFr: "La rédaction d'annonces et de descriptifs de biens" },
    { texteFr: "L'aide à l'estimation et aux comparatifs de marché" },
    { texteFr: "Des réponses aux prospects plus rapides" },
    { texteFr: "Le suivi des dossiers de vente ou de location" },
  ],
  objectifsFr: [
    "Rédiger annonces et descriptifs de biens à l'aide de l'IA",
    "Utiliser l'IA en appui à l'estimation et aux comparatifs de marché",
    "Rédiger des réponses aux prospects",
    "Produire un suivi de dossiers de vente ou location",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Des annonces produites plus vite et un meilleur suivi des prospects et des dossiers en cours — la réactivité commerciale devient un avantage concurrentiel.",
  equationTempsFr:
    "1 journée → une annonce complète et attractive rédigée en quelques minutes à partir des caractéristiques du bien.",
  avantApresFr: {
    avant: "Une rédaction d'annonces et un suivi de dossiers chronophages.",
    apres:
      "Des annonces produites plus vite, un meilleur suivi des prospects et des dossiers en cours.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA dans le métier immobilier",
      steps: [
        { titre: "Ce que l'IA change pour une agence : les usages à plus fort gain" },
        { titre: "La méthode AXION appliquée aux écrits de l'immobilier" },
        { titre: "Démonstration : des caractéristiques d'un bien à une annonce attractive" },
      ],
    },
    {
      titreFr: "Module 2 — Annonces et descriptifs de biens",
      steps: [
        {
          titre:
            "Rédiger des annonces complètes et différenciantes, dans le respect des règles du secteur",
        },
        { titre: "Décliner : portail, vitrine, réseaux sociaux, dossier de présentation" },
        {
          titre: "Atelier : chaque participant rédige l'annonce d'un bien réel de son portefeuille",
        },
      ],
    },
    {
      titreFr: "Module 3 — Estimations, prospects et suivi de dossiers",
      steps: [
        {
          titre: "Appui à l'estimation : structurer comparatifs de marché et argumentaires de prix",
        },
        {
          titre:
            "Répondre plus vite aux prospects : premiers contacts, relances, propositions de visite",
        },
        { titre: "Suivi des dossiers de vente et de location : synthèses et points d'étape" },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité et ancrage",
      steps: [
        { titre: "Données clients et mandats : ce qu'on ne soumet jamais à l'IA" },
        {
          titre: "Feuille de route : les usages à installer dans l'agence dès la semaine suivante",
        },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de prompts immobilier + trames d'annonces, de réponses prospects et de suivis",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA peut-elle estimer un bien à notre place ?",
      reponse:
        "Non : l'estimation reste votre expertise. L'IA vous aide à structurer les comparatifs de marché, à rédiger l'argumentaire de prix et le dossier d'estimation — le jugement professionnel reste le vôtre.",
    },
    {
      question: "Les annonces générées respectent-elles la réglementation ?",
      reponse:
        "La formation intègre les règles du secteur (mentions obligatoires, loi Alur, DPE) dans les trames travaillées. La relecture finale reste humaine, comme pour tout écrit produit avec l'IA.",
    },
    {
      question: "Est-ce adapté à la gestion locative et au syndic ?",
      reponse:
        "Oui : les méthodes s'appliquent aux courriers de gestion, aux états des lieux commentés, aux réponses aux locataires et copropriétaires — les ateliers s'adaptent aux activités des participants.",
    },
  ],
};

const IA_POUR_LE_COMMERCE: FormationV2 = {
  id: "ia-pour-le-commerce",
  slugFr: "ia-pour-le-commerce",
  slugEn: "ai-for-retail",
  numero: 17,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Commerce / Retail",
  duree: "1j",
  titreFr: "IA pour le commerce",
  accrocheFr:
    "Fiches produits, avis clients, ventes : gagnez sur tous les tableaux — optimiser l'ensemble de son activité",
  h1Fr: "Formation IA pour le commerce : optimiser l'ensemble de son activité",
  metaTitleFr: "Formation IA pour le commerce — 1 jour",
  metaDescriptionFr:
    "Formation IA commerce et retail, 1 jour : fiches produits, réponses aux avis clients, analyse des ventes, supports en point de vente. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA commerce",
    "IA retail",
    "fiche produit IA",
    "réponse avis clients IA",
    "IA e-commerce",
    "IA point de vente",
  ],
  publicViseFr:
    "Responsables de magasin, équipes vente et merchandising, commerce physique et e-commerce. Le commerce vit au rythme du contenu et de la relation client : cette journée montre comment l'IA accélère la production de fiches produits et le suivi des avis, pour vendre plus et mieux.",
  casUsageFr: [
    { texteFr: "La rédaction de fiches produits et de contenus e-commerce" },
    { texteFr: "Des réponses aux avis et messages clients facilitées" },
    { texteFr: "L'aide à l'analyse des ventes" },
    { texteFr: "Des supports de communication en point de vente" },
  ],
  objectifsFr: [
    "Rédiger fiches produits et contenus e-commerce à l'aide de l'IA",
    "Rédiger des réponses aux avis et messages clients",
    "Analyser des ventes avec l'appui de l'IA",
    "Produire des supports de communication en point de vente",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Une production de contenu accélérée et un meilleur suivi de la satisfaction client — les fiches sortent plus vite et les avis ne restent plus sans réponse.",
  equationTempsFr:
    "1 journée → une fiche produit complète rédigée en quelques minutes à partir de quelques caractéristiques.",
  avantApresFr: {
    avant: "Des fiches produits et contenus produits lentement, des avis traités au fil de l'eau.",
    apres: "Une production de contenu accélérée, un meilleur suivi de la satisfaction client.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA dans le commerce : panorama et méthode",
      steps: [
        { titre: "Ce que l'IA change pour un commerce : les usages à plus fort gain" },
        { titre: "La méthode AXION appliquée aux contenus commerciaux" },
        { titre: "Démonstration : de quelques caractéristiques à une fiche produit complète" },
      ],
    },
    {
      titreFr: "Module 2 — Fiches produits et contenus e-commerce",
      steps: [
        {
          titre:
            "Rédiger des fiches produits complètes, différenciantes et adaptées au référencement",
        },
        { titre: "Décliner : site, marketplace, réseaux sociaux, newsletter" },
        { titre: "Atelier : chaque participant rédige des fiches sur ses produits réels" },
      ],
    },
    {
      titreFr: "Module 3 — Avis clients, ventes et point de vente",
      steps: [
        { titre: "Répondre aux avis et messages clients : ton juste, rapidité, homogénéité" },
        { titre: "Analyser ses ventes avec l'appui de l'IA : synthèses et enseignements" },
        {
          titre: "Supports de communication en point de vente : affiches, promotions, signalétique",
        },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité et ancrage",
      steps: [
        { titre: "Données clients et chiffres d'affaires : ce qu'on ne soumet jamais à l'IA" },
        { titre: "Feuille de route : les usages à installer dès la semaine suivante" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de prompts commerce + trames de fiches produits et de réponses aux avis",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Est-ce adapté à un commerce physique sans e-commerce ?",
      reponse:
        "Oui : les ateliers s'adaptent — réponses aux avis Google, supports en point de vente, communication locale, analyse des ventes. Le e-commerce n'est qu'un des terrains d'application.",
    },
    {
      question: "Les fiches produits générées sont-elles bonnes pour le référencement ?",
      reponse:
        "La journée intègre les bonnes pratiques : structure, vocabulaire client, différenciation. L'IA accélère la production ; la relecture garantit la qualité et l'exactitude des caractéristiques.",
    },
    {
      question: "Combien de personnes du magasin peuvent participer ?",
      reponse:
        "Jusqu'à 15 participants par groupe, tous profils : responsables, vendeurs, merchandising. Le prix est par groupe, pas par personne.",
    },
  ],
};

const IA_POUR_L_HOTELLERIE_RESTAURATION: FormationV2 = {
  id: "ia-pour-l-hotellerie-restauration",
  slugFr: "ia-pour-l-hotellerie-restauration",
  slugEn: "ai-for-hospitality",
  numero: 18,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Hôtellerie-Restauration",
  duree: "1j",
  titreFr: "IA pour l'hôtellerie-restauration",
  accrocheFr:
    "Répondez à chaque client, sans y passer vos soirées — gagner en efficacité au quotidien",
  h1Fr: "Formation IA pour l'hôtellerie-restauration : gagner en efficacité au quotidien",
  metaTitleFr: "Formation IA hôtellerie-restauration — 1 jour",
  metaDescriptionFr:
    "Formation IA hôtellerie-restauration (1 jour, intra) : réponses aux avis, réservations, menus et supports, planification des équipes. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA hôtellerie",
    "IA restauration",
    "réponse avis clients hôtel",
    "IA réservations",
    "menus IA",
    "IA CHR",
  ],
  publicViseFr:
    "Direction d'établissement, personnel administratif et d'accueil — hôtels, restaurants, établissements CHR. Avis en ligne, réservations, communication : la relation client ne s'arrête jamais ; cette journée montre comment l'IA vous aide à répondre plus vite et mieux, tout en soignant votre image.",
  casUsageFr: [
    { texteFr: "Des réponses aux avis et messages de réservation facilitées" },
    { texteFr: "La rédaction de menus et de supports de communication" },
    { texteFr: "L'aide à la planification des équipes" },
    { texteFr: "Un suivi administratif courant allégé" },
  ],
  objectifsFr: [
    "Rédiger des réponses aux avis et messages de réservation à l'aide de l'IA",
    "Rédiger menus et supports de communication",
    "Utiliser l'IA en appui à la planification des équipes",
    "Produire un suivi administratif courant",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Des réponses plus rapides et mieux soignées, des supports produits plus facilement — l'image de l'établissement est soignée sans y passer les soirées.",
  equationTempsFr:
    "1 journée → une réponse soignée à un avis client rédigée en moins d'une minute, prête à personnaliser.",
  avantApresFr: {
    avant:
      "Une gestion des avis et réservations chronophage, une communication produite dans l'urgence.",
    apres: "Des réponses plus rapides et mieux soignées, des supports produits plus facilement.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA dans un établissement CHR",
      steps: [
        {
          titre: "Ce que l'IA change pour un hôtel ou un restaurant : les usages à plus fort gain",
        },
        { titre: "La méthode AXION appliquée à la relation client de l'établissement" },
        { titre: "Démonstration : d'un avis client à une réponse soignée en moins d'une minute" },
      ],
    },
    {
      titreFr: "Module 2 — Avis en ligne et réservations",
      steps: [
        { titre: "Répondre aux avis positifs et négatifs : ton juste, personnalisation, image" },
        { titre: "Messages de réservation : confirmations, demandes particulières, relances" },
        { titre: "Atelier : chaque participant répond à des avis réels de son établissement" },
      ],
    },
    {
      titreFr: "Module 3 — Menus, communication et planification",
      steps: [
        { titre: "Rédiger et traduire menus et cartes, décrire ses plats et prestations" },
        { titre: "Supports de communication : réseaux sociaux, newsletters, événements" },
        { titre: "Appui à la planification des équipes et au suivi administratif courant" },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité et ancrage",
      steps: [
        { titre: "Données clients : ce qu'on ne soumet jamais à l'IA" },
        { titre: "Feuille de route : les usages à installer dès la semaine suivante" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Bibliothèque de prompts CHR + trames de réponses aux avis et de supports",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Les réponses aux avis ne vont-elles pas sembler artificielles ?",
      reponse:
        "Non : on apprend à faire produire des réponses dans le ton de votre établissement, personnalisées par le détail de l'avis, puis relues avant publication. L'objectif est de répondre à chaque client — vite et bien.",
    },
    {
      question: "Est-ce utile pour un petit restaurant indépendant ?",
      reponse:
        "Oui : c'est même là que le gain est le plus net — le gérant récupère les heures passées le soir sur les avis, les messages et la communication. Le prix est par groupe, l'équipe entière peut participer.",
    },
    {
      question: "Peut-on traduire nos menus et messages pour la clientèle étrangère ?",
      reponse:
        "Oui, c'est un des ateliers du module menus et communication : traduction et adaptation de vos cartes et messages types, avec relecture finale humaine.",
    },
  ],
};

const IA_POUR_L_INDUSTRIE: FormationV2 = {
  id: "ia-pour-l-industrie",
  slugFr: "ia-pour-l-industrie",
  slugEn: "ai-for-industry",
  numero: 19,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Industrie",
  duree: "2j",
  scindable: true,
  titreFr: "IA pour l'industrie",
  accrocheFr:
    "Qualité, maintenance, production : un pilotage plus net — optimiser l'ensemble de la production",
  h1Fr: "Formation IA pour l'industrie : optimiser l'ensemble de la production (2 jours)",
  metaTitleFr: "Formation IA pour l'industrie — 2 jours",
  metaDescriptionFr:
    "Formation IA industrie, 2 jours scindables : suivi qualité, reporting, documentation de maintenance, automatisation du suivi. 3 900 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA industrie",
    "IA usine",
    "reporting qualité IA",
    "documentation maintenance IA",
    "IA production industrielle",
    "automatisation suivi industriel",
  ],
  publicViseFr:
    "Responsables de production, qualité et maintenance des sites industriels. Le reporting qualité et la documentation de maintenance mobilisent un temps considérable : ces deux jours mettent l'IA au service de votre production, jusqu'aux premiers cas d'automatisation du suivi.",
  prerequisFr:
    "Aucun prérequis technique poussé. Une pratique régulière des outils bureautiques suffit.",
  casUsageFr: [
    { texteFr: "Le suivi qualité et le reporting assistés par l'IA" },
    { texteFr: "L'aide à la documentation de maintenance" },
    { texteFr: "La synthèse des données de production" },
    { texteFr: "Les premiers cas d'automatisation sur des tâches de suivi" },
  ],
  objectifsFr: [
    "Produire suivi qualité et reporting à l'aide de l'IA",
    "Rédiger de la documentation de maintenance",
    "Synthétiser des données de production",
    "Identifier et prototyper une première automatisation de suivi",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Un suivi plus structuré et une documentation qualité et maintenance tenue à jour plus facilement — le pilotage gagne en netteté, les équipes en temps.",
  equationTempsFr:
    "2 jours → un rapport qualité mis en forme en quelques minutes à partir des données du jour.",
  avantApresFr: {
    avant: "Un reporting qualité et une maintenance chronophages, des données dispersées.",
    apres:
      "Un suivi plus structuré, une documentation qualité et maintenance tenue à jour plus facilement.",
  },
  materielFr:
    "Ordinateur portable, connexion internet, accès aux outils IA et aux données de production concernées",
  programme: [
    {
      titreFr: "Jour 1 — Qualité, maintenance et données de production",
      steps: [
        { titre: "Ce que l'IA change pour un site industriel : les usages à plus fort gain" },
        {
          titre:
            "Le partage des rôles : vos systèmes (GPAO, GMAO, MES) gardent les données, l'IA travaille autour",
        },
        { titre: "Suivi qualité et reporting : de vos indicateurs à l'analyse rédigée" },
        { titre: "Documentation de maintenance : gammes, procédures, retours d'intervention" },
        { titre: "Synthétiser des données de production pour la direction et le terrain" },
        { titre: "Atelier : chaque participant produit un rapport ou une procédure réelle" },
        {
          temps: "Livrable",
          titre:
            "Trames de rapports qualité, de gammes de maintenance et de synthèses de production",
        },
      ],
    },
    {
      titreFr: "Jour 2 — Automatiser le suivi et ancrer les usages",
      steps: [
        {
          titre:
            "Identifier les tâches de suivi automatisables : rapports récurrents, compilations, alertes",
        },
        { titre: "Concevoir et prototyper une première automatisation de suivi, pas à pas" },
        {
          titre:
            "Tester et fiabiliser : les contrôles qui rendent l'automatisation digne de confiance",
        },
        { titre: "Confidentialité : procédés, données de production et clients ne sortent jamais" },
        { titre: "Feuille de route du site : usages et automatisations priorisés ensemble" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Un prototype d'automatisation de suivi + bibliothèque de prompts industrie",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA va-t-elle piloter nos machines ou notre GPAO ?",
      reponse:
        "Non : vos systèmes industriels (GPAO, GMAO, MES, supervision) restent maîtres des données et du pilotage. L'IA travaille sur ce qui les entoure — rapports, documentation, synthèses, suivi — là où partent des heures chaque semaine.",
    },
    {
      question: "Pourquoi 2 jours et un tarif différent des autres secteurs ?",
      reponse:
        "L'industrie cumule trois chantiers documentaires lourds (qualité, maintenance, production) et va jusqu'à l'automatisation du suivi, construite et testée au jour 2. Le format 2 jours est scindable en 2×1 jour.",
    },
    {
      question: "Nos procédés industriels sont confidentiels — comment est-ce géré ?",
      reponse:
        "Les procédés, paramètres et données clients ne sont jamais soumis à l'IA : les ateliers travaillent sur des données factices ou anonymisées, et les règles de confidentialité sont posées dès le premier module.",
    },
  ],
};

const IA_POUR_LE_TRANSPORT_LOGISTIQUE: FormationV2 = {
  id: "ia-pour-le-transport-logistique",
  slugFr: "ia-pour-le-transport-logistique",
  slugEn: "ai-for-transport-logistics",
  numero: 20,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Transport / Logistique",
  duree: "1j",
  titreFr: "IA pour le transport et la logistique",
  accrocheFr:
    "Des tournées mieux préparées, des documents produits en un instant — optimiser l'ensemble de l'activité",
  h1Fr: "Formation IA pour le transport et la logistique : optimiser l'ensemble de l'activité",
  metaTitleFr: "Formation IA transport et logistique — 1 jour",
  metaDescriptionFr:
    "Formation IA transport et logistique, 1 jour : planification de tournées, reporting, documents de transport, communication clients. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA transport",
    "IA logistique",
    "planification tournées IA",
    "documents de transport IA",
    "IA exploitation transport",
    "reporting logistique IA",
  ],
  publicViseFr:
    "Exploitants, responsables logistique, personnel administratif des entreprises de transport et de logistique. Planification, suivi, documents de transport : le quotidien de l'exploitation est dense — cette journée montre comment l'IA fluidifie ces tâches pour gagner en réactivité.",
  casUsageFr: [
    { texteFr: "L'aide à la planification de tournées" },
    { texteFr: "Le suivi et le reporting d'activité" },
    { texteFr: "La rédaction de documents de transport" },
    { texteFr: "La communication avec clients et sous-traitants assistée par l'IA" },
  ],
  objectifsFr: [
    "Utiliser l'IA en appui à la planification de tournées",
    "Produire suivi et reporting d'activité",
    "Rédiger des documents de transport",
    "Rédiger la communication avec clients et sous-traitants",
    "Appliquer les règles de confidentialité",
  ],
  beneficeDirigeantFr:
    "Une planification facilitée et des documents produits plus rapidement — l'exploitation gagne en réactivité sur toute la chaîne.",
  equationTempsFr:
    "1 journée → un document de transport rempli en quelques minutes à partir des informations de la commande.",
  avantApresFr: {
    avant: "Une planification et un suivi manuels, des documents produits lentement.",
    apres: "Une planification facilitée, des documents et un reporting produits plus rapidement.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA dans l'exploitation transport",
      steps: [
        { titre: "Ce que l'IA change pour l'exploitation : les usages à plus fort gain" },
        {
          titre:
            "Le partage des rôles : le TMS et vos systèmes gardent les données, l'IA travaille autour",
        },
        { titre: "La méthode AXION appliquée aux écrits de l'exploitation" },
      ],
    },
    {
      titreFr: "Module 2 — Planification et suivi d'activité",
      steps: [
        { titre: "Appui à la planification de tournées : préparer, arbitrer, communiquer" },
        { titre: "Suivi et reporting d'activité : synthèses d'exploitation rédigées en minutes" },
        { titre: "Atelier : chaque participant produit un reporting réel de son activité" },
      ],
    },
    {
      titreFr: "Module 3 — Documents de transport et communication",
      steps: [
        {
          titre:
            "Documents de transport : produire plus vite à partir des informations de commande",
        },
        { titre: "Communication clients et sous-traitants : confirmations, litiges, relances" },
        { titre: "Atelier : traitement de cas réels apportés par les participants" },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité et ancrage",
      steps: [
        { titre: "Données clients, tarifs et tournées : ce qu'on ne soumet jamais à l'IA" },
        { titre: "Feuille de route : les usages à installer dès la semaine suivante" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre: "Bibliothèque de prompts transport + trames de reporting et de communication",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA va-t-elle optimiser nos tournées à la place du TMS ?",
      reponse:
        "Non : l'optimisation reste dans vos outils métiers. L'IA aide à préparer, arbitrer et communiquer autour de la planification — consignes, synthèses, réponses aux aléas — là où l'exploitation perd du temps chaque jour.",
    },
    {
      question: "Est-ce adapté à une PME de transport avec une petite équipe d'exploitation ?",
      reponse:
        "Oui : la journée est conçue pour des équipes de toutes tailles, et les ateliers portent sur vos documents et situations réels — litiges, relances, reporting, documents de transport.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux ou à distance, avec le même contenu et les mêmes ateliers pratiques.",
    },
  ],
};

const IA_POUR_LA_BANQUE_ASSURANCE: FormationV2 = {
  id: "ia-pour-la-banque-assurance",
  slugFr: "ia-pour-la-banque-assurance",
  slugEn: "ai-for-banking-insurance",
  numero: 21,
  gamme: "ia-standard",
  categorie: "secteur",
  axeLabelFr: "Banque / Assurance",
  duree: "1j",
  titreFr: "IA pour la banque et l'assurance",
  accrocheFr:
    "Traitez chaque dossier plus vite, répondez à chaque client plus tôt — sécuriser et accélérer le quotidien",
  h1Fr: "Formation IA pour la banque et l'assurance : sécuriser et accélérer le quotidien",
  metaTitleFr: "Formation IA banque et assurance — 1 jour",
  metaDescriptionFr:
    "Formation IA banque et assurance, 1 jour : synthèse de dossiers clients, courriers et propositions, confidentialité stricte des données. 2 200 € HT par groupe.",
  termesSemantiquesFr: [
    "formation IA banque",
    "IA assurance",
    "synthèse dossier client IA",
    "IA conseiller clientèle",
    "confidentialité données financières",
    "IA courtage",
  ],
  publicViseFr:
    "Conseillers clientèle, gestionnaires de contrats, personnel administratif — banques, assurances, mutuelles, courtiers. La gestion de dossiers et la relation client demandent rigueur et rapidité : cette journée montre comment l'IA accélère le traitement tout en respectant la confidentialité des données financières.",
  casUsageFr: [
    { texteFr: "La synthèse rapide de dossiers clients" },
    { texteFr: "L'aide à la rédaction de courriers et de propositions" },
    { texteFr: "Des réponses aux questions courantes facilitées" },
    { texteFr: "Les bons réflexes de confidentialité des données financières" },
  ],
  objectifsFr: [
    "Synthétiser un dossier client à l'aide de l'IA",
    "Rédiger courriers et propositions",
    "Rédiger des réponses aux questions courantes",
    "Appliquer strictement les règles de confidentialité des données financières",
    "Vérifier une production avant diffusion",
  ],
  beneficeDirigeantFr:
    "Des dossiers traités plus vite et des réponses aux clients plus réactives — la rigueur du secteur est préservée, la lenteur ne l'est pas.",
  equationTempsFr:
    "1 journée → la synthèse d'un dossier client obtenue en quelques minutes pour préparer un rendez-vous.",
  avantApresFr: {
    avant: "Un traitement de dossiers chronophage, des réponses parfois lentes.",
    apres: "Des dossiers traités plus vite, des réponses aux clients plus réactives.",
  },
  programme: [
    {
      titreFr: "Module 1 — L'IA en banque-assurance : cadre et possibilités",
      steps: [
        { titre: "Ce que l'IA peut accélérer dans le métier — et ce qu'elle ne touche jamais" },
        { titre: "La règle absolue posée d'emblée : aucune donnée client nominative ne sort" },
        { titre: "La méthode AXION appliquée aux écrits du secteur" },
      ],
    },
    {
      titreFr: "Module 2 — Synthèse de dossiers clients",
      steps: [
        { titre: "Synthétiser un dossier pour préparer un rendez-vous ou reprendre un historique" },
        { titre: "Poser des questions ciblées à un document : contrat, conditions, garanties" },
        { titre: "Atelier : synthèse d'un dossier type (données factices)" },
      ],
    },
    {
      titreFr: "Module 3 — Courriers, propositions et questions courantes",
      steps: [
        {
          titre:
            "Courriers et propositions : structure, ton, conformité au discours de l'établissement",
        },
        { titre: "Réponses aux questions courantes : rapides, homogènes, vérifiées" },
        { titre: "Atelier : chaque participant produit un courrier ou une réponse type réelle" },
      ],
    },
    {
      titreFr: "Module 4 — Confidentialité stricte et ancrage",
      steps: [
        {
          titre:
            "Données financières et bancaires : le cadre appliqué à l'IA (secret professionnel, RGPD)",
        },
        { titre: "Anonymiser et travailler sur données factices : la pratique systématique" },
        { titre: "Vérifier une production avant diffusion : la relecture humaine obligatoire" },
        { titre: "Quiz individuel de validation des acquis (10 questions)" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de prompts banque-assurance + trames de synthèses, courriers et réponses types",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Peut-on soumettre des dossiers clients réels à l'IA ?",
      reponse:
        "Non : aucune donnée client nominative n'est soumise à l'IA. La formation enseigne le travail sur données factices ou anonymisées et les réflexes du secteur — c'est la règle posée dès le premier module et appliquée dans tous les ateliers.",
    },
    {
      question: "Est-ce compatible avec nos obligations de conformité ?",
      reponse:
        "La journée est construite pour le cadre du secteur : secret professionnel, RGPD, validation humaine systématique avant diffusion. L'IA prépare le travail ; les décisions et le conseil restent humains et conformes à vos procédures.",
    },
    {
      question: "Est-ce adapté aux courtiers et petites structures ?",
      reponse:
        "Oui : conseillers, gestionnaires et courtiers y trouvent les mêmes gains — synthèses de dossiers, courriers, réponses types — avec des ateliers adaptés à la taille et aux outils de la structure.",
    },
  ],
};
const SEMINAIRE_IA_ENTREPRISE: FormationV2 = {
  id: "seminaire-ia-toute-l-entreprise-1j",
  slugFr: "seminaire-ia-toute-l-entreprise-1j",
  slugEn: "ai-seminar-whole-company-1d",
  numero: 22,
  gamme: "ia-standard",
  duree: "1j",
  surDevis: true,
  // Programme : « Jusqu'à 50 participants, en tables de 6 à 8 ».
  effectifFr: "Jusqu’à 50 participants, en tables de 6 à 8",
  // Le séminaire ne demande AUCUN matériel individuel : le formateur démontre,
  // et seul le téléphone personnel sert au sondage et aux QCM.
  materielFr:
    "Aucun matériel à prévoir : les démonstrations sont pilotées par le formateur. Chaque participant utilise son téléphone personnel pour le sondage en direct et les QCM",
  outilsFr:
    "Le séminaire est démonstratif : le formateur pilote ChatGPT, Claude et Gemini en direct. Les participants ne créent aucun compte — ils travaillent par table, sur leurs propres cas d’usage.",
  seminaire: true,
  titreFr: "Séminaire IA — Mettre toute l'entreprise au diapason",
  accrocheFr:
    "Une journée en présentiel pour cadrer les usages de l'IA et fédérer toutes vos équipes — jusqu'à 50 participants",
  h1Fr: "Séminaire IA en entreprise — fédérer toutes vos équipes en une journée",
  metaTitleFr: "Séminaire IA en entreprise — toute l'équipe",
  metaDescriptionFr:
    "Séminaire IA d'une journée en présentiel, jusqu'à 50 personnes : cadrer les usages, partager la méthode AXION et fédérer toutes vos équipes.",
  termesSemantiquesFr: [
    "séminaire IA entreprise",
    "journée IA toute l'entreprise",
    "fédérer les équipes IA",
    "méthode AXION",
    "cartographie des usages IA",
    "feuille de route IA collective",
  ],
  publicViseFr:
    "L'entreprise entière ou un site complet, réunis le même jour : tous services, tous métiers, tous niveaux de maîtrise de l'IA. C'est précisément ce mélange qui fait la valeur de la journée — ceux qui n'ont jamais essayé et ceux qui utilisent déjà l'IA au quotidien. Jusqu'à 50 participants, en tables de 6 à 8.",
  prerequisFr:
    "Aucun prérequis technique ni expérience de l'IA. Aucun compte à créer, aucun logiciel à installer : le séminaire est conçu pour qu'on y participe sans préparation. Chaque participant utilise son téléphone personnel pour le sondage et les QCM (évaluation individuelle et nominative) ; un ordinateur ou un téléphone par table suffit pour les temps collectifs.",
  casUsageFr: [
    {
      texteFr: "Donner un socle commun IA à tous les services, en une journée",
      imageSrc: "/illustrations/formations/fiches/seminaire-ia-toute-l-entreprise-1j/cas-1.webp",
      imageCredit: {
        name: "Product School",
        url: "https://unsplash.com/@productschool?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Faire émerger les usages IA déjà présents dans l'entreprise",
      imageSrc: "/illustrations/formations/fiches/seminaire-ia-toute-l-entreprise-1j/cas-2.webp",
      imageCredit: {
        name: "FORTYTWO",
        url: "https://unsplash.com/@byfortytwo?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Partager une méthode commune pour bien s'exprimer face à l'IA",
      imageSrc: "/illustrations/formations/fiches/seminaire-ia-toute-l-entreprise-1j/cas-3.webp",
      imageCredit: {
        name: "Alexandre Pellaes",
        url: "https://unsplash.com/@apellaes?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Repartir avec des règles communes et des engagements par service",
      imageSrc: "/illustrations/formations/fiches/seminaire-ia-toute-l-entreprise-1j/cas-4.webp",
      imageCredit: {
        name: "krakenimages",
        url: "https://unsplash.com/@krakenimages?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Comprendre le fonctionnement, les apports et les risques de l'IA générative, et disposer d'un socle commun de vocabulaire",
    "Identifier les règles de sécurité et de confidentialité applicables à leurs usages, et le cadre légal qui s'impose à l'entreprise",
    "Structurer une demande à l'IA grâce à la méthode AXION, partagée par tous",
    "Situer les usages de l'IA déjà présents dans l'entreprise, service par service",
    "Repérer les cas d'usage à fort potentiel dans leur propre périmètre",
    "S'accorder sur des règles communes et des engagements concrets pour la suite",
  ],
  beneficeDirigeantFr:
    "En une journée, toute l'entreprise partage un socle commun, rend visibles les usages IA déjà présents, et repart avec des règles et des engagements concrets par service — un vrai point de départ pour votre politique IA.",
  equationTempsFr:
    "1 journée réunissant toute l'entreprise → un socle commun, une cartographie réelle des usages, et une feuille de route collective formalisée le jour même.",
  modalites: ["presentiel"],
  programme: [
    {
      titreFr: "Séquence 1 — Ouverture et socle commun",
      steps: [
        {
          titre:
            "Ouverture par la direction : pourquoi cette journée, ce qui est attendu, ce qui sera fait des décisions prises",
        },
        {
          titre:
            "Le fonctionnement de l'IA générative expliqué simplement : ce qu'elle sait faire, où elle se trompe",
        },
        {
          titre:
            "Panorama des outils (ChatGPT, Claude, Gemini, Copilot) et où on les retrouve déjà",
        },
        {
          titre:
            "Les risques à connaître : hallucinations, biais, excès de confiance, fuite de données",
        },
        { titre: "Le cadre : RGPD, IA Act, et ce que l'entreprise doit à ses collaborateurs" },
        {
          titre:
            "Ce qu'on ne soumet jamais à une IA — la règle que tout le monde repart en connaissant",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Charte IA entreprise + guide des bonnes pratiques et de sécurité, en langage simple",
        },
      ],
    },
    {
      titreFr: "Séquence 2 — Où en est notre entreprise, vraiment ?",
      steps: [
        {
          titre:
            "Sondage en direct et anonyme : qui utilise quoi, pour quelles tâches, à quelle fréquence",
        },
        {
          titre:
            "Le résultat affiché devant tout le monde : ce que la direction découvre presque toujours",
        },
        {
          titre:
            "Travail par table : chaque service cartographie ses usages, déclarés et non déclarés",
        },
        {
          titre:
            "Restitution en plénière : la photographie réelle de l'entreprise, construite par elle-même",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Cartographie des usages IA de l'entreprise, produite par les participants",
        },
      ],
    },
    {
      titreFr: "Séquence 3 — Se donner une méthode commune",
      steps: [
        { titre: "La méthode AXION en 5 leviers : Acteur, conteXte, Intention, Output, Normes" },
        {
          titre:
            "Démonstration en direct : transformer une demande vague en résultat exploitable, sur un cas de la salle",
        },
        {
          titre:
            "Exercice par table : chaque groupe construit un prompt AXION sur un cas de son service",
        },
        {
          titre:
            "Démonstration : créer un assistant IA en quelques minutes, à partir d'un besoin de la salle",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de plus de 500 prompts AXION par métier + fiche mémo + kits assistants",
        },
      ],
    },
    {
      titreFr: "Séquence 4 — Le concours d'astuces",
      steps: [
        {
          titre:
            "Chaque table présente sa meilleure trouvaille : un usage, une astuce, un gain de temps réel",
        },
        {
          titre:
            "Le formateur reprend chaque proposition, l'améliore et la généralise aux autres services",
        },
        { titre: "Sélection collective des astuces à diffuser dans toute l'entreprise" },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Recueil des astuces de l'entreprise, compilé à partir des présentations",
        },
      ],
    },
    {
      titreFr: "Séquence 5 — Nos règles et nos engagements",
      steps: [
        {
          titre:
            "Les cas d'usage prioritaires qui ressortent de la journée, hiérarchisés collectivement",
        },
        {
          titre:
            "Les règles communes : ce qu'on s'autorise, ce qu'on s'interdit, qui tranche en cas de doute",
        },
        {
          titre:
            "Qui porte le sujet ensuite : le rôle du référent IA et les engagements de la direction",
        },
        {
          titre:
            "Chaque service repart avec trois engagements concrets, écrits et annoncés devant les autres",
        },
        { titre: "Bilan de la journée et questions ouvertes + QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Feuille de route collective + engagements par service, formalisés le jour même",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Est-ce une formation ou une conférence ?",
      reponse:
        "Ni l'un ni l'autre. Ce n'est pas une formation déguisée (à 50 personnes, pas d'accompagnement individuel écran par écran — ce sont nos formations en groupe de 15 qui font ça), et ce n'est pas une conférence (plus de la moitié de la journée est du travail collectif par table). Le séminaire pose un socle commun et prépare les formations, il ne les remplace pas.",
    },
    {
      question: "Pourquoi le présentiel uniquement ?",
      reponse:
        "Un séminaire dont l'objet est de fédérer les équipes n'a pas de sens à distance : le travail par table, les restitutions, les échanges entre services ne survivent pas à 50 personnes en salles virtuelles. Si le présentiel n'est pas possible, nos formations en groupe de 15 se dispensent aussi bien à distance.",
    },
    {
      question: "Combien de participants et quelle organisation de salle ?",
      reponse:
        "Jusqu'à 50 participants, en tables de 6 à 8 personnes, de préférence en mélangeant les services. Il faut un vidéoprojecteur ou grand écran, une sonorisation adaptée, un paperboard par table et une connexion internet couvrant la salle (pour le sondage et les QCM depuis les téléphones).",
    },
  ],
};

export const FORMATIONS_V2: ReadonlyArray<FormationV2> = [
  // Offres générales (4)
  BIEN_COMMENCER_4H,
  BIEN_COMMENCER_JOURNEE,
  IA_POUR_LES_EQUIPES,
  IA_POUR_L_AUTOMATISATION,
  // Offres par métier (9)
  IA_POUR_LES_RH,
  IA_POUR_LE_MARKETING,
  IA_POUR_LES_COMMERCIAUX,
  IA_POUR_LA_FINANCE,
  IA_POUR_LE_JURIDIQUE,
  IA_POUR_LA_PRODUCTION,
  IA_POUR_LES_ACHATS,
  IA_POUR_LA_RELATION_CLIENT,
  IA_POUR_L_IT,
  // Offres par secteur d'activité (8)
  IA_POUR_LA_SANTE,
  IA_POUR_LE_BTP,
  IA_POUR_L_IMMOBILIER,
  IA_POUR_LE_COMMERCE,
  IA_POUR_L_HOTELLERIE_RESTAURATION,
  IA_POUR_L_INDUSTRIE,
  IA_POUR_LE_TRANSPORT_LOGISTIQUE,
  IA_POUR_LA_BANQUE_ASSURANCE,
  // Séminaire — rubrique à part (hors catégories)
  SEMINAIRE_IA_ENTREPRISE,
];

/** Formations « classiques » (exclut les séminaires) pour l'affichage catalogue. */
export function getFormationsV2(): ReadonlyArray<FormationV2> {
  return FORMATIONS_V2.filter((f) => !f.seminaire);
}

/** Séminaires (rubrique dédiée). */
export function getSeminairesV2(): ReadonlyArray<FormationV2> {
  return FORMATIONS_V2.filter((f) => f.seminaire);
}

/** Formation par id/slug (FR ou EN). */
export function getFormationV2(idOrSlug: string): FormationV2 | undefined {
  return FORMATIONS_V2.find(
    (f) => f.id === idOrSlug || f.slugFr === idOrSlug || f.slugEn === idOrSlug,
  );
}

/** Formations d'une catégorie (générale / métier / secteur), dans l'ordre catalogue. */
export function getFormationsV2ByCategorie(
  categorie: FormationCategorie,
): ReadonlyArray<FormationV2> {
  return FORMATIONS_V2.filter((f) => f.categorie === categorie);
}

/** Formations d'une durée. */
export function getFormationsV2ByDuree(duree: FormationDuree): ReadonlyArray<FormationV2> {
  return FORMATIONS_V2.filter((f) => f.duree === duree);
}

/** Tranches d'effectif d'une formation (dérivées de la matrice prix). */
export function getFormationV2Brackets(f: FormationV2): ReadonlyArray<FormationBracket> {
  if (f.surDevis || !f.categorie) return [];
  return getFormationBrackets(f.categorie, f.duree);
}

/** Prix d'une formation (prix fixe par groupe — dérivé de la matrice prix). */
export function getFormationV2Price(
  f: FormationV2,
  _bracket?: FormationBracket,
): number | undefined {
  if (f.surDevis || !f.categorie) return undefined;
  return getFormationPrice(f.categorie, f.duree);
}

/** Prix d'entrée d'une formation — tranche unique : le prix affiché lui-même. */
export function getFormationV2EntryPrice(f: FormationV2): number | undefined {
  if (f.surDevis || !f.categorie) return undefined;
  return getFormationEntryPrice(f.categorie, f.duree);
}
