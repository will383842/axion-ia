// ============================================================================
// CATALOGUE FORMATIONS V2 — SSOT des 17 formations intra-entreprise.
//
// Source unique du catalogue qui REMPLACE l'offre /interventions (gated par
// OF_PUBLIC_DISCLOSURE_ENABLED jusqu'à l'agrément OF). Une formation = 1 gamme
// + 1 durée ; le PRIX dérive de `FORMATION_PRICE_MATRIX` (pricing.ts) via
// (gamme × durée × effectif) — jamais de prix en dur ici.
//
// Contenu 100 % FRANÇAIS (EN désactivé 301→FR ; `slugEn` = mapping de route
// uniquement, pas de contenu EN). Source du contenu :
// `Downloads/formations-axion-ia/50-commercial/*` + `mots-cles-seo-formations.md`.
//
// Le SEO de chaque page (h1/metaTitle/metaDescription/termes/faqs) vit ICI →
// la page dérive. Le déroulé minute-par-minute complet (kit pédagogique
// Qualiopi) relèvera de la PHASE B (DB) ; ici = programme public structuré.
// ============================================================================

import type { FormationBracket, FormationDuree, FormationGamme } from "../pricing";
import { getFormationBrackets, getFormationEntryPrice, getFormationPrice } from "../pricing";
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
  /** Ex. « Demi-journée », « Matin — produire », « Jour 1 — la maîtrise ». */
  titreFr: string;
  steps: ReadonlyArray<FormationProgrammeStep>;
}

export interface FormationV2 {
  /** Identifiant stable = slug FR (clé d'URL + lookup). */
  id: string;
  slugFr: string;
  /** Slug EN — mapping de route uniquement (pas de contenu EN). */
  slugEn: string;
  /** Numéro d'ordre source (catalogue 1-17). */
  numero: number;
  gamme: FormationGamme;
  duree: FormationDuree;
  /** Formation sans prix affiché (« Sur devis ») — court-circuite la matrice. */
  surDevis?: boolean;
  /** Séminaire (rubrique dédiée, présentiel, jusqu'à 50 pers). */
  seminaire?: boolean;
  /** « À LA UNE » (IA & Conformité). */
  featured?: boolean;
  /** Pré-requis explicite (sinon aucun). */
  prerequisFr?: string;
  // ---- Identité / accroche ----
  titreFr: string;
  /** Sous-titre bénéfice (le « ### » du catalogue). */
  accrocheFr: string;
  // ---- SEO (FR) ----
  h1Fr: string;
  metaTitleFr: string;
  metaDescriptionFr: string;
  termesSemantiquesFr: ReadonlyArray<string>;
  // ---- Contenu ----
  publicViseFr: string;
  /** « Ce que chacun saura faire » (objectifs pédagogiques). */
  objectifsFr: ReadonlyArray<string>;
  beneficeDirigeantFr: string;
  /** « L'équation temps » (ROI). */
  equationTempsFr: string;
  programme: ReadonlyArray<FormationProgrammeSection>;
  faqs: ReadonlyArray<FormationV2Faq>;
  // ---- Modalités & pratique (défauts centralisés dans catalog-v2-facts.ts) ----
  /** Format. Défaut = présentiel + distanciel possible. Surcharge si différent. */
  modalites?: ReadonlyArray<ModalitePedagogique>;
  /** Matériel requis. Défaut = « un ordinateur avec connexion internet ». */
  materielFr?: string;
  /**
   * Effectif du groupe — engagement CONTRACTUEL repris du programme source.
   * Défaut = « Jusqu'à 15 participants ». Surcharge obligatoire si le programme
   * annonce autre chose (Claude Code : 10 · Référent IA : 2 à 6 · séminaire : 50).
   */
  effectifFr?: string;
  /**
   * Outils réellement pratiqués (phrase complète, rendue en FAQ). Défaut dérivé
   * de la gamme. Surcharge si la formation n'enseigne pas les outils de sa gamme
   * (ex. Référent IA : aucun outil, les ateliers sont documentaires).
   */
  outilsFr?: string;
  // ---- Contenu enrichi (optionnel — fallback template si absent) ----
  /** Cas d'usage concrets (avec petite image optionnelle). Fallback = objectifs. */
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
// GAMME IA STANDARD — FORMATS 4 HEURES
// ============================================================================

const BIEN_DEMARRER_4H: FormationV2 = {
  id: "bien-demarrer-avec-l-ia-4h",
  slugFr: "bien-demarrer-avec-l-ia-4h",
  slugEn: "getting-started-with-ai-4h",
  numero: 1,
  gamme: "ia-standard",
  duree: "4h",
  surDevis: true,
  titreFr: "Bien démarrer avec l'IA",
  accrocheFr: "L'IA sans le stress — ChatGPT, Claude & Gemini pour bien démarrer, en 4 heures",
  h1Fr: "Formation IA pour bien démarrer en entreprise (4 heures)",
  metaTitleFr: "Formation IA débutant en entreprise — 4h | Axion-IA",
  metaDescriptionFr:
    "Formation IA d'initiation, 4 h, sans prérequis : démystifier l'IA, maîtriser un prompt efficace avec la méthode AXION, créer son premier assistant.",
  termesSemantiquesFr: [
    "formation IA débutant",
    "initiation intelligence artificielle",
    "méthode AXION",
    "premier assistant IA",
    "ChatGPT Claude Gemini",
    "prompt efficace",
  ],
  publicViseFr:
    "Débutants complets et collaborateurs qui utilisent déjà l'IA générative de façon occasionnelle, sans méthode ni cadre. L'objectif premier est de démystifier l'IA avant d'en faire un outil du quotidien : lever les blocages et les idées reçues pour que chacun ose s'en servir sans crainte.",
  prerequisFr:
    "Aucun prérequis technique ni expérience de l'IA. Formation essentiellement démonstrative ; seul l'exercice du module 3 demande un ordinateur et un compte Claude gratuit (création en quelques clics, sans carte bancaire).",
  casUsageFr: [
    {
      texteFr: "Rédiger un premier prompt AXION efficace sur un cas réel de son métier",
      imageSrc: "/illustrations/formations/fiches/bien-demarrer-avec-l-ia-4h/cas-1.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Créer son premier assistant IA personnalisé, pas à pas",
      imageSrc: "/illustrations/formations/fiches/bien-demarrer-avec-l-ia-4h/cas-2.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Repérer les réponses douteuses de l'IA avant de les réutiliser",
      imageSrc: "/illustrations/formations/fiches/bien-demarrer-avec-l-ia-4h/cas-3.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Repartir avec 3 à 5 cas d'usage applicables dès le lendemain",
      imageSrc: "/illustrations/formations/fiches/bien-demarrer-avec-l-ia-4h/cas-4.webp",
      imageCredit: {
        name: "Kelly Sikkema",
        url: "https://unsplash.com/@kellysikkema?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Démystifier l'IA générative : comprendre simplement ce qu'elle sait bien faire et où elle se trompe, sans jargon",
    "Se sentir légitime et en confiance face à l'IA, sans craindre de « mal faire »",
    "Comprendre les principes d'un prompt efficace grâce à la méthode AXION",
    "Savoir ce que permettent ChatGPT, Claude et Gemini au quotidien, et quand utiliser chacun",
    "Comprendre et créer son premier assistant IA personnalisé sur Claude, pas à pas",
    "Repartir avec 3 à 5 cas d'usage concrets à appliquer dès le lendemain dans son métier",
  ],
  beneficeDirigeantFr:
    "Toute l'équipe démystifie l'IA et repart avec des usages concrets en une demi-journée, sans prérequis ni abonnement — on lève les blocages avant d'outiller.",
  equationTempsFr:
    "4 h d'initiation → chacun ose enfin utiliser l'IA et repart avec 3 à 5 cas d'usage applicables dès le lendemain.",
  programme: [
    {
      titreFr: "Module 1 — Démystifier l'IA générative et faire ses premiers pas",
      steps: [
        {
          titre:
            "L'IA générative expliquée simplement : ce qu'elle sait bien faire, où elle se trompe",
        },
        {
          titre:
            "Démonstration en direct : premier échange avec ChatGPT, Claude et Gemini, commenté pas à pas",
        },
        {
          titre:
            "Panorama des IA du marché (ChatGPT, Claude, Gemini, Copilot) et où on les retrouve déjà",
        },
        {
          titre:
            "Les erreurs à ne pas faire : hallucinations, excès de confiance, fuite de données",
        },
        {
          titre:
            "Ce qu'on peut — et ne doit jamais — confier à une IA (données clients, RH, secrets d'affaires)",
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
      titreFr: "Module 2 — Bien s'exprimer face à l'IA : la méthode AXION",
      steps: [
        { titre: "La méthode AXION en 5 leviers : Acteur, conteXte, Intention, Output, Normes" },
        {
          titre:
            "Passer d'une demande vague à un prompt clair : démonstration progressive sur cas réels",
        },
        {
          titre:
            "Astuces sans complexité : donner un exemple, demander à l'IA d'expliquer son raisonnement, de se relire",
        },
        {
          titre:
            "Exercice collectif : chacun formule un prompt AXION sur un cas de son métier, affiné en groupe",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de plus de 500 prompts AXION classés par métier + fiche mémo de la méthode",
        },
      ],
    },
    {
      titreFr: "Module 3 — Créer son premier assistant IA personnalisé",
      steps: [
        {
          titre:
            "Un assistant IA, c'est quoi : des instructions en français + des documents de référence, aucun code",
        },
        { titre: "Découverte guidée de Claude Projects, des Gemini Gems et des Custom GPTs" },
        {
          titre: "Rédiger des instructions pour spécialiser un assistant sur une tâche récurrente",
        },
        {
          titre:
            "Exercice guidé : chacun crée son assistant sur Claude Projects à partir d'un cas de son métier",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Plus de 20 kits assistants IA clés-en-main (versions ChatGPT, Claude et Gemini) classés par métier",
        },
      ],
    },
    {
      titreFr: "Module 4 — Identifier ses cas d'usage et prendre son envol",
      steps: [
        {
          titre:
            "Une méthode simple pour repérer, dans son quotidien, les tâches que l'IA peut déjà alléger",
        },
        {
          titre:
            "Les cas d'usage les plus faciles à démarrer par métier : commercial, RH, marketing, support, finance",
        },
        {
          titre:
            "Chacun repart avec sa feuille de route : 3 à 5 actions concrètes à tester la semaine suivante",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Guide des meilleurs cas d'usage IA pour débutants + prompt « auditeur IA » + trame de roadmap",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il un niveau en IA pour participer ?",
      reponse:
        "Aucun. La formation est conçue pour des débutants complets comme pour ceux qui utilisent déjà l'IA occasionnellement. Chaque notion est expliquée avant d'être illustrée, sans jargon.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance via Microsoft Teams, avec exactement le même contenu et le même niveau d'interactivité.",
    },
    {
      question: "Que repartent faire les participants concrètement ?",
      reponse:
        "Chacun repart avec la méthode AXION, une bibliothèque de prompts, son premier assistant IA créé pendant la session, et 3 à 5 cas d'usage à appliquer dès le lendemain.",
    },
  ],
};

const BIEN_DEMARRER_JOURNEE_7H: FormationV2 = {
  id: "bien-demarrer-avec-l-ia-journee-7h",
  slugFr: "bien-demarrer-avec-l-ia-journee-7h",
  slugEn: "getting-started-with-ai-full-day-7h",
  numero: 2,
  gamme: "ia-standard",
  duree: "1j",
  surDevis: true,
  titreFr: "Bien démarrer avec l'IA — journée complète",
  accrocheFr:
    "L'IA sans le stress — ChatGPT, Claude & Gemini, de la découverte à la mise en pratique, en une journée",
  h1Fr: "Formation IA pour bien démarrer en entreprise (journée complète, 7 heures)",
  metaTitleFr: "Formation IA débutant en entreprise — 1 jour | Axion-IA",
  metaDescriptionFr:
    "Formation IA d'initiation sur une journée, sans prérequis : démystifier l'IA, rédiger un prompt efficace avec la méthode AXION, créer son assistant IA.",
  termesSemantiquesFr: [
    "formation IA débutant",
    "initiation intelligence artificielle",
    "méthode AXION",
    "assistant IA personnalisé",
    "ChatGPT Claude Gemini",
    "prompt efficace",
    "cas d'usage IA par métier",
    "feuille de route IA",
  ],
  publicViseFr:
    "Formation d'initiation destinée aux débutants complets ainsi qu'aux collaborateurs qui utilisent déjà l'IA générative de façon occasionnelle, sans méthode ni cadre structuré. Son objectif premier est de démystifier l'IA avant d'en faire un outil du quotidien : lever les blocages et les idées reçues, pour que chacun ose s'en servir sans crainte.",
  prerequisFr:
    "Aucun prérequis technique ni expérience de l'IA. La formation est essentiellement démonstrative. Pour les exercices pratiques des modules 2 et 3, chaque participant doit disposer d'un ordinateur et d'un compte Claude gratuit (création en quelques clics, sans carte bancaire) ; des comptes Gemini et ChatGPT gratuits sont un plus mais ne sont pas indispensables.",
  casUsageFr: [
    {
      texteFr: "Rédiger et tester ses prompts AXION sur ses propres cas métier",
      imageSrc: "/illustrations/formations/fiches/bien-demarrer-avec-l-ia-journee-7h/cas-1.webp",
      imageCredit: {
        name: "maks_d",
        url: "https://unsplash.com/@maks_d?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Créer son assistant IA et le répliquer sur un second outil",
      imageSrc: "/illustrations/formations/fiches/bien-demarrer-avec-l-ia-journee-7h/cas-2.webp",
      imageCredit: {
        name: "Jakub Żerdzicki",
        url: "https://unsplash.com/@jakubzerdzicki?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Savoir ce qu'on confie à l'IA et ce qu'on protège (RGPD, IA Act)",
      imageSrc: "/illustrations/formations/fiches/bien-demarrer-avec-l-ia-journee-7h/cas-3.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Construire sa feuille de route IA personnelle à 3 mois",
      imageSrc: "/illustrations/formations/fiches/bien-demarrer-avec-l-ia-journee-7h/cas-4.webp",
      imageCredit: {
        name: "Hugo Rocha",
        url: "https://unsplash.com/@hugorrocha?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Démystifier l'IA générative : comprendre simplement ce qu'elle sait bien faire et où elle se trompe, sans jargon technique",
    "Se sentir légitime et en confiance face à l'IA, sans craindre de « mal faire » ou de passer pour un débutant",
    "Rédiger et tester un prompt efficace grâce à la méthode AXION, sur son propre cas d'usage",
    "Savoir ce que permettent ChatGPT, Claude et Gemini au quotidien, et quand utiliser chacun",
    "Créer son propre assistant IA personnalisé sur Claude, et savoir le décliner sur un second outil",
    "Identifier des cas d'usage concrets pour son métier et repartir avec une feuille de route à 3 mois",
  ],
  beneficeDirigeantFr:
    "En une journée, toute l'équipe passe de la découverte à la pratique : chacun démystifie l'IA, crée son propre assistant et repart avec une feuille de route à 3 mois — sans prérequis ni personnalisation en amont.",
  equationTempsFr:
    "1 journée d'initiation → chacun ose enfin utiliser l'IA, crée son premier assistant pendant la session et repart avec 3 à 5 actions concrètes à tester dès la semaine suivante.",
  programme: [
    {
      titreFr: "Module 1 — Démystifier l'IA générative et faire ses premiers pas",
      steps: [
        {
          titre:
            "L'IA générative expliquée simplement, sans jargon technique : ce qu'elle sait bien faire et où elle se trompe",
        },
        {
          titre:
            "Démonstration en direct : un premier échange avec ChatGPT, Claude et Gemini, commenté pas à pas par le formateur",
        },
        {
          titre:
            "Panorama des IA génératives du marché (ChatGPT, Claude, Gemini, Copilot) : ce qui les distingue et où on les retrouve déjà (Microsoft 365, Google Workspace…)",
        },
        {
          titre:
            "Pourquoi cette formation s'appuie sur ChatGPT, Claude et Gemini : les trois outils les plus utilisés en entreprise aujourd'hui",
        },
        {
          titre:
            "Les erreurs à ne pas faire (hallucinations, excès de confiance, fuite de données), expliquées avec des exemples concrets",
        },
        {
          titre:
            "Ce qu'on peut — et ne doit jamais — soumettre à un assistant IA (données clients, données RH, secrets d'affaires), et pourquoi (RGPD, AI Act)",
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
      titreFr: "Module 2 — Bien s'exprimer face à l'IA : la méthode AXION",
      steps: [
        {
          titre: "La méthode AXION en 5 mots simples : Acteur, conteXte, Intention, Output, Normes",
        },
        {
          titre:
            "Passer d'une demande vague à un prompt clair : démonstration progressive à partir de cas proposés par les participants",
        },
        {
          titre:
            "Quelques astuces pour aller plus loin sans complexité : donner un exemple à l'IA, lui demander d'expliquer son raisonnement, lui demander de se relire",
        },
        {
          titre:
            "Démonstration comparative : un même prompt AXION exécuté en direct sur ChatGPT, Claude et Gemini, pour observer les différences",
        },
        {
          titre:
            "Exercice oral collectif : chacun formule à voix haute un prompt AXION sur un cas réel de son métier, le groupe l'affine ensemble",
        },
        {
          titre:
            "Exercice pratique individuel : chacun rédige et teste son propre prompt AXION sur Claude, sur un cas réel de son quotidien professionnel",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de plus de 500 prompts AXION classés par métier, compatibles ChatGPT, Claude et Gemini + fiche mémo de la méthode",
        },
      ],
    },
    {
      titreFr: "Module 3 — Créer son premier assistant IA personnalisé",
      steps: [
        {
          titre:
            "Un assistant IA, c'est quoi concrètement ? Des instructions en français + des documents de référence, aucun code requis",
        },
        {
          titre:
            "Découverte guidée de Claude Projects, des Gemini Gems et des Custom GPTs (ChatGPT), trois « versions » du même principe",
        },
        {
          titre:
            "Comment rédiger des instructions pour spécialiser un assistant sur une tâche récurrente",
        },
        {
          titre:
            "Exercice pratique guidé : chacun crée son propre assistant sur Claude Projects à partir d'un cas d'usage de son métier — le formateur guide tout le groupe simultanément, étape par étape",
        },
        {
          titre:
            "Réplication guidée : transposer en quelques minutes le même assistant sur Gemini ou ChatGPT, au choix, pour vérifier la portabilité de la méthode",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Plus de 20 kits assistants IA clés-en-main, prêts à copier-coller (versions ChatGPT, Claude et Gemini) classés par métier",
        },
      ],
    },
    {
      titreFr: "Module 4 — Explorer les cas d'usage par métier",
      steps: [
        {
          titre:
            "Panorama des cas d'usage les plus faciles à démarrer par fonction : commercial, RH, marketing, support client, finance",
        },
        {
          titre:
            "Travail collectif en petits groupes : identifier 3 tâches automatisables dans son propre service",
        },
        { titre: "Restitution et enrichissement collectif, commenté par le formateur" },
        {
          titre:
            "Les cas d'usage à éviter ou à sécuriser davantage, selon la sensibilité des données concernées",
        },
        { titre: "QCM de validation des acquis" },
        { temps: "Livrable", titre: "Guide des cas d'usage IA par métier, pour débutants" },
      ],
    },
    {
      titreFr: "Module 5 — Construire sa feuille de route et conclure",
      steps: [
        { titre: "Une méthode simple pour prioriser ses premiers cas d'usage" },
        {
          titre:
            "Chacun construit sa propre feuille de route : 3 à 5 actions concrètes à tester dès la semaine suivante",
        },
        {
          titre:
            "Étude de cas commentée : le formateur illustre la méthode sur un dernier exemple proposé par le groupe",
        },
        { titre: "Bilan de la journée et temps de questions ouvertes" },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Trame de feuille de route personnalisable + prompt « auditeur IA »",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il déjà connaître l'IA pour suivre cette journée ?",
      reponse:
        "Non, aucun prérequis. La formation est pensée pour des débutants complets comme pour ceux qui utilisent déjà l'IA de façon occasionnelle. Chaque notion est expliquée avant d'être illustrée, sans jargon technique, et le rythme reste progressif toute la journée.",
    },
    {
      question: "Quelle différence avec le format court de 4 heures ?",
      reponse:
        "La journée complète (7 h) laisse le temps de pratiquer réellement : chacun rédige et teste ses propres prompts AXION, crée son assistant IA pendant la session, explore les cas d'usage de son métier en petits groupes et repart avec une feuille de route à 3 mois. Le format 4 h reste, lui, essentiellement démonstratif.",
    },
    {
      question: "La formation peut-elle se faire à distance ?",
      reponse:
        "Oui, au choix : dans vos locaux ou entièrement à distance via Microsoft Teams, avec exactement le même contenu et le même niveau d'interactivité. Les démonstrations se font en partage d'écran et les exercices pratiques fonctionnent à l'identique, chacun sur son propre poste.",
    },
  ],
};

const PROMPTS_AVANCES_ASSISTANTS_4H: FormationV2 = {
  id: "prompts-avances-et-assistants-ia-4h",
  slugFr: "prompts-avances-et-assistants-ia-4h",
  slugEn: "advanced-prompts-ai-assistants-4h",
  numero: 3,
  gamme: "ia-standard",
  duree: "4h",
  surDevis: true,
  titreFr: "Prompts avancés & assistants IA",
  accrocheFr: "L'IA sans le stress — prompts avancés et assistants IA en une demi-journée",
  h1Fr: "Formation prompts avancés & assistants IA en entreprise (4 heures)",
  metaTitleFr: "Formation prompts avancés & assistants IA — 4h | Axion-IA",
  metaDescriptionFr:
    "Formation IA de 4 h pour structurer sa pratique du prompt avec la méthode AXION, créer un master prompt et déployer ses assistants IA. Présentiel ou distanciel.",
  termesSemantiquesFr: [
    "formation prompt engineering avancé",
    "méthode AXION",
    "master prompt",
    "assistant IA base de connaissances",
    "visual prompt",
    "recherche augmentée IA",
    "Claude Cowork",
    "ChatGPT Claude Gemini",
  ],
  publicViseFr:
    "Collaborateurs ayant déjà une pratique de l'IA générative — ayant suivi une formation Axion-IA, ou utilisant déjà régulièrement ChatGPT, Claude ou Gemini — et souhaitant structurer leur pratique du prompt et créer leurs premiers assistants IA, dans un format court.",
  prerequisFr:
    "Une première utilisation de l'IA générative est nécessaire : cette formation ne s'adresse pas à des débutants complets. Disposer d'un ordinateur et d'un compte Claude gratuit pour les exercices pratiques.",
  casUsageFr: [
    {
      texteFr: "Structurer des prompts avancés exploitables du premier coup",
      imageSrc: "/illustrations/formations/fiches/prompts-avances-et-assistants-ia-4h/cas-1.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Créer des assistants spécialisés nourris de ses documents de référence",
      imageSrc: "/illustrations/formations/fiches/prompts-avances-et-assistants-ia-4h/cas-2.webp",
      imageCredit: {
        name: "Domenico Loia",
        url: "https://unsplash.com/@domenicoloia?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Décomposer une tâche complexe en étapes que l'IA enchaîne",
      imageSrc: "/illustrations/formations/fiches/prompts-avances-et-assistants-ia-4h/cas-3.webp",
      imageCredit: {
        name: "ThisisEngineering",
        url: "https://unsplash.com/@thisisengineering?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Industrialiser ses tâches récurrentes avec des assistants réutilisables",
      imageSrc: "/illustrations/formations/fiches/prompts-avances-et-assistants-ia-4h/cas-4.webp",
      imageCredit: {
        name: "João Victor da Silva Ribeiro",
        url: "https://unsplash.com/@rjoaovictorbhmg?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Structurer n'importe quel prompt grâce à la méthode AXION et à des techniques avancées",
    "Créer un master prompt capable de générer des prompts experts adaptés à chaque situation",
    "Générer des visuels professionnels grâce aux techniques de visual prompt",
    "Réduire les hallucinations et fiabiliser les réponses grâce à la recherche augmentée",
    "Créer un assistant IA avec base de connaissances, prêt à être partagé avec son équipe",
    "Identifier quand déléguer une tâche complète à un agent IA plutôt que d'écrire un prompt ponctuel",
    "Repartir avec une bibliothèque de prompts et de kits assistants réutilisables immédiatement",
  ],
  beneficeDirigeantFr:
    "En une demi-journée, l'équipe passe d'une pratique intuitive de l'IA à une pratique structurée : prompts fiables avec la méthode AXION, assistants IA partagés et premiers réflexes de délégation — des gains de productivité mesurables dès la semaine suivante.",
  equationTempsFr:
    "4 h de montée en compétence → chacun structure ses prompts avec AXION, crée un assistant IA partageable et repart avec une bibliothèque réutilisable immédiatement.",
  programme: [
    {
      titreFr: "Module 1 — Maîtriser le prompt-engineering avancé",
      steps: [
        {
          titre:
            "Rappel express de la méthode AXION et de ses 5 leviers : Acteur, conteXte, Intention, Output, Normes",
        },
        {
          titre:
            "Techniques avancées expliquées simplement : raisonnement étape par étape, exemples calibrants, auto-amélioration itérative",
        },
        {
          titre:
            "Créer son master prompt : un prompt qui génère lui-même des prompts experts, adaptés à chaque situation",
        },
        {
          titre:
            "Visual prompt : générer des visuels professionnels et photoréalistes avec les bonnes techniques de description",
        },
        {
          titre:
            "Fiabiliser ses réponses et réduire les hallucinations grâce à la recherche augmentée",
        },
        {
          titre:
            "Exercices pratiques sur ChatGPT, Claude et Gemini, sur des cas réels apportés par les participants",
        },
        {
          titre:
            "Challenge en petits groupes : résoudre un cas d'usage complet en autonomie, restitution devant le groupe",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de plus de 500 prompts avancés classés par métier + générateur de prompts + guide du visual prompt",
        },
      ],
    },
    {
      titreFr: "Module 2 — Créer et déployer ses assistants IA personnalisés",
      steps: [
        {
          titre:
            "Architecture d'un assistant IA : instructions + base de connaissances (rappel et approfondissement)",
        },
        {
          titre:
            "Rédiger des instructions avancées pour spécialiser un assistant sur des cas complexes",
        },
        {
          titre:
            "Atelier pratique guidé : créer un assistant avec base de connaissances sur Claude Projects, le formateur guide tout le groupe simultanément",
        },
        { titre: "Partager un assistant avec son équipe et le faire évoluer dans le temps" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Plus de 20 kits assistants IA clés-en-main classés par métier",
        },
      ],
    },
    {
      titreFr: "Module 3 — Déléguer ses tâches avec Claude Cowork",
      steps: [
        {
          titre:
            "Savoir reconnaître quand un prompt ponctuel ne suffit plus et qu'il faut déléguer une tâche complète",
        },
        {
          titre:
            "Cas d'usage à fort potentiel pour gagner du temps au quotidien : tri de fichiers, synthèse de documents, rapports récurrents",
        },
        {
          titre:
            "Démonstration commentée « le lundi matin après les vacances » : Cowork range un dossier en désordre et résume une pile de documents en une note claire",
        },
        { titre: "Construire sa feuille de route pour la suite" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Guide Claude Cowork + trame de feuille de route personnalisable",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il déjà savoir utiliser l'IA pour participer ?",
      reponse:
        "Oui. Cette formation ne s'adresse pas à des débutants complets : une première pratique de ChatGPT, Claude ou Gemini est nécessaire pour suivre le rythme soutenu et tirer parti des techniques avancées.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance via Microsoft Teams. Les démonstrations se font en partage d'écran et les exercices pratiques fonctionnent à l'identique, chacun sur son propre poste, avec le même niveau d'interactivité.",
    },
    {
      question: "Que repartent faire les participants concrètement ?",
      reponse:
        "Chacun repart avec la méthode AXION appliquée à des techniques avancées, un master prompt, un assistant IA à base de connaissances créé pendant la session, une bibliothèque de plus de 500 prompts et des kits assistants réutilisables immédiatement.",
    },
  ],
};

const GAGNER_DU_TEMPS_7H: FormationV2 = {
  id: "gagner-du-temps-au-quotidien-avec-l-ia-7h",
  slugFr: "gagner-du-temps-au-quotidien-avec-l-ia-7h",
  slugEn: "save-time-daily-with-ai-7h",
  numero: 4,
  gamme: "ia-standard",
  duree: "1j",
  surDevis: true,
  titreFr: "Gagner du temps au quotidien avec l'IA",
  accrocheFr:
    "L'IA sans le stress — passer d'un usage basique à un usage avancé avec ChatGPT, Claude & Gemini, en une journée",
  h1Fr: "Formation IA pour gagner du temps au quotidien (1 jour)",
  metaTitleFr: "Formation IA productivité en entreprise — 1 jour | Axion-IA",
  metaDescriptionFr:
    "Formation IA d'une journée pour passer d'un usage basique à avancé : prompts experts avec la méthode AXION, assistants IA avec base de connaissances, agent.",
  termesSemantiquesFr: [
    "formation IA productivité",
    "prompts avancés",
    "méthode AXION",
    "assistant IA base de connaissances",
    "agent IA Claude Cowork",
    "gagner du temps IA entreprise",
    "ChatGPT Claude Gemini",
  ],
  publicViseFr:
    "Collaborateurs ayant déjà une première pratique de l'IA générative — ayant suivi notre formation débutant, ou utilisant déjà occasionnellement ChatGPT, Claude ou Gemini — et souhaitant passer d'un usage basique à un usage avancé pour gagner du temps sur leurs tâches quotidiennes.",
  prerequisFr:
    "Une première utilisation de l'IA générative est nécessaire (ChatGPT, Claude ou Gemini) : cette formation ne s'adresse pas à des débutants complets. Disposer d'un ordinateur et d'un compte Claude gratuit pour les exercices pratiques.",
  casUsageFr: [
    {
      texteFr: "Traiter sa boîte mail deux fois plus vite : tri, réponses, relances",
      imageSrc:
        "/illustrations/formations/fiches/gagner-du-temps-au-quotidien-avec-l-ia-7h/cas-1.webp",
      imageCredit: {
        name: "Hayley Kim Studios",
        url: "https://unsplash.com/@hayleykimstudios?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Produire un compte-rendu structuré à partir de notes brutes",
      imageSrc:
        "/illustrations/formations/fiches/gagner-du-temps-au-quotidien-avec-l-ia-7h/cas-2.webp",
      imageCredit: {
        name: "JESHOOTS.COM",
        url: "https://unsplash.com/@jeshoots?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Synthétiser un document long en points clés et actions",
      imageSrc:
        "/illustrations/formations/fiches/gagner-du-temps-au-quotidien-avec-l-ia-7h/cas-3.webp",
      imageCredit: {
        name: "Wesley Tingey",
        url: "https://unsplash.com/@wesleyphotography?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Confier une tâche récurrente à un agent qui travaille pour vous",
      imageSrc:
        "/illustrations/formations/fiches/gagner-du-temps-au-quotidien-avec-l-ia-7h/cas-4.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Mobiliser des techniques de prompt avancées, au-delà des bases, pour obtenir des résultats plus précis et plus fiables",
    "Créer un assistant IA avancé, avec base de connaissances, sur plusieurs outils",
    "Comprendre comment déléguer une tâche complexe à un agent IA (Claude Cowork) pour aller au-delà du prompt ponctuel",
    "Repérer ses tâches à plus fort potentiel de gain de temps et les prioriser",
    "Repartir avec une feuille de route de déploiement IA orientée productivité",
  ],
  beneficeDirigeantFr:
    "En une journée, l'équipe passe d'un usage basique à un usage avancé de l'IA et repart avec une feuille de route de productivité — prompts experts, assistants avec base de connaissances et délégation à un agent, sans personnalisation en amont.",
  equationTempsFr:
    "1 jour (7 h) → chacun industrialise ses usages IA (prompts avancés, assistants, agent Cowork) et repart avec 3 cas d'usage à fort potentiel priorisés et une roadmap à tester dès la semaine suivante.",
  programme: [
    {
      titreFr: "Module 1 — Aller au-delà des bases",
      steps: [
        {
          titre:
            "Rappel express : principes de fonctionnement de l'IA générative, ce qu'elle fait bien, où elle se trompe encore",
        },
        {
          titre:
            "Pourquoi la plupart des entreprises restent bloquées à un usage basique de l'IA, et comment en sortir",
        },
        {
          titre:
            "Sécuriser ses usages avancés : RGPD, IA Act, ce qu'on ne doit jamais soumettre à une IA",
        },
        {
          titre:
            "Panorama des usages avancés accessibles dès aujourd'hui : génération d'images, présentations, recherche augmentée",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Charte IA entreprise + guide des bonnes pratiques et de sécurité",
        },
      ],
    },
    {
      titreFr: "Module 2 — Prompts avancés : aller plus loin avec la méthode AXION",
      steps: [
        {
          titre: "Rappel express de la méthode AXION : Acteur, conteXte, Intention, Output, Normes",
        },
        {
          titre:
            "Techniques avancées expliquées simplement : raisonnement étape par étape, exemples calibrants, auto-amélioration itérative, recherche augmentée",
        },
        {
          titre:
            "Exercices pratiques sur ChatGPT, Claude et Gemini, sur des cas réels apportés par les participants",
        },
        {
          titre:
            "Challenge en petits groupes : résoudre un cas d'usage complet en autonomie, restitution devant le groupe",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de plus de 500 prompts avancés classés par métier + générateur de prompts",
        },
      ],
    },
    {
      titreFr: "Module 3 — Créer des assistants IA avancés et déléguer ses tâches",
      steps: [
        {
          titre:
            "Architecture d'un assistant IA avancé : instructions + base de connaissances (rappel et approfondissement)",
        },
        {
          titre:
            "Exercice pratique guidé : créer un assistant avec base de connaissances sur Claude Projects, le formateur guidant tout le groupe simultanément",
        },
        {
          titre:
            "Quand un prompt ne suffit plus : découverte de Claude Cowork, l'agent capable d'exécuter des tâches complètes en autonomie (lecture de fichiers, connexion à Gmail, Drive, Slack via connecteurs)",
        },
        {
          titre:
            "Démonstration commentée « le lundi matin après les vacances » : Cowork range en direct un dossier « Téléchargements » en désordre, puis résume une pile de documents en une note claire",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Plus de 20 kits assistants IA clés-en-main classés par métier + jeu de fichiers de démonstration Cowork prêt à l'emploi",
        },
      ],
    },
    {
      titreFr: "Module 4 — Identifier ses cas d'usage à plus fort potentiel",
      steps: [
        { titre: "Méthodologie pour repérer les tâches à plus fort potentiel de gain de temps" },
        {
          titre:
            "Les meilleurs cas d'usage par métier, orientés productivité : commercial, RH, marketing, support client, finance",
        },
        {
          titre:
            "Travail collectif en petits groupes : chaque groupe identifie et priorise 3 cas d'usage à fort potentiel dans son propre service",
        },
        { titre: "Restitution et enrichissement collectif, commenté par le formateur" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Guide des meilleurs cas d'usage IA orientés productivité, classés par métier",
        },
      ],
    },
    {
      titreFr: "Module 5 — Construire sa feuille de route et conclure",
      steps: [
        { titre: "Une méthode simple pour prioriser et séquencer son déploiement IA" },
        {
          titre:
            "Chacun construit sa propre feuille de route : actions concrètes à tester dès la semaine suivante",
        },
        {
          titre:
            "Étude de cas commentée : le formateur illustre la méthode sur un dernier exemple proposé par le groupe",
        },
        { titre: "Bilan de la journée et temps de questions ouvertes" },
        { titre: "QCM de validation des acquis en fin de module" },
        { temps: "Livrable", titre: "Prompt « auditeur IA » + trame de roadmap personnalisable" },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il déjà savoir utiliser l'IA pour suivre cette journée ?",
      reponse:
        "Oui. Cette formation ne s'adresse pas aux débutants complets : une première pratique de ChatGPT, Claude ou Gemini est nécessaire. Elle fait passer d'un usage basique à un usage avancé et orienté productivité.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance via Microsoft Teams, avec exactement le même contenu et le même niveau d'interactivité. Les exercices se font sur le poste de chaque participant dans les deux cas.",
    },
    {
      question: "Faut-il un compte Claude payant pour la démonstration Cowork ?",
      reponse:
        "Non. Un compte Claude gratuit suffit pour vos exercices. La démonstration de Claude Cowork (module 3) est réalisée par le formateur depuis son propre compte, Cowork nécessitant un plan payant : vous n'avez rien à souscrire.",
    },
  ],
};

const CLAUDE_PRISE_EN_MAIN_7H: FormationV2 = {
  id: "claude-prise-en-main-complete-7h",
  slugFr: "claude-prise-en-main-complete-7h",
  slugEn: "claude-complete-onboarding-7h",
  numero: 5,
  gamme: "claude",
  duree: "1j",
  surDevis: true,
  titreFr: "Claude — Prise en main complète",
  accrocheFr:
    "L\'IA sans le stress — faire de Claude un véritable outil de travail personnalisé, en une journée",
  h1Fr: "Formation Claude en entreprise : prise en main complète (1 jour)",
  metaTitleFr: "Formation Claude en entreprise — 1 jour | Axion-IA",
  metaDescriptionFr:
    "Formation Claude d'une journée pour utilisateurs réguliers : prompt avancé, Artifacts, paramétrage, création de Skills et connecteurs. Présentiel ou distanciel.",
  termesSemantiquesFr: [
    "formation Claude entreprise",
    "Claude Artifacts",
    "Claude Skills",
    "connecteurs Claude",
    "méthode AXION",
    "paramétrer Claude Pro",
  ],
  publicViseFr:
    "Collaborateurs disposant d\'une pratique de l\'IA générative et souhaitant se spécialiser sur Claude : le paramétrer, le connecter à leurs outils métiers et le personnaliser sur leurs cas d\'usage.",
  prerequisFr:
    "Une pratique régulière de l\'IA générative est nécessaire — cette formation ne s\'adresse pas à des débutants complets. Disposer d\'un ordinateur et d\'un compte Claude Pro (ou supérieur) : les fonctionnalités travaillées (connecteurs, Skills) ne sont pas disponibles en version gratuite.",
  casUsageFr: [
    {
      texteFr: "Maîtriser Claude au quotidien : rédaction, analyse, relecture",
      imageSrc: "/illustrations/formations/fiches/claude-prise-en-main-complete-7h/cas-1.webp",
      imageCredit: {
        name: "AllGo - An App For Plus Size People",
        url: "https://unsplash.com/@canweallgo?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Produire documents et visuels directement avec les Artifacts",
      imageSrc: "/illustrations/formations/fiches/claude-prise-en-main-complete-7h/cas-2.webp",
      imageCredit: {
        name: "Theme Photos",
        url: "https://unsplash.com/@themephotos?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Organiser son travail en projets avec ses documents de référence",
      imageSrc: "/illustrations/formations/fiches/claude-prise-en-main-complete-7h/cas-3.webp",
      imageCredit: {
        name: "Corinne Kutz",
        url: "https://unsplash.com/@corinnekutz?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Connecter Claude à son environnement de travail",
      imageSrc: "/illustrations/formations/fiches/claude-prise-en-main-complete-7h/cas-4.webp",
      imageCredit: {
        name: "GoodNotes 5",
        url: "https://unsplash.com/@goodnotes?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Identifier les spécificités de Claude, ses forces et ses limites, et choisir le bon modèle selon la tâche",
    "Paramétrer et sécuriser son compte Claude : confidentialité, mémoire, styles de réponse",
    "Exploiter les fonctionnalités avancées : Artifacts, recherche web, création de fichiers",
    "Créer une Skill Claude complète adaptée à un cas d\'usage de son métier",
    "Connecter Claude à ses outils métiers via les connecteurs",
    "Produire des supports professionnels avec Claude : documents, visuels, présentations",
  ],
  beneficeDirigeantFr:
    "En une journée, chaque collaborateur transforme Claude d\'un simple chatbot en un outil de travail paramétré, sécurisé et connecté à ses outils métiers — avec des Skills et supports produits pendant la session.",
  equationTempsFr:
    "1 jour (7 h) → chacun repart avec son compte Claude paramétré, une Skill métier opérationnelle, un projet connecté et une feuille de route prête à appliquer.",
  programme: [
    {
      titreFr: "Module 1 — Maîtriser le prompt et les Artifacts dans Claude",
      steps: [
        {
          titre:
            "Les spécificités de Claude : forces, limites, cas d\'usage où il fait la différence",
        },
        {
          titre:
            "La méthode AXION appliquée à Claude (Acteur, conteXte, Intention, Output, Normes) et les techniques avancées de prompt",
        },
        {
          titre:
            "Exploiter les Artifacts pour produire des documents structurés et des visualisations",
        },
        {
          titre:
            "Exercices pratiques : rédaction, analyse, synthèse et création de contenus sur des cas réels",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide du prompt Claude + bibliothèque de plus de 500 prompts AXION classés par métier",
        },
      ],
    },
    {
      titreFr: "Module 2 — Paramétrer, sécuriser et personnaliser Claude",
      steps: [
        {
          titre:
            "Créer et sécuriser son compte : paramètres de confidentialité, données et entraînement",
        },
        { titre: "Paramétrer la mémoire, les préférences et les styles de réponse personnalisés" },
        {
          titre:
            "Choisir le bon modèle Claude selon le cas d\'usage : rapidité, profondeur de raisonnement, coût",
        },
        {
          titre:
            "Maîtriser les fonctionnalités clés : recherche web, analyse de documents, création de fichiers",
        },
        {
          titre:
            "Atelier pratique guidé : chaque participant paramètre entièrement son compte Claude pour son métier",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Guide complet de paramétrage Claude en entreprise + charte IA interne",
        },
      ],
    },
    {
      titreFr: "Module 3 — Créer ses Skills et connecter Claude à ses outils",
      steps: [
        { titre: "Projects et Skills Claude : à quoi ça sert, quand utiliser l\'un ou l\'autre" },
        { titre: "Anatomie d\'une Skill performante : structure, instructions, exemples" },
        {
          titre:
            "Atelier pratique guidé : chaque participant crée une Skill complète sur un cas récurrent de son métier",
        },
        {
          titre:
            "Comprendre et activer les connecteurs pour relier Claude à ses outils métiers (Google Drive, Gmail, Calendar…)",
        },
        {
          titre:
            "Atelier pratique : construire un projet Claude complet, avec Skills et connecteurs activés",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Pack de plus de 50 Skills Claude prêtes à l\'emploi + guide des connecteurs + la Skill créée par chaque participant",
        },
      ],
    },
    {
      titreFr: "Module 4 — Produire ses supports professionnels avec Claude",
      steps: [
        { titre: "Générer des documents, visuels et présentations directement avec Claude" },
        {
          titre:
            "Appliquer sa charte graphique et garder une cohérence visuelle d\'un support à l\'autre",
        },
        {
          titre:
            "Exercice pratique : chaque participant produit un support complet sur un cas réel de son métier",
        },
        { titre: "Décliner et finaliser ses supports pour une mise en production" },
        { titre: "Construire sa feuille de route Claude pour la suite, et bilan de la journée" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Tutoriel et pack de prompts dédiés à la création de supports + trame de feuille de route",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il déjà savoir utiliser l\'IA pour participer ?",
      reponse:
        "Oui. Cette formation s\'adresse à des collaborateurs ayant déjà une pratique régulière de l\'IA générative ; elle n\'est pas conçue pour des débutants complets. Un compte Claude Pro (ou supérieur) est requis, car les connecteurs et les Skills ne sont pas disponibles en version gratuite.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance via Microsoft Teams. Le contenu, les démonstrations et les ateliers sont identiques dans les deux formats, chacun travaillant sur son propre poste.",
    },
    {
      question: "Que repartent construire les participants concrètement ?",
      reponse:
        "Chaque participant repart avec son compte Claude entièrement paramétré et sécurisé, une Skill métier créée pendant la session, un projet connecté à ses outils, un support professionnel finalisé et une feuille de route Claude pour la suite.",
    },
  ],
};

const CLAUDE_MAITRISE_AVANCEE_2J: FormationV2 = {
  id: "claude-maitrise-avancee-et-autonomie-2j",
  slugFr: "claude-maitrise-avancee-et-autonomie-2j",
  slugEn: "claude-advanced-mastery-autonomy-2d",
  numero: 6,
  gamme: "claude",
  duree: "2j",
  surDevis: true,
  titreFr: "Claude — Maîtrise avancée & autonomie",
  accrocheFr:
    "L'IA sans le stress — 2 jours pour déployer un environnement Claude opérationnel, sans dépendre d'outils tiers",
  h1Fr: "Formation Claude avancée : maîtrise et autonomie en entreprise (2 jours)",
  metaTitleFr: "Formation Claude avancée & autonomie — 2j | Axion-IA",
  metaDescriptionFr:
    "Formation Claude avancée, 2 jours : Projects, Skills, connecteurs et Cowork. Déployez plusieurs assistants, un prototype et des tâches automatisées.",
  termesSemantiquesFr: [
    "formation Claude avancée",
    "Claude Skills et connecteurs",
    "Claude Projects",
    "Claude Cowork",
    "prototypage outil métier avec Claude",
    "méthode AXION",
    "assistant IA connecté",
  ],
  publicViseFr:
    "Équipes ayant déjà suivi une formation Axion-IA (débutant ou productivité), ou disposant d'une pratique confirmée de l'IA générative, et souhaitant déployer un environnement Claude complet et opérationnel pour leur métier. Cette formation ne s'adresse pas à des débutants complets.",
  prerequisFr:
    "Avoir suivi une formation Axion-IA de niveau débutant ou productivité, ou disposer d'une pratique confirmée de l'IA générative. Chaque participant doit disposer d'un ordinateur et d'un compte Claude Pro (ou supérieur) : les fonctionnalités avancées travaillées pendant ces 2 jours (connecteurs, Cowork) nécessitent un plan payant.",
  casUsageFr: [
    {
      texteFr: "Déployer plusieurs assistants spécialisés pour son équipe",
      imageSrc:
        "/illustrations/formations/fiches/claude-maitrise-avancee-et-autonomie-2j/cas-1.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Créer des Skills réutilisables pour standardiser les productions",
      imageSrc:
        "/illustrations/formations/fiches/claude-maitrise-avancee-et-autonomie-2j/cas-2.webp",
      imageCredit: {
        name: "Creatopy",
        url: "https://unsplash.com/@creatopy?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Construire un prototype fonctionnel sans écrire de code",
      imageSrc:
        "/illustrations/formations/fiches/claude-maitrise-avancee-et-autonomie-2j/cas-3.webp",
      imageCredit: {
        name: "AllGo - An App For Plus Size People",
        url: "https://unsplash.com/@canweallgo?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Automatiser des tâches multi-étapes de bout en bout",
      imageSrc:
        "/illustrations/formations/fiches/claude-maitrise-avancee-et-autonomie-2j/cas-4.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Maîtriser les fonctionnalités avancées de Claude : Projects, Skills et connecteurs",
    "Créer et déployer plusieurs assistants IA opérationnels, connectés à ses outils métiers",
    "Prototyper un outil métier complet avec Claude, du brief au livrable fonctionnel, sans développeur ni plateforme tierce",
    "Déléguer plusieurs tâches complexes à Claude Cowork en autonomie, y compris des tâches planifiées et récurrentes",
    "Repartir avec un environnement Claude opérationnel — plusieurs assistants, un prototype, des tâches automatisées — et non de simples notes de formation",
    "Construire une feuille de route de déploiement à 3 mois pour généraliser ces usages à toute l'équipe",
  ],
  beneficeDirigeantFr:
    "En 2 jours, l'équipe repart avec un environnement Claude réellement opérationnel — assistants connectés, prototype métier et tâches automatisées — et une feuille de route à 3 mois pour généraliser ces usages, sans dépendre d'aucun outil tiers.",
  equationTempsFr:
    "2 jours intensifs → un environnement Claude complet (Skills, projets connectés, prototype, tâches Cowork) construit par chaque participant, prêt à être déployé dès le retour au poste.",
  programme: [
    {
      titreFr: "Jour 1 · Module 1 — Maîtriser le prompt et les Artifacts dans Claude",
      steps: [
        {
          titre:
            "Les spécificités de Claude : forces, limites, cas d'usage où il fait la différence",
        },
        {
          titre:
            "La méthode AXION appliquée à Claude (Acteur, conteXte, Intention, Output, Normes) et les techniques avancées de prompt",
        },
        {
          titre:
            "Exploiter les Artifacts pour produire des documents structurés et des visualisations",
        },
        {
          titre:
            "Exercices pratiques : rédaction, analyse, synthèse et création de contenus sur des cas réels",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide du prompt Claude + bibliothèque de plus de 500 prompts AXION classés par métier",
        },
      ],
    },
    {
      titreFr: "Jour 1 · Module 2 — Paramétrer, sécuriser et personnaliser Claude",
      steps: [
        {
          titre:
            "Créer et sécuriser son compte : paramètres de confidentialité, données et entraînement",
        },
        { titre: "Paramétrer la mémoire, les préférences et les styles de réponse personnalisés" },
        {
          titre:
            "Choisir le bon modèle Claude selon le cas d'usage : rapidité, profondeur de raisonnement, coût",
        },
        {
          titre:
            "Sécuriser ses usages à l'échelle de l'équipe : RGPD, IA Act, gouvernance des données sensibles",
        },
        {
          titre:
            "Atelier pratique guidé : chaque participant paramètre entièrement son compte Claude pour son métier",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide complet de paramétrage Claude + charte IA entreprise + guide de gouvernance",
        },
      ],
    },
    {
      titreFr: "Jour 1 · Module 3 — Créer ses Skills et connecter Claude à ses outils",
      steps: [
        { titre: "Projects et Skills Claude : à quoi ça sert, quand utiliser l'un ou l'autre" },
        { titre: "Anatomie d'une Skill performante : structure, instructions, exemples" },
        {
          titre:
            "Atelier pratique guidé : chaque participant crée une Skill complète sur un cas récurrent de son métier",
        },
        {
          titre:
            "Comprendre et activer les connecteurs pour relier Claude à ses outils métiers (Google Drive, Gmail, Calendar…)",
        },
        {
          titre:
            "Atelier pratique approfondi : construire un projet Claude complet, avec Skills et connecteurs activés",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Pack de plus de 50 Skills Claude prêtes à l'emploi + guide des connecteurs + la Skill créée par chaque participant",
        },
      ],
    },
    {
      titreFr: "Jour 1 · Module 4 — Produire ses supports professionnels avec Claude",
      steps: [
        { titre: "Générer des documents, visuels et présentations directement avec Claude" },
        {
          titre:
            "Appliquer sa charte graphique et garder une cohérence visuelle d'un support à l'autre",
        },
        {
          titre:
            "Exercice pratique : chaque participant produit un support complet sur un cas réel de son métier",
        },
        { titre: "Décliner et finaliser ses supports pour une mise en production" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Tutoriel et pack de prompts dédiés à la création de supports",
        },
      ],
    },
    {
      titreFr: "Jour 2 · Module 5 — Prototyper rapidement avec Claude",
      steps: [
        {
          titre:
            "Reprise du jour 1 : consolidation des acquis, retour sur les Skills et projets construits, questions ouvertes",
        },
        { titre: "Du brief au livrable : la méthode pour cadrer un besoin avant de le construire" },
        {
          titre:
            "Prototyper un outil métier avec Claude : formulaire, tableau de bord, calculateur, outil de suivi",
        },
        {
          titre:
            "Atelier pratique approfondi : chaque participant (ou binôme) construit un outil réel pour son équipe, du brief au livrable fonctionnel",
        },
        {
          titre: "Itérer et améliorer son prototype à partir des retours du formateur et du groupe",
        },
        { titre: "Les limites à connaître : quand passer la main à un développeur" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide de prototypage avec Claude + bibliothèque d'exemples + le prototype fonctionnel construit par chaque participant",
        },
      ],
    },
    {
      titreFr: "Jour 2 · Module 6 — Déléguer ses tâches complexes avec Claude Cowork",
      steps: [
        {
          titre: "Aller plus loin que l'assistant : confier une tâche complète à un agent autonome",
        },
        {
          titre:
            "Cas d'usage à fort potentiel par métier : tri et organisation de fichiers, synthèse de documents, rapports récurrents, veille",
        },
        {
          titre:
            "Atelier pratique approfondi : chaque participant configure et lance au moins deux tâches Cowork réelles sur son propre travail",
        },
        {
          titre:
            "Automatiser une tâche récurrente : programmer une tâche planifiée avec Cowork (ex. digest hebdomadaire)",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide Claude Cowork + bibliothèque de tâches types + les tâches configurées par chaque participant",
        },
      ],
    },
    {
      titreFr: "Jour 2 · Module 7 — Construire son plan de déploiement et conclure",
      steps: [
        {
          titre:
            "Consolider son environnement Claude : ce que l'équipe a construit en 2 jours (Skills, projets connectés, supports, prototype, tâches Cowork)",
        },
        {
          titre: "Méthode pour prioriser et séquencer le déploiement à l'échelle de toute l'équipe",
        },
        {
          titre:
            "Chacun construit sa feuille de route de déploiement à 3 mois, avec jalons concrets",
        },
        {
          titre:
            "Partage collectif : chaque participant présente en 2 minutes ce qu'il a construit pendant ces 2 jours",
        },
        { titre: "Bilan des 2 jours et temps de questions ouvertes" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Trame de feuille de route de déploiement + synthèse personnalisée de l'ensemble des livrables construits pendant la formation",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il déjà savoir utiliser l'IA pour suivre cette formation ?",
      reponse:
        "Oui. Cette formation avancée s'adresse à des équipes ayant déjà suivi une formation Axion-IA de niveau débutant ou productivité, ou disposant d'une pratique confirmée de l'IA générative. Elle ne convient pas à des débutants complets.",
    },
    {
      question: "Un compte Claude payant est-il nécessaire ?",
      reponse:
        "Oui. Chaque participant doit disposer d'un ordinateur et d'un compte Claude Pro (ou supérieur) : les fonctionnalités avancées travaillées pendant ces 2 jours, comme les connecteurs et Cowork, ne sont pas disponibles en version gratuite.",
    },
    {
      question: "Que repart-on concrètement avec, à l'issue des 2 jours ?",
      reponse:
        "Un environnement Claude réellement opérationnel construit par vos soins : plusieurs assistants et Skills, un projet connecté à vos outils, un prototype métier fonctionnel, des tâches Cowork automatisées, et une feuille de route de déploiement à 3 mois — pas de simples notes de formation.",
    },
  ],
};

const CLAUDE_CODE_PROJET_3J: FormationV2 = {
  id: "claude-code-creer-un-projet-3j",
  slugFr: "claude-code-creer-un-projet-3j",
  slugEn: "claude-code-build-a-project-3d",
  numero: 7,
  gamme: "claude",
  duree: "3j",
  surDevis: true,
  // Programme : « Groupe volontairement limité à 10 participants : chacun
  // construit son propre projet » → jauge plus basse que le défaut, assumée.
  effectifFr: "Jusqu’à 10 participants",
  outilsFr:
    "Vous pratiquez Claude Code (Anthropic) pendant les trois jours, pour construire votre propre projet de bout en bout — sans écrire de code.",
  titreFr: "Claude Code — créer un projet de bout en bout",
  accrocheFr:
    "L\'IA sans le stress — 3 jours pour concevoir, construire et publier un vrai projet, même sans savoir coder",
  h1Fr: "Formation Claude Code : créer un projet de bout en bout, sans coder (3 jours)",
  metaTitleFr: "Formation Claude Code sans coder — 3 jours | Axion-IA",
  metaDescriptionFr:
    "Formation Claude Code, 3 jours, pour profils non techniques : concevoir, construire et publier un vrai projet de bout en bout sans écrire de code. Présentiel.",
  termesSemantiquesFr: [
    "formation Claude Code",
    "agent de code sans coder",
    "créer un projet sans savoir coder",
    "méthode AXION",
    "CLAUDE.md et skills",
    "publier un projet en ligne",
  ],
  publicViseFr:
    "Toute personne qui a besoin d\'un outil et ne sait pas coder : chargé de projet, responsable métier, indépendant, dirigeant de petite structure, assistant, chargé d\'études. Cette formation s\'adresse aux profils non techniques — elle n\'est pas conçue pour des développeurs confirmés, qui y trouveraient un rythme trop lent. Elle est dispensée en intra-entreprise, en groupe unique par société, autour d\'un projet fil rouge universel : un outil interne de suivi de demandes, construit du premier au dernier jour.",
  prerequisFr:
    "Aucune compétence en programmation ni connaissance préalable de l\'IA. Il faut simplement être à l\'aise avec un ordinateur : installer un logiciel, organiser des fichiers, naviguer sur le web. Chaque participant dispose de son ordinateur de travail avec les droits d\'installation. Trois comptes doivent être opérationnels avant le premier jour : un abonnement Claude payant (Pro ou Max), Claude Code n\'existant pas en version gratuite ; un compte GitHub gratuit pour conserver le projet ; un compte d\'hébergement web gratuit pour le publier le troisième jour. La liste des hébergeurs compatibles est transmise en amont, et un accompagnement à la création des comptes est prévu si besoin.",
  casUsageFr: [
    {
      texteFr: "Concevoir un outil interne sur mesure, sans écrire de code",
      imageSrc: "/illustrations/formations/fiches/claude-code-creer-un-projet-3j/cas-1.webp",
      imageCredit: {
        name: "Hal Gatewood",
        url: "https://unsplash.com/@halacious?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Construire écran par écran, en dialoguant en français",
      imageSrc: "/illustrations/formations/fiches/claude-code-creer-un-projet-3j/cas-2.webp",
      imageCredit: {
        name: "AllGo - An App For Plus Size People",
        url: "https://unsplash.com/@canweallgo?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Tester et faire corriger son application comme un chef de projet",
      imageSrc: "/illustrations/formations/fiches/claude-code-creer-un-projet-3j/cas-3.webp",
      imageCredit: {
        name: "Štefan Štefančík",
        url: "https://unsplash.com/@cikstefan?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Publier un outil que toute l'équipe utilise",
      imageSrc: "/illustrations/formations/fiches/claude-code-creer-un-projet-3j/cas-4.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Comprendre ce qu\'est un agent de code et ce qu\'il peut faire à sa place, sans jargon technique",
    "Installer Claude Code et choisir la surface adaptée à son niveau (application de bureau, web, terminal)",
    "Décrire un besoin à un agent de code pour obtenir un résultat exploitable, grâce à la méthode AXION",
    "Concevoir et construire un projet complet de bout en bout, sans écrire une ligne de code soi-même",
    "Donner ses règles à l\'agent avec un fichier CLAUDE.md",
    "Créer un skill pour automatiser une tâche qui revient sur son projet",
    "Publier son projet en ligne et le faire évoluer dans le temps",
    "Reconnaître les limites : ce qu\'on peut faire seul, et quand il faut appeler un développeur",
  ],
  beneficeDirigeantFr:
    "Vos profils non techniques repartent avec un vrai outil interne construit et publié de leurs mains, et la capacité de créer les suivants — au lieu d\'attendre une file de développement pour chaque petit besoin métier.",
  equationTempsFr:
    "3 jours → chaque participant conçoit, construit et met en ligne un outil de suivi de demandes fonctionnel, et repart avec la méthode pour créer le suivant en autonomie.",
  programme: [
    {
      titreFr: "Module 1 — Ce qu\'est un agent de code, et ce qu\'il change",
      steps: [
        {
          titre:
            "La différence entre un chat, un assistant et un agent : pourquoi Claude Code n\'est pas un ChatGPT qui écrit du code",
        },
        {
          titre:
            "Ce qu\'il fait concrètement à votre place : il lit, il écrit des fichiers, il exécute des commandes, il corrige ses erreurs",
        },
        { titre: "Ce que ça ouvre pour quelqu\'un qui ne code pas — et ce que ça n\'ouvre pas" },
        {
          titre:
            "Le vocabulaire minimum, expliqué simplement : projet, fichier de code, version, dépôt, hébergement, mise en ligne",
        },
        { titre: "Le parcours des 3 jours : de l\'idée au projet publié, étape par étape" },
        { titre: "QCM de validation des acquis" },
        { temps: "Livrable", titre: "Lexique illustré des notions essentielles, sans jargon" },
      ],
    },
    {
      titreFr: "Module 2 — Installer et prendre en main",
      steps: [
        {
          titre:
            "Les surfaces disponibles : application de bureau, web, terminal, extensions pour éditeurs — laquelle pour qui",
        },
        {
          titre:
            "Pourquoi les profils non techniques commencent par l\'application de bureau, et non par le terminal",
        },
        {
          titre:
            "Atelier : chaque participant installe Claude Code, se connecte et lance sa première session",
        },
        {
          titre:
            "Permissions : ce que l\'agent demande, ce qu\'on autorise, ce qu\'on refuse — et pourquoi ça compte",
        },
        {
          titre:
            "Premiers échanges : se faire expliquer un fichier, demander une modification simple, annuler",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Guide d\'installation pas à pas + checklist de configuration",
        },
      ],
    },
    {
      titreFr: "Module 3 — Du besoin au premier écran qui fonctionne",
      steps: [
        {
          titre:
            "Cadrer le projet fil rouge : ce que l\'outil doit faire, pour qui, avec quelles données",
        },
        {
          titre:
            "Écrire un brief que l\'agent comprend : la méthode AXION appliquée à un projet (Acteur, conteXte, Intention, Output, Normes)",
        },
        {
          titre:
            "Le mode plan : faire décrire à l\'agent ce qu\'il va faire, avant qu\'il ne le fasse — le réflexe qui évite les mauvaises surprises",
        },
        {
          titre:
            "Atelier : chaque participant obtient une première version de l\'outil, qui tourne sur son poste",
        },
        {
          titre:
            "Ce qu\'il faut accepter : la première version est imparfaite, c\'est normal et c\'est le principe",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Trame de brief projet + le premier écran fonctionnel de chaque participant",
        },
      ],
    },
    {
      titreFr: "Module 4 — Ajouter les fonctionnalités, une par une",
      steps: [
        { titre: "Reprise du jour 1 : questions ouvertes, retour sur les premières versions" },
        {
          titre:
            "La méthode : une demande = une fonctionnalité, on vérifie, on garde, on passe à la suivante",
        },
        {
          titre:
            "Atelier : formulaire de saisie, liste des demandes, suivi de l\'avancement, tableau de bord",
        },
        {
          titre:
            "Savoir dire non à l\'agent : reconnaître une réponse qui part de travers et la rattraper",
        },
        {
          titre:
            "Sauvegarder son travail sur GitHub : enregistrer les versions au fil de l\'eau et revenir en arrière quand c\'est nécessaire",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Guide des bons réflexes de construction + l\'outil enrichi de chaque participant",
        },
      ],
    },
    {
      titreFr: "Module 5 — Donner ses règles à l\'agent avec CLAUDE.md",
      steps: [
        {
          titre:
            "Ce que l\'agent lit au démarrage de chaque session, et pourquoi c\'est déterminant",
        },
        {
          titre:
            "Écrire ses règles en français : à quoi ressemble le projet, ce qu\'on veut, ce qu\'on ne veut pas",
        },
        {
          titre:
            "La mémoire automatique : ce que l\'agent retient de lui-même d\'une session à l\'autre",
        },
        {
          titre:
            "Atelier : chaque participant rédige le CLAUDE.md du projet et constate la différence sur la demande suivante",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Modèle de CLAUDE.md commenté + le fichier rédigé par chaque participant",
        },
      ],
    },
    {
      titreFr: "Module 6 — Vérifier, corriger, fiabiliser",
      steps: [
        { titre: "Comment savoir si ça marche vraiment quand on ne sait pas lire le code" },
        { titre: "Faire écrire les tests à l\'agent, et les faire tourner" },
        {
          titre:
            "Quand ça casse : décrire le problème, faire chercher la cause, valider le correctif",
        },
        { titre: "Atelier : chacun casse volontairement son projet, puis le répare avec l\'agent" },
        { titre: "QCM de validation des acquis" },
        { temps: "Livrable", titre: "Guide de dépannage pour non-codeurs" },
      ],
    },
    {
      titreFr: "Module 7 — Automatiser ce qui revient avec les skills",
      steps: [
        { titre: "Reprise du jour 2 : état des projets, questions ouvertes" },
        { titre: "Les skills : empaqueter une consigne qui revient pour la rejouer d\'un mot" },
        { titre: "Les cas qui en valent la peine, et ceux où ça ne sert à rien" },
        { titre: "Atelier : chaque participant crée un skill utile pour son projet" },
        {
          titre:
            "Aperçu de ce qui existe au-delà : connecter l\'agent à d\'autres outils, faire travailler plusieurs agents — pour savoir que ça existe, sans entrer dedans",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Pack de skills prêts à l\'emploi + le skill créé par chaque participant",
        },
      ],
    },
    {
      titreFr: "Module 8 — Publier son projet en ligne",
      steps: [
        {
          titre:
            "Ce que signifie « mettre en ligne », expliqué simplement : hébergement, adresse, mise à jour",
        },
        {
          titre:
            "Atelier : chaque participant publie son outil et obtient une adresse qui fonctionne",
        },
        { titre: "Mettre à jour la version en ligne après une modification" },
        {
          titre:
            "Les questions à se poser avant de laisser d\'autres personnes l\'utiliser : données personnelles, accès, sauvegardes",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Guide de mise en ligne + le projet publié de chaque participant",
        },
      ],
    },
    {
      titreFr: "Module 9 — Faire vivre son projet, et connaître ses limites",
      steps: [
        {
          titre:
            "Reprendre un projet des semaines plus tard : ce qu\'il faut avoir écrit pour s\'y retrouver",
        },
        {
          titre:
            "Sécurité et données : ce qu\'on ne confie jamais à un outil qu\'on a bâti soi-même en 3 jours",
        },
        {
          titre:
            "Où s\'arrête le raisonnable : les signes qui indiquent qu\'il faut passer la main à un développeur",
        },
        {
          titre:
            "Chacun construit sa feuille de route : le prochain outil à créer, et par quoi commencer",
        },
        {
          titre:
            "Partage collectif : chaque participant présente ce qu\'il a construit, et bilan des 3 jours",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Guide « faire vivre son projet » + trame de feuille de route personnalisable",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il savoir coder pour suivre cette formation ?",
      reponse:
        "Non. Elle est conçue pour des profils non techniques : vous décrivez votre besoin en français à l\'agent, qui écrit le code à votre place. Aucune compétence en programmation ni connaissance préalable de l\'IA n\'est requise — il faut simplement être à l\'aise avec un ordinateur.",
    },
    {
      question: "Quels comptes faut-il prévoir avant le premier jour ?",
      reponse:
        "Trois comptes doivent être opérationnels : un abonnement Claude payant (Pro ou Max), car Claude Code n\'existe pas en version gratuite ; un compte GitHub gratuit pour conserver le projet ; un compte d\'hébergement web gratuit pour le publier. Nous transmettons la liste des hébergeurs compatibles en amont et accompagnons la création des comptes si besoin, avec un point de vérification avant la session.",
    },
    {
      question: "Que construit-on concrètement pendant les 3 jours ?",
      reponse:
        "Tous les participants bâtissent le même projet fil rouge : un outil interne de suivi de demandes — saisie, liste, suivi de l\'avancement, tableau de bord. C\'est un cas volontairement universel, valable dans tout secteur. Le troisième jour, chacun publie son outil en ligne et repart avec une adresse qui fonctionne et la méthode pour créer le suivant.",
    },
  ],
};

const IA_ACT_CONFORMITE_7H: FormationV2 = {
  id: "ia-act-conformite-et-securite-7h",
  slugFr: "ia-act-conformite-et-securite-7h",
  slugEn: "ai-act-compliance-security-7h",
  numero: 8,
  gamme: "ia-standard",
  duree: "1j",
  surDevis: true,
  prerequisFr:
    "Aucun prérequis technique ni juridique. Une première utilisation de ChatGPT, Claude ou Gemini est un plus mais n'est pas indispensable. Pour l'exercice pratique du module 3, disposer d'un ordinateur et d'un compte Claude gratuit (création en quelques clics, sans carte bancaire).",
  titreFr: "IA Act — Conformité & sécurité de vos usages",
  accrocheFr:
    "L'IA sans le stress — cartographiez vos usages, sécurisez vos données et repartez avec votre feuille de route de mise en conformité IA Act, en une journée",
  h1Fr: "Formation IA Act : conformité et sécurité des usages IA en entreprise (1 jour)",
  metaTitleFr: "Formation IA Act : conformité & sécurité — 1 jour | Axion-IA",
  metaDescriptionFr:
    "Formation IA Act d'1 jour : comprendre le calendrier et les obligations, cartographier vos usages par niveau de risque et sécuriser vos données sensibles.",
  termesSemantiquesFr: [
    "formation IA Act",
    "conformité IA entreprise",
    "littératie IA article 4",
    "niveaux de risque IA Act",
    "sécurité IA générative RGPD",
    "cartographie des usages IA",
    "méthode AXION",
    "référent IA",
  ],
  publicViseFr:
    "Dirigeants, managers, référents IA et toute personne impliquée dans le déploiement, la supervision ou la conformité de l'IA en entreprise. Formation également adaptée aux collaborateurs utilisateurs souhaitant comprendre le cadre légal de leurs pratiques IA au quotidien.",
  casUsageFr: [
    {
      texteFr: "Cartographier ses usages IA par niveau de risque",
      imageSrc: "/illustrations/formations/fiches/ia-act-conformite-et-securite-7h/cas-1.webp",
      imageCredit: {
        name: "Redd Francisco",
        url: "https://unsplash.com/@reddfrancisco?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Mettre sa charte IA et ses procédures en conformité",
      imageSrc: "/illustrations/formations/fiches/ia-act-conformite-et-securite-7h/cas-2.webp",
      imageCredit: {
        name: "Md Ishak Rahman",
        url: "https://unsplash.com/@mdishakrahman?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Sécuriser les données confiées aux outils d'IA",
      imageSrc: "/illustrations/formations/fiches/ia-act-conformite-et-securite-7h/cas-3.webp",
      imageCredit: {
        name: "Sasun Bughdaryan",
        url: "https://unsplash.com/@sasun1990?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Bâtir une feuille de route conformité sans freiner l'innovation",
      imageSrc: "/illustrations/formations/fiches/ia-act-conformite-et-securite-7h/cas-4.webp",
      imageCredit: {
        name: "Headway",
        url: "https://unsplash.com/@headwayio?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Comprendre le calendrier et les obligations de l'IA Act applicables à son entreprise, notamment l'échéance du 2 août 2026",
    "Identifier les risques et les bonnes pratiques de sécurité liés à l'usage de l'IA générative (RGPD, fuite de données, hallucinations)",
    "Cartographier les usages IA de son entreprise et les classer selon leur niveau de risque",
    "Comprendre les principes d'un prompt efficace grâce à la méthode AXION",
    "Repartir avec une feuille de route opérationnelle de mise en conformité IA Act",
  ],
  beneficeDirigeantFr:
    "En une journée, vos décideurs et référents savent où se situe l'entreprise face à l'IA Act, ce qu'ils doivent faire avant l'échéance du 2 août 2026, et repartent avec une feuille de route de mise en conformité prête à exécuter — sans jargon juridique.",
  equationTempsFr:
    "1 jour → une cartographie de vos usages IA classés par niveau de risque, une charte de sécurité et une feuille de route de conformité opérationnelle, applicables dès la semaine suivante.",
  programme: [
    {
      titreFr: "Module 1 — Maîtriser l'IA générative et sécuriser ses usages",
      steps: [
        {
          titre:
            "Fonctionnement des IA génératives expliqué simplement : principes probabilistes, notion de token, capacités et limites réelles",
        },
        {
          titre:
            "Panorama des IA génératives du marché : ChatGPT, Claude, Gemini, Copilot — ce qui les distingue",
        },
        {
          titre:
            "Les risques majeurs de l'IA en entreprise : hallucinations, biais, fuite de données, dépendance excessive",
        },
        {
          titre:
            "Sécuriser ses usages : RGPD, entraînement des modèles, ce qu'on ne doit jamais soumettre à une IA (données clients, données RH, secrets d'affaires)",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Charte IA entreprise + guide des bonnes pratiques et de sécurité",
        },
      ],
    },
    {
      titreFr: "Module 2 — Comprendre l'IA Act et ses obligations",
      steps: [
        {
          titre:
            "L'IA Act : calendrier d'application, niveaux de risque, acteurs concernés (fournisseur, déployeur, distributeur)",
        },
        {
          titre:
            "Le « Digital Omnibus » (adopté le 29 juin 2026) : les obligations liées aux systèmes à haut risque (Annexe III) sont reportées au 2 décembre 2027",
        },
        {
          titre:
            "Ce qui ne bouge pas : l'obligation de littératie IA (article 4, en vigueur depuis février 2025) et les obligations de transparence (article 50) restent pleinement applicables, avec activation des pouvoirs de sanction des autorités nationales dès le 2 août 2026",
        },
        {
          titre:
            "Cartographier ses usages IA internes et les classer selon les 4 niveaux de risque de l'IA Act",
        },
        { titre: "Construire sa feuille de route de mise en conformité" },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Outil de diagnostic de conformité IA Act Axion-IA (grille d'auto-évaluation)",
        },
      ],
    },
    {
      titreFr: "Module 3 — Bien utiliser l'IA au quotidien : la méthode AXION",
      steps: [
        {
          titre: "La méthode AXION en 5 mots simples : Acteur, conteXte, Intention, Output, Normes",
        },
        {
          titre:
            "Démonstration comparative : un même prompt AXION exécuté en direct sur ChatGPT, Claude et Gemini",
        },
        {
          titre:
            "Exercice oral collectif : chacun formule à voix haute un prompt AXION sur un cas réel de son métier, le groupe l'affine ensemble",
        },
        {
          titre:
            "Exercice pratique guidé : chaque participant crée son propre assistant sur Claude Projects — le formateur guide tout le groupe simultanément, étape par étape",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de plus de 500 prompts AXION classés par métier + kits assistants IA (ChatGPT, Claude et Gemini)",
        },
      ],
    },
    {
      titreFr: "Module 4 — Sécuriser ses cas d'usage et piloter sa conformité dans la durée",
      steps: [
        { titre: "Les cas d'usage à privilégier ou à éviter selon le niveau de risque IA Act" },
        { titre: "Désigner un référent IA en interne : rôle et responsabilités" },
        {
          titre:
            "Étude de cas commentée : le formateur illustre la méthode sur des exemples concrets proposés par le groupe",
        },
        { titre: "Construire sa feuille de route de conformité et de déploiement IA à 6 mois" },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Guide des cas d'usage sécurisés + trame de feuille de route de conformité IA Act",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il des connaissances juridiques ou techniques pour suivre cette formation ?",
      reponse:
        "Non. Aucun prérequis technique ni juridique n'est nécessaire. Chaque notion — obligations de l'IA Act, niveaux de risque, règles de sécurité — est expliquée sans jargon avant d'être illustrée sur des cas concrets et transversaux.",
    },
    {
      question:
        "Quelle est l'échéance du 2 août 2026 et cette formation aide-t-elle à s'y préparer ?",
      reponse:
        "À partir du 2 août 2026, les autorités nationales activent leurs pouvoirs de sanction sur les obligations déjà en vigueur, notamment la littératie IA (article 4) et la transparence (article 50). La formation clarifie ce qui reste dû malgré le report des systèmes à haut risque, et vous fait repartir avec une feuille de route de mise en conformité.",
    },
    {
      question: "Présentiel ou distanciel, et que repartent faire les participants ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance via Microsoft Teams, avec le même contenu et le même niveau d'interactivité. Chacun repart avec une cartographie de ses usages IA par niveau de risque, une charte de sécurité, la méthode AXION, son assistant créé en séance et une feuille de route de conformité.",
    },
  ],
};

const REFERENT_IA_GOUVERNANCE_7H: FormationV2 = {
  id: "referent-ia-piloter-gouvernance-ia-7h",
  slugFr: "referent-ia-piloter-gouvernance-ia-7h",
  slugEn: "ai-officer-governance-7h",
  numero: 9,
  gamme: "ia-standard",
  duree: "1j",
  surDevis: true,
  // Programme : « Groupe : 2 à 6 participants » (noyau gouvernance).
  effectifFr: "2 à 6 participants",
  // Ateliers documentaires : le conducteur précise « Pas de démonstration d'outil
  // dans cette formation » et « n'exige aucun compte IA ».
  outilsFr:
    "Aucun compte ni outil IA n’est requis : les ateliers portent sur vos documents de gouvernance (politique d’usage, registre, procédures), à partir de trames fournies.",
  titreFr: "Référent IA — Piloter la gouvernance de l'IA",
  accrocheFr:
    "L'IA sans le stress — outiller la personne qui porte le sujet IA dans votre entreprise, en une journée",
  h1Fr: "Formation Référent IA : piloter la gouvernance de l'IA en entreprise (1 jour)",
  metaTitleFr: "Formation Référent IA — gouvernance de l'IA, 1 jour | Axion-IA",
  metaDescriptionFr:
    "Formation référent IA (1 jour) : cartographier les usages, construire charte et procédures, piloter la conformité et animer l'IA en interne. En petit groupe.",
  termesSemantiquesFr: [
    "formation référent IA",
    "gouvernance de l'IA en entreprise",
    "cartographie des usages IA",
    "charte IA",
    "shadow AI",
    "littératie IA",
    "plan d'action IA",
  ],
  publicViseFr:
    "Le noyau gouvernance IA de l'entreprise : la personne désignée comme référent IA, accompagnée le cas échéant du DPO, du responsable informatique, d'un représentant RH et d'un membre de la direction. En pratique, un groupe de 2 à 6 personnes suffit — il ne s'agit pas de former toute une équipe, mais celles et ceux qui portent le sujet.",
  prerequisFr:
    "Avoir suivi la formation Axion-IA « IA Act — Conformité & sécurité de vos usages », ou disposer d'une connaissance équivalente du cadre réglementaire : cette formation ne réexplique pas l'IA Act, elle apprend à le faire vivre au quotidien. Aucun prérequis technique. Disposer d'un ordinateur pour les ateliers documentaires ; aucun compte IA n'est nécessaire.",
  casUsageFr: [
    {
      texteFr: "Cartographier les usages IA réels, service par service",
      imageSrc: "/illustrations/formations/fiches/referent-ia-piloter-gouvernance-ia-7h/cas-1.webp",
      imageCredit: {
        name: "1981 Digital",
        url: "https://unsplash.com/@1981digital?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Construire une charte et des procédures qui tiennent dans la durée",
      imageSrc: "/illustrations/formations/fiches/referent-ia-piloter-gouvernance-ia-7h/cas-2.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Constituer le dossier de preuves attendu en cas de contrôle",
      imageSrc: "/illustrations/formations/fiches/referent-ia-piloter-gouvernance-ia-7h/cas-3.webp",
      imageCredit: {
        name: "Zulfugar Karimov",
        url: "https://unsplash.com/@zulfugarkarimov?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Animer la démarche IA en interne et faire vivre les règles",
      imageSrc: "/illustrations/formations/fiches/referent-ia-piloter-gouvernance-ia-7h/cas-4.webp",
      imageCredit: {
        name: "Mapbox",
        url: "https://unsplash.com/@mapbox?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Définir le périmètre du rôle de référent IA et son articulation avec le DPO, l'informatique, les RH et la direction",
    "Cartographier les usages IA de l'entreprise, y compris ceux qui échappent au contrôle, et les classer par niveau de risque",
    "Construire le cadre interne : charte IA, liste des outils autorisés, procédure de validation d'un nouvel usage",
    "Piloter la conformité dans la durée : documentation à conserver, preuves à produire, veille réglementaire",
    "Animer le sujet IA en interne : répondre aux questions, traiter les résistances, mesurer les usages",
    "Repartir avec un plan d'action à 6 mois pour structurer la gouvernance IA de son entreprise",
  ],
  beneficeDirigeantFr:
    "Le noyau qui porte l'IA repart en une journée avec une gouvernance amorcée sur vos propres documents : cartographie des usages, charte, procédure de validation et plan d'action à 6 mois — de quoi cadrer l'IA sans freiner son adoption.",
  equationTempsFr:
    "1 journée de travail sur vos documents → une gouvernance IA structurée : usages cartographiés, cadre interne posé et feuille de route à 6 mois prête à dérouler.",
  programme: [
    {
      titreFr: "Module 1 — Le rôle de référent IA",
      steps: [
        {
          titre:
            "Pourquoi désigner un référent IA : non pas une obligation légale, mais une nécessité pratique dès que l'IA se diffuse dans l'entreprise",
        },
        {
          titre:
            "Le périmètre du rôle : ce qu'il porte, ce qu'il ne porte pas, ce qu'il ne peut pas décider seul",
        },
        {
          titre:
            "Articulation avec les autres fonctions : DPO, informatique, RH, direction — qui décide quoi",
        },
        {
          titre:
            "Le temps réellement nécessaire pour tenir ce rôle, et comment l'inscrire dans une fiche de poste",
        },
        {
          titre:
            "Atelier : rédiger la fiche de rôle du référent IA de l'entreprise et répartir les responsabilités",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Fiche de rôle référent IA + matrice de répartition des responsabilités",
        },
      ],
    },
    {
      titreFr: "Module 2 — Cartographier les usages IA de l'entreprise",
      steps: [
        {
          titre:
            "Passer d'une cartographie d'initiation à un inventaire exhaustif et tenu à jour : méthode de recensement, service par service",
        },
        {
          titre:
            "Le « shadow AI » : les usages non déclarés, pourquoi ils existent et comment les faire remonter sans sanctionner",
        },
        {
          titre:
            "Les cas limites de classification : quand un usage bascule d'un niveau de risque à un autre, et qui tranche",
        },
        {
          titre:
            "Repérer les usages à haut risque, notamment en RH (recrutement, évaluation, gestion des salariés)",
        },
        {
          titre:
            "Atelier : démarrer la cartographie réelle des usages IA de l'entreprise à partir de la trame fournie",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Modèle de cartographie des usages + grille de classification par niveau de risque",
        },
      ],
    },
    {
      titreFr: "Module 3 — Construire le cadre interne",
      steps: [
        {
          titre:
            "Rédiger et faire vivre la charte IA : ce qu'elle doit contenir, comment la faire accepter",
        },
        {
          titre:
            "Définir la liste des outils autorisés, et les critères pour évaluer un nouvel outil",
        },
        { titre: "Mettre en place une procédure simple de validation d'un nouvel usage" },
        {
          titre:
            "Données : ce qui ne doit jamais sortir de l'entreprise, articulation avec le RGPD et le DPO",
        },
        {
          titre:
            "Atelier : adapter la charte IA type et la procédure de validation au contexte de l'entreprise",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Charte IA + procédure de validation d'un nouvel usage + grille d'évaluation d'un outil",
        },
      ],
    },
    {
      titreFr: "Module 4 — Piloter la conformité dans la durée",
      steps: [
        {
          titre:
            "Transformer le calendrier de l'IA Act en échéances internes : qui fait quoi, pour quand, dans l'entreprise",
        },
        {
          titre:
            "Répondre à l'obligation de littératie IA et savoir le prouver : quelles actions, quelles traces",
        },
        {
          titre:
            "Documentation : ce qu'il faut conserver, sous quelle forme, et pendant combien de temps",
        },
        {
          titre:
            "Organiser sa veille réglementaire : où s'informer, à quel rythme, quoi surveiller",
        },
        { titre: "Atelier : construire le dossier de preuves de conformité de l'entreprise" },
        {
          titre:
            "Point d'actualité : le « Digital Omnibus » (adopté le 29 juin 2026) reporte au 2 décembre 2027 les obligations liées aux systèmes à haut risque ; la littératie IA et les obligations de transparence restent applicables (information à recontrôler avant chaque session)",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Plan de conformité + trame de dossier de preuves + sources de veille recommandées",
        },
      ],
    },
    {
      titreFr: "Module 5 — Animer l'IA en interne et construire son plan d'action",
      steps: [
        { titre: "Faire circuler les bonnes pratiques : formats simples qui fonctionnent en PME" },
        {
          titre:
            "Traiter les deux extrêmes : ceux qui refusent l'IA, et ceux qui l'utilisent sans aucune limite",
        },
        {
          titre:
            "Répondre aux questions du quotidien : construire sa « foire aux questions » interne",
        },
        { titre: "Mesurer les usages et les gains, et en rendre compte à la direction" },
        { titre: "Chacun construit son plan d'action à 6 mois, avec jalons concrets" },
        { titre: "Bilan de la journée et temps de questions ouvertes" },
        { titre: "QCM de validation des acquis" },
        { temps: "Livrable", titre: "Kit d'animation interne + trame de plan d'action à 6 mois" },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il déjà avoir désigné un référent IA pour participer ?",
      reponse:
        "Non, mais c'est l'occasion idéale de le faire. La formation s'adresse au noyau qui porte le sujet — référent IA pressenti, DPO, informatique, RH, direction — en groupe restreint de 2 à 6 personnes. On y clarifie précisément le périmètre du rôle et la répartition des responsabilités.",
    },
    {
      question: "Quels prérequis pour suivre cette journée ?",
      reponse:
        "Avoir suivi la formation Axion-IA « IA Act — Conformité & sécurité de vos usages » ou disposer d'une connaissance équivalente du cadre réglementaire : cette journée ne réexplique pas l'IA Act, elle apprend à le faire vivre au quotidien. Aucun prérequis technique, et aucun compte IA n'est nécessaire — les ateliers portent sur vos documents de gouvernance.",
    },
    {
      question: "Présentiel ou distanciel, et que repart-on avec ?",
      reponse:
        "Au choix : dans vos locaux ou entièrement à distance via Microsoft Teams, avec le même contenu et le même niveau d'interactivité. Chaque module comporte un atelier documentaire : l'entreprise repart avec ses propres documents amorcés — cartographie, charte, procédure de validation, dossier de preuves et plan d'action à 6 mois.",
    },
  ],
};

const IA_RH_7H: FormationV2 = {
  id: "ia-rh-recrutement-talents-7h",
  slugFr: "ia-rh-recrutement-talents-7h",
  slugEn: "ai-hr-recruitment-talent-7h",
  numero: 10,
  gamme: "ia-standard",
  duree: "1j",
  surDevis: true,
  titreFr: "IA RH — Recrutement & gestion des talents",
  accrocheFr:
    "L'IA au service des ressources humaines, en toute conformité — sourcing, annonces, onboarding et talents, en une journée",
  h1Fr: "Formation IA pour les ressources humaines et le recrutement (1 jour)",
  metaTitleFr: "Formation IA pour les RH et le recrutement — 1 jour | Axion-IA",
  metaDescriptionFr:
    "Formation IA RH, 1 jour : maîtriser le prompt RH avec la méthode AXION, respecter le cadre légal, créer un assistant RH et outiller sourcing et annonces.",
  termesSemantiquesFr: [
    "formation IA RH",
    "IA recrutement",
    "méthode AXION",
    "assistant IA RH",
    "sourcing IA",
    "IA Act ressources humaines",
    "human in the loop",
    "marque employeur IA",
  ],
  publicViseFr:
    "Professionnels des ressources humaines et du recrutement : responsables RH, chargés de recrutement, gestionnaires de carrière, responsables formation, ainsi que les dirigeants de PME qui assurent eux-mêmes la fonction RH.",
  prerequisFr:
    "Aucun prérequis technique. Une première utilisation de l'IA générative est un plus, mais n'est pas indispensable. Pour l'exercice pratique du module 3, chaque participant doit disposer d'un ordinateur et d'un compte Claude gratuit (création en quelques clics, sans carte bancaire).",
  casUsageFr: [
    {
      texteFr: "Rédiger des annonces attractives et conformes au cadre légal",
      imageSrc: "/illustrations/formations/fiches/ia-rh-recrutement-talents-7h/cas-1.webp",
      imageCredit: {
        name: "Markus Winkler",
        url: "https://unsplash.com/@markuswinkler?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Présélectionner objectivement avec des grilles de critères",
      imageSrc: "/illustrations/formations/fiches/ia-rh-recrutement-talents-7h/cas-2.webp",
      imageCredit: {
        name: "Resume Genius",
        url: "https://unsplash.com/@resumegenius?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Préparer entretiens et onboarding avec méthode",
      imageSrc: "/illustrations/formations/fiches/ia-rh-recrutement-talents-7h/cas-3.webp",
      imageCredit: {
        name: "Mina Rad",
        url: "https://unsplash.com/@miinrad?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Protéger les données personnelles des candidats et salariés",
      imageSrc: "/illustrations/formations/fiches/ia-rh-recrutement-talents-7h/cas-4.webp",
      imageCredit: {
        name: "Viktor Talashuk",
        url: "https://unsplash.com/@viktortalashuk?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Rédiger des prompts RH efficaces grâce à la méthode AXION",
    "Identifier les risques propres aux usages RH : biais de sélection, hallucinations, confidentialité des données candidats",
    "Comprendre pourquoi les usages RH relèvent des systèmes à haut risque de l'IA Act, et ce que cela implique concrètement",
    "Créer un assistant IA RH avec base de connaissances, prêt à être partagé avec son équipe",
    "Mobiliser l'IA sur les principaux cas d'usage RH : sourcing, annonces, candidatures, onboarding, formation, tâches administratives et marque employeur",
    "Identifier quand déléguer une tâche RH complète à un agent IA plutôt que d'écrire un prompt ponctuel",
    "Repartir avec une feuille de route de déploiement de l'IA dans son service",
  ],
  beneficeDirigeantFr:
    "En une journée, votre équipe RH maîtrise l'IA sur ses vrais cas d'usage — sourcing, annonces, onboarding, talents — tout en sachant où sont les limites légales et ce qui reste une décision humaine.",
  equationTempsFr:
    "1 jour de formation → une équipe RH qui outille ses tâches à fort volume, cadre ses usages sensibles et repart avec 3 à 5 actions concrètes à tester dès la semaine suivante.",
  programme: [
    {
      titreFr: "Module 1 — L'IA générative appliquée aux ressources humaines",
      steps: [
        {
          titre:
            "Fonctionnement de l'IA générative expliqué simplement, et ce qu'elle change concrètement pour les RH",
        },
        {
          titre:
            "Panorama des outils : ChatGPT, Claude, Gemini — ce qui les distingue et lequel choisir selon la tâche RH",
        },
        {
          titre:
            "La méthode AXION appliquée aux cas RH : Acteur, conteXte, Intention, Output, Normes",
        },
        {
          titre:
            "Les risques spécifiques aux RH : hallucinations, biais de sélection, confidentialité des données candidats et salariés",
        },
        {
          titre:
            "Exercices pratiques sur ChatGPT, Claude et Gemini, à partir de cas RH réels apportés par les participants",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide du prompt AXION pour les RH + bibliothèque de 50 prompts RH prêts à l'emploi",
        },
      ],
    },
    {
      titreFr: "Module 2 — Le cadre légal de l'IA en ressources humaines",
      steps: [
        {
          titre:
            "Pourquoi les RH sont la fonction la plus encadrée : recrutement, évaluation et gestion des salariés relèvent des systèmes à haut risque de l'IA Act (annexe III)",
        },
        {
          titre:
            "Ce que cela implique concrètement : information des candidats, supervision humaine, traçabilité des décisions",
        },
        {
          titre:
            "Le principe du « human in the loop » : ce que l'IA peut proposer, ce que seul un humain peut décider",
        },
        {
          titre:
            "RGPD et données candidats : durée de conservation, information, données à ne jamais soumettre à une IA",
        },
        {
          titre:
            "Prévenir la discrimination : comment un tri assisté par IA peut reproduire des biais, et comment s'en prémunir",
        },
        {
          titre:
            "Atelier collectif : cartographier ses usages RH actuels et repérer ceux qui relèvent du haut risque",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Grille de conformité des usages IA en RH + mémo « human in the loop »",
        },
      ],
    },
    {
      titreFr: "Module 3 — Créer ses assistants IA RH",
      steps: [
        {
          titre:
            "Architecture d'un assistant IA : instructions en français + base de connaissances, aucun code requis",
        },
        {
          titre:
            "Rédiger des instructions pour spécialiser un assistant sur une tâche RH récurrente",
        },
        {
          titre:
            "Atelier pratique guidé : chaque participant crée son assistant « offre d'emploi » sur Claude Projects, calibré sur la trame et le ton de son entreprise — le formateur guide tout le groupe simultanément",
        },
        {
          titre:
            "Créer un assistant d'onboarding : répondre aux questions récurrentes des nouveaux arrivants à partir du livret d'accueil",
        },
        { titre: "Partager un assistant avec son équipe RH et le faire évoluer dans le temps" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Plus de 20 assistants IA RH prêts à l'emploi + guide de paramétrage + l'assistant créé par chaque participant",
        },
      ],
    },
    {
      titreFr: "Module 4 — Les autres cas d'usage IA pour les RH",
      steps: [
        {
          titre:
            "Après les annonces et l'onboarding traités en atelier au module 3, panorama des autres usages à fort potentiel",
        },
        { titre: "Sourcing : rechercher et qualifier des profils grâce à la recherche augmentée" },
        {
          titre:
            "Candidatures : construire une grille de présélection objective et des trames d'entretien",
        },
        {
          titre: "Formation : construire des plans de développement des compétences individualisés",
        },
        {
          titre:
            "Administratif : synthèses de réunion, comptes-rendus d'entretien, courriers types",
        },
        {
          titre:
            "Marque employeur : publications LinkedIn authentiques et cohérentes avec la culture de l'entreprise",
        },
        {
          titre:
            "Travail collectif en petits groupes : identifier et prioriser 3 cas d'usage à fort potentiel dans son service",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Guide de référence des cas d'usage IA pour les RH + assistant marque employeur",
        },
      ],
    },
    {
      titreFr: "Module 5 — Déléguer ses tâches RH et construire sa feuille de route",
      steps: [
        {
          titre:
            "Savoir reconnaître quand un prompt ponctuel ne suffit plus et qu'il faut déléguer une tâche complète",
        },
        {
          titre:
            "Cas d'usage RH à fort potentiel : synthèse d'un lot de candidatures, tri de documents, rapports récurrents",
        },
        {
          titre:
            "Démonstration commentée : le formateur délègue à Claude Cowork la synthèse d'un lot de documents RH et la production d'une note de restitution",
        },
        {
          titre:
            "Chacun construit sa feuille de route : 3 à 5 actions concrètes à tester dès la semaine suivante",
        },
        { titre: "Bilan de la journée et temps de questions ouvertes" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Guide Claude Cowork pour les RH + trame de feuille de route personnalisable",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il des connaissances techniques ou juridiques pour suivre cette formation ?",
      reponse:
        "Non. La formation s'adresse aux professionnels RH sans prérequis technique. Chaque notion, y compris le cadre légal, est expliquée sans jargon avant d'être illustrée sur des cas RH concrets. Une première utilisation de l'IA est un plus, mais n'est pas indispensable.",
    },
    {
      question: "L'IA peut-elle vraiment être utilisée pour le recrutement en toute conformité ?",
      reponse:
        "Oui, à condition de connaître le cadre. Un module entier est consacré à l'IA Act et au RGPD appliqués aux RH : ce que l'IA peut proposer, ce que seul un humain peut décider (« human in the loop »), les données à ne jamais soumettre et comment prévenir les biais de sélection.",
    },
    {
      question: "Que repartent faire concrètement les participants ?",
      reponse:
        "Chacun repart avec la méthode AXION appliquée aux RH, une bibliothèque de prompts, son propre assistant IA RH créé pendant la session, une grille de conformité, et une feuille de route de 3 à 5 actions à tester dès la semaine suivante.",
    },
  ],
};

const IA_ASSISTANAT_7H: FormationV2 = {
  id: "ia-assistanat-mails-comptes-rendus-documents-7h",
  slugFr: "ia-assistanat-mails-comptes-rendus-documents-7h",
  slugEn: "ai-office-support-7h",
  numero: 11,
  gamme: "ia-standard",
  duree: "1j",
  surDevis: true,
  titreFr: "IA pour l'assistanat — mails, comptes-rendus & documents",
  accrocheFr:
    "L'IA sans le stress — reprendre la main sur un quotidien saturé de mails, de réunions et de documents, en 1 jour",
  h1Fr: "Formation IA pour l'assistanat en entreprise (1 jour)",
  metaTitleFr: "Formation IA assistanat — mails & CR, 1j | Axion-IA",
  metaDescriptionFr:
    "Formation IA d'1 jour pour assistants et office managers : reprendre la main sur sa boîte mail, produire comptes-rendus et documents plus vite. Sans jargon.",
  termesSemantiquesFr: [
    "formation IA assistanat",
    "IA assistant de direction",
    "IA office manager",
    "compte-rendu de réunion IA",
    "méthode AXION",
    "mails professionnels IA",
    "assistant IA tâches récurrentes",
  ],
  publicViseFr:
    "Assistants de direction, secrétaires, office managers, assistants administratifs, gestionnaires administratifs, chargés d'accueil — toute personne dont le quotidien est fait de mails, de réunions, de comptes-rendus, de courriers et de documents à produire pour les autres.",
  prerequisFr:
    "Aucun prérequis technique. Une première utilisation de l'IA générative est un plus, mais n'est pas indispensable. Disposer d'un ordinateur et d'un compte Claude gratuit (création en quelques clics, sans carte bancaire) pour l'exercice pratique du module 5.",
  casUsageFr: [
    {
      texteFr: "Reprendre la main sur la boîte mail : tri, réponses, relances",
      imageSrc:
        "/illustrations/formations/fiches/ia-assistanat-mails-comptes-rendus-documents-7h/cas-1.webp",
      imageCredit: {
        name: "LinkedIn Sales Solutions",
        url: "https://unsplash.com/@linkedinsalesnavigator?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Produire des comptes-rendus impeccables à partir de notes",
      imageSrc:
        "/illustrations/formations/fiches/ia-assistanat-mails-comptes-rendus-documents-7h/cas-2.webp",
      imageCredit: {
        name: "The Climate Reality Project",
        url: "https://unsplash.com/@climatereality?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Mettre en forme courriers et documents en un temps record",
      imageSrc:
        "/illustrations/formations/fiches/ia-assistanat-mails-comptes-rendus-documents-7h/cas-3.webp",
      imageCredit: {
        name: "Gorilla ROI Data Connector",
        url: "https://unsplash.com/@gorillaroi?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Créer son assistant IA pour chaque tâche récurrente",
      imageSrc:
        "/illustrations/formations/fiches/ia-assistanat-mails-comptes-rendus-documents-7h/cas-4.webp",
      imageCredit: {
        name: "Mimi Thian",
        url: "https://unsplash.com/@mimithian?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Rédiger des prompts efficaces grâce à la méthode AXION, appliquée aux tâches de l'assistanat",
    "Identifier les informations qu'il ne faut jamais soumettre à une IA — un enjeu majeur pour un poste qui accède aux données les plus sensibles de l'entreprise",
    "Reprendre la main sur sa boîte mail et sur ses écrits professionnels",
    "Produire ses comptes-rendus de réunion en une fraction du temps habituel",
    "Mettre en forme, synthétiser et présenter des documents plus rapidement, et faire préparer par l'IA ses rétroplannings et checklists d'organisation",
    "Créer un assistant IA pour ses tâches récurrentes, et identifier quand déléguer une tâche complète",
  ],
  beneficeDirigeantFr:
    "Le poste qui voit tout gagne des heures chaque semaine sur les mails, les comptes-rendus et les documents, tout en apprenant les réflexes de confidentialité indispensables sur un poste qui accède aux données les plus sensibles de l'entreprise.",
  equationTempsFr:
    "1 jour de formation → des comptes-rendus produits en une fraction du temps habituel et une boîte mail reprise en main, avec 3 à 5 actions concrètes à tester dès la semaine suivante.",
  programme: [
    {
      titreFr: "Module 1 — L'IA générative appliquée à l'assistanat",
      steps: [
        {
          titre:
            "Fonctionnement de l'IA générative expliqué simplement, et ce qu'elle change concrètement pour un poste d'assistanat",
        },
        { titre: "Panorama des outils : ChatGPT, Claude, Gemini — lequel ouvrir selon la tâche" },
        {
          titre:
            "La méthode AXION appliquée à vos cas : Acteur, conteXte, Intention, Output, Normes",
        },
        {
          titre:
            "Confidentialité : ce qui ne doit jamais être soumis à une IA, et comment travailler malgré tout sur un document sensible",
        },
        {
          titre:
            "Point de vigilance du métier : l'assistanat voit tout (comptes-rendus de comité de direction, dossiers de rémunération, données RH) — les réflexes concrets pour continuer à travailler sur des documents sensibles sans les exposer",
        },
        {
          titre:
            "Exercices pratiques sur ChatGPT, Claude et Gemini, à partir de cas réels apportés par les participants",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide du prompt AXION pour l'assistanat + bibliothèque de 50 prompts + mémo confidentialité",
        },
      ],
    },
    {
      titreFr: "Module 2 — Reprendre la main sur sa boîte mail et ses écrits",
      steps: [
        {
          titre:
            "Trier, prioriser, préparer ses réponses : ce que l'IA peut faire, et ce qu'elle ne doit pas décider à votre place",
        },
        { titre: "Rédiger vite et juste : courriers, notes internes, relances" },
        {
          titre:
            "Le mail délicat : formuler un refus, une relance ferme, une réponse à une réclamation — en gardant le ton de la maison",
        },
        { titre: "Reformuler, raccourcir, adapter au destinataire, traduire" },
        {
          titre:
            "Exercice pratique : chaque participant traite un mail réel de son quotidien, du plus pénible à écrire",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Bibliothèque de trames de courriers et de mails, classées par situation",
        },
      ],
    },
    {
      titreFr: "Module 3 — Réunions, comptes-rendus et suivi",
      steps: [
        {
          titre: "Préparer une réunion : ordre du jour, dossier préparatoire, points de vigilance",
        },
        {
          titre:
            "Exploiter les transcriptions de réunion de vos outils habituels pour produire un compte-rendu",
        },
        {
          titre:
            "Du verbatim au compte-rendu utile : structurer, trier, ne garder que ce qui compte",
        },
        { titre: "Le relevé de décisions et le suivi des actions : qui fait quoi, pour quand" },
        {
          titre:
            "Exercice pratique : chaque participant produit un compte-rendu complet à partir d'une transcription",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Trames de compte-rendu, de relevé de décisions et de suivi d'actions",
        },
      ],
    },
    {
      titreFr: "Module 4 — Documents, synthèses et organisation",
      steps: [
        { titre: "Mettre en forme et harmoniser : structurer un document, homogénéiser une série" },
        { titre: "Synthétiser un dossier volumineux pour quelqu'un qui n'a que cinq minutes" },
        { titre: "Produire une présentation à partir de notes éparses" },
        {
          titre:
            "Organiser : faire construire un rétroplanning d'événement, une checklist de déplacement, un dossier de voyage — l'IA prépare, vous décidez et vous réservez",
        },
        {
          titre:
            "Courriers types, modèles, réponses récurrentes : construire une fois, réutiliser toujours",
        },
        {
          titre:
            "Exercice pratique : chaque participant transforme un dossier réel en note de synthèse d'une page",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide de production de documents + modèles réutilisables + trames de rétroplanning et de checklist",
        },
      ],
    },
    {
      titreFr: "Module 5 — Créer son assistant IA et déléguer ses tâches",
      steps: [
        {
          titre:
            "Architecture d'un assistant IA : instructions en français + base de connaissances, aucun code requis",
        },
        {
          titre:
            "Atelier pratique guidé : chaque participant crée son assistant sur une tâche récurrente de son poste — le formateur guide tout le groupe simultanément",
        },
        {
          titre:
            "Savoir reconnaître quand un prompt ponctuel ne suffit plus et qu'il faut déléguer une tâche complète",
        },
        {
          titre:
            "Démonstration commentée : le formateur délègue à Claude Cowork le tri d'un lot de documents et la production d'une note de restitution",
        },
        {
          titre:
            "Chacun construit sa feuille de route : 3 à 5 actions concrètes à tester dès la semaine suivante, et bilan de la journée",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Plus de 20 kits assistants IA pour l'assistanat + guide Claude Cowork + trame de feuille de route",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il déjà savoir utiliser l'IA pour suivre cette formation ?",
      reponse:
        "Non. Aucun prérequis technique n'est demandé et une première utilisation de l'IA est un simple plus. Chaque notion est expliquée avant d'être illustrée, sans jargon, et la méthode AXION rend le prompting accessible à tout profil d'assistanat.",
    },
    {
      question: "Comment travailler avec l'IA sur des documents sensibles sans les exposer ?",
      reponse:
        "C'est un enjeu central du métier, car l'assistanat accède aux données les plus sensibles de l'entreprise. Le module 1 ne se contente pas d'alerter : il donne les réflexes concrets pour identifier ce qui ne doit jamais être soumis à une IA et continuer à travailler malgré tout sur un document confidentiel.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance via Microsoft Teams, avec exactement le même contenu et le même niveau d'interactivité. Les démonstrations se font en partage d'écran et les exercices pratiques fonctionnent à l'identique, chacun sur son propre poste.",
    },
  ],
};

const IA_MARKETING_7H: FormationV2 = {
  id: "ia-marketing-contenus-seo-image-de-marque-7h",
  slugFr: "ia-marketing-contenus-seo-image-de-marque-7h",
  slugEn: "ai-marketing-content-seo-7h",
  numero: 12,
  gamme: "ia-standard",
  duree: "1j",
  surDevis: true,
  titreFr: "IA Marketing — Contenus, SEO & image de marque",
  accrocheFr:
    "L'IA sans le stress — produire plus vite sans sacrifier votre image de marque, en 1 journée",
  h1Fr: "Formation IA marketing : contenus, SEO et image de marque (1 jour)",
  metaTitleFr: "Formation IA marketing, contenus & SEO — 1 jour | Axion-IA",
  metaDescriptionFr:
    "Formation IA marketing, 1 jour : prompts avec la méthode AXION, assistant calibré sur votre marque, contenus sans « style IA », SEO et visuels de marque.",
  termesSemantiquesFr: [
    "formation IA marketing",
    "IA rédaction contenus",
    "méthode AXION marketing",
    "assistant IA ton de marque",
    "contenu sans style IA",
    "SEO intelligence artificielle",
    "visuels IA image de marque",
  ],
  publicViseFr:
    "Professionnels du marketing et de la communication : responsables et chargés de marketing, community managers, rédacteurs, chargés de communication, dirigeants de PME assurant la fonction marketing. Formation dispensée en intra-entreprise, en groupe unique par société, sur des cas marketing transversaux (post LinkedIn, article de blog, newsletter, visuel de campagne) valables dans tout secteur.",
  prerequisFr:
    "Aucun prérequis technique. Une première utilisation de l'IA générative est un plus, mais n'est pas indispensable. Prévoir un ordinateur et un compte Claude gratuit (création en quelques clics, sans carte bancaire) pour les exercices pratiques.",
  casUsageFr: [
    {
      texteFr: "Produire des contenus fidèles à la marque, sans « style IA »",
      imageSrc:
        "/illustrations/formations/fiches/ia-marketing-contenus-seo-image-de-marque-7h/cas-1.webp",
      imageCredit: {
        name: "Denise Jans",
        url: "https://unsplash.com/@dmjdenise?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Décliner un contenu en plusieurs formats : post, newsletter, article",
      imageSrc:
        "/illustrations/formations/fiches/ia-marketing-contenus-seo-image-de-marque-7h/cas-2.webp",
      imageCredit: {
        name: "Austin Distel",
        url: "https://unsplash.com/@austindistel?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Optimiser ses pages et articles pour le référencement",
      imageSrc:
        "/illustrations/formations/fiches/ia-marketing-contenus-seo-image-de-marque-7h/cas-3.webp",
      imageCredit: {
        name: "Stephen Dawson",
        url: "https://unsplash.com/@dawson2406?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Générer des visuels cohérents avec sa charte graphique",
      imageSrc:
        "/illustrations/formations/fiches/ia-marketing-contenus-seo-image-de-marque-7h/cas-4.webp",
      imageCredit: {
        name: "Brands&People",
        url: "https://unsplash.com/@brandsandpeople?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Rédiger des prompts marketing efficaces grâce à la méthode AXION",
    "Créer un assistant IA calibré sur le ton et l'identité de sa marque",
    "Reconnaître et éliminer le « style IA » de ses contenus, pour préserver l'image de marque",
    "Produire des contenus web et SEO fiables, et vérifier ses sources grâce à la recherche augmentée",
    "Générer des visuels cohérents avec son identité graphique",
    "Publier ses contenus IA en conformité : obligation de transparence de l'IA Act et droits sur les visuels générés",
    "Identifier quand déléguer une tâche marketing complète à un agent IA, et construire sa feuille de route",
  ],
  beneficeDirigeantFr:
    "Votre équipe marketing produit plus vite — posts, articles, newsletters, visuels — sans que les contenus « sentent l'IA » ni s'éloignent de votre image de marque, avec un assistant calibré sur votre voix créé pendant la session.",
  equationTempsFr:
    "1 journée → chaque participant repart avec son assistant « ton de marque », les techniques anti « style IA », des méthodes SEO et visuels, et une feuille de route de 3 à 5 actions à tester dès la semaine suivante.",
  programme: [
    {
      titreFr: "Module 1 — Les prompts marketing avancés avec la méthode AXION",
      steps: [
        {
          titre:
            "La méthode AXION appliquée au marketing : Acteur, conteXte, Intention, Output, Normes",
        },
        {
          titre:
            "Techniques avancées : master prompt, raisonnement étape par étape, exemples calibrants, auto-amélioration itérative",
        },
        {
          titre:
            "Piloter le ton et le niveau de créativité de l'IA : ce qui se règle par le prompt, et ce qui se règle par les styles personnalisés",
        },
        {
          titre:
            "Panorama des outils : ChatGPT, Claude, Gemini — lequel choisir selon la tâche marketing",
        },
        {
          titre:
            "Exercices pratiques sur les trois outils, à partir de cas réels apportés par les participants",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide du prompt AXION pour le marketing + bibliothèque de plus de 200 prompts marketing",
        },
      ],
    },
    {
      titreFr: "Module 2 — Créer son assistant IA calibré sur sa marque",
      steps: [
        {
          titre:
            "Architecture d'un assistant IA : instructions en français + base de connaissances, aucun code requis",
        },
        {
          titre:
            "Traduire une identité de marque en instructions : ton, vocabulaire, interdits, exemples de référence",
        },
        {
          titre:
            "Atelier pratique guidé : chaque participant crée son assistant « ton de marque » sur Claude Projects, nourri de ses propres contenus de référence — le formateur guide tout le groupe simultanément",
        },
        { titre: "Partager un assistant avec son équipe et le faire évoluer dans le temps" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Plus de 20 kits assistants IA marketing prêts à l'emploi + l'assistant créé par chaque participant",
        },
      ],
    },
    {
      titreFr: "Module 3 — Produire des contenus authentiques, sans « style IA »",
      steps: [
        {
          titre:
            "Pourquoi l'IA produit un style reconnaissable, et en quoi il nuit concrètement à l'image de marque",
        },
        {
          titre:
            "Les techniques pour l'éliminer : contraintes explicites, interdits lexicaux, exemples calibrants, travail du rythme",
        },
        {
          titre:
            "LinkedIn : produire des publications qui ne « sentent pas l'IA » et restent fidèles à sa voix",
        },
        {
          titre:
            "Transparence : depuis le 2 août 2026, l'IA Act (article 50) impose d'informer le public lorsqu'un contenu est généré ou manipulé par IA — ce que cela change concrètement pour vos publications",
        },
        {
          titre:
            "Atelier pratique : réécrire un contenu générique produit par IA en contenu authentique de marque",
        },
        {
          titre:
            "Démonstration : un assistant « relecteur » chargé de repérer les tics de langage de l'IA avant publication",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide anti « style IA » + checklist de relecture + assistant relecteur prêt à l'emploi",
        },
      ],
    },
    {
      titreFr: "Module 4 — Contenus web, SEO et visuels de marque",
      steps: [
        {
          titre:
            "SEO : produire des articles et contenus web structurés et optimisés pour le référencement",
        },
        { titre: "Fiabiliser ses contenus et vérifier ses sources grâce à la recherche augmentée" },
        {
          titre:
            "Générer des visuels avec ChatGPT et Gemini : ce qui fonctionne, ce qui ne fonctionne pas encore",
        },
        { titre: "Décliner une série de visuels cohérents avec son identité graphique" },
        {
          titre:
            "Droits et usages des visuels générés par IA : ce que l'on peut publier, ce qui reste risqué",
        },
        {
          titre:
            "Challenge en petits groupes : produire une mini-campagne complète (article, post, visuel) et la présenter au groupe",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        { temps: "Livrable", titre: "Bibliothèque de prompts SEO + guide des prompts visuels" },
      ],
    },
    {
      titreFr: "Module 5 — Déléguer ses tâches marketing et construire sa feuille de route",
      steps: [
        {
          titre:
            "Savoir reconnaître quand un prompt ponctuel ne suffit plus et qu'il faut déléguer une tâche complète",
        },
        {
          titre:
            "Cas d'usage marketing à fort potentiel : veille concurrentielle, déclinaison d'un contenu en plusieurs formats, rapports récurrents",
        },
        {
          titre:
            "Démonstration commentée : le formateur délègue à Claude Cowork la déclinaison d'un contenu en plusieurs formats (article, post, newsletter)",
        },
        {
          titre:
            "Chacun construit sa feuille de route : 3 à 5 actions concrètes à tester dès la semaine suivante",
        },
        { titre: "Bilan de la journée et temps de questions ouvertes" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide Claude Cowork pour le marketing + trame de feuille de route personnalisable",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Comment éviter que nos contenus « sentent l'IA » ?",
      reponse:
        "C'est le cœur du module 3 : on identifie pourquoi l'IA produit un style reconnaissable, puis on applique des techniques concrètes (contraintes explicites, interdits lexicaux, exemples calibrants, travail du rythme) et un assistant « relecteur » pour repérer les tics de langage avant publication.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance via Microsoft Teams, avec exactement le même contenu et le même niveau d'interactivité. À distance, les démonstrations se font en partage d'écran et les exercices fonctionnent à l'identique, chacun sur son propre poste.",
    },
    {
      question: "Faut-il un compte payant pour participer ?",
      reponse:
        "Non pour les exercices : un compte Claude gratuit suffit pour créer votre assistant et vous entraîner. Seule la démonstration Claude Cowork du module 5 est réalisée par le formateur depuis son propre compte, Cowork nécessitant un plan payant.",
    },
  ],
};

const IA_VENTE_7H: FormationV2 = {
  id: "ia-vente-prospection-developpement-commercial-7h",
  slugFr: "ia-vente-prospection-developpement-commercial-7h",
  slugEn: "ai-sales-prospecting-7h",
  numero: 13,
  gamme: "ia-standard",
  duree: "1j",
  surDevis: true,
  titreFr: "IA pour la vente : prospection & développement commercial",
  accrocheFr:
    "L\'IA sans le stress — passer moins de temps à chercher, plus de temps à vendre, en 1 journée",
  h1Fr: "Formation IA pour la vente et la prospection commerciale (1 jour)",
  metaTitleFr: "Formation IA vente & prospection — 1 jour | Axion-IA",
  metaDescriptionFr:
    "Formation IA pour commerciaux, 1 jour : prospecter, préparer ses rendez-vous et relancer avec la méthode AXION, créer ses assistants IA commerciaux.",
  termesSemantiquesFr: [
    "formation IA vente",
    "IA prospection commerciale",
    "méthode AXION vente",
    "assistant IA commercial",
    "recherche augmentée prospects",
    "développement commercial IA",
    "relance commerciale IA",
  ],
  publicViseFr:
    "Commerciaux, business developers, chargés d\'affaires, responsables commerciaux et dirigeants de PME assurant le développement commercial. La formation est spécialisée sur la fonction commerciale mais entièrement standardisée : les démonstrations et exercices s\'appuient sur des cas commerciaux transversaux (recherche de prospects, préparation de rendez-vous, relance, compte-rendu) valables dans tout secteur d\'activité.",
  prerequisFr:
    "Aucun prérequis technique. Une première utilisation de l\'IA générative est un plus, mais n\'est pas indispensable. Prévoir un ordinateur et un compte Claude gratuit (création en quelques clics, sans carte bancaire) pour les exercices pratiques.",
  casUsageFr: [
    {
      texteFr: "Prospecter plus vite : ciblage, messages, séquences de relance",
      imageSrc:
        "/illustrations/formations/fiches/ia-vente-prospection-developpement-commercial-7h/cas-1.webp",
      imageCredit: {
        name: "Sable Flow",
        url: "https://unsplash.com/@sableflow?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Préparer chaque rendez-vous avec une fiche prospect complète",
      imageSrc:
        "/illustrations/formations/fiches/ia-vente-prospection-developpement-commercial-7h/cas-2.webp",
      imageCredit: {
        name: "Romain Dancre",
        url: "https://unsplash.com/@romaindancre?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Rédiger des propositions et mails commerciaux qui convertissent",
      imageSrc:
        "/illustrations/formations/fiches/ia-vente-prospection-developpement-commercial-7h/cas-3.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Créer ses assistants commerciaux : relances, comptes-rendus de RDV",
      imageSrc:
        "/illustrations/formations/fiches/ia-vente-prospection-developpement-commercial-7h/cas-4.webp",
      imageCredit: {
        name: "Marcel Petzold",
        url: "https://unsplash.com/@mpsc2021?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Rédiger des prompts commerciaux efficaces grâce à la méthode AXION",
    "Identifier les données commerciales qu\'il ne faut jamais soumettre à une IA, et respecter le RGPD en prospection",
    "Construire une liste de prospects qualifiés grâce à la recherche augmentée",
    "Préparer un rendez-vous, bâtir un argumentaire et traiter les objections avec l\'IA",
    "Créer des assistants IA commerciaux pour sa prospection et ses relances",
    "Comprendre comment relier Claude à ses outils commerciaux pour automatiser son suivi",
    "Identifier quand déléguer une tâche commerciale complète à un agent IA, et construire sa feuille de route",
  ],
  beneficeDirigeantFr:
    "En une journée, toute l\'équipe commerciale gagne une méthode fiable pour prospecter, préparer ses rendez-vous et relancer plus vite — et repart avec ses propres assistants IA calibrés sur votre offre et votre cible.",
  equationTempsFr:
    "1 journée de formation → chaque commercial passe moins de temps à chercher et à rédiger, et repart avec 3 à 5 actions concrètes à tester dès la semaine suivante.",
  programme: [
    {
      titreFr: "Module 1 — L\'IA générative appliquée à la vente",
      steps: [
        {
          titre:
            "Le fonctionnement de l\'IA générative expliqué simplement, et ce qu\'elle change concrètement pour un commercial",
        },
        {
          titre:
            "Panorama des outils : ChatGPT, Claude, Gemini — lequel choisir selon la tâche commerciale",
        },
        {
          titre:
            "La méthode AXION appliquée à la vente : Acteur, conteXte, Intention, Output, Normes",
        },
        {
          titre:
            "Les risques du métier : hallucinations sur les chiffres et les références, excès de confiance dans une réponse plausible",
        },
        {
          titre:
            "RGPD et prospection : pourquoi soumettre un fichier de prospects à une IA n\'est pas anodin, et ce qu\'on ne doit jamais y mettre",
        },
        {
          titre:
            "Exercices pratiques sur les trois outils, à partir de cas réels apportés par les participants",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide du prompt AXION pour la vente + bibliothèque de plus de 50 prompts commerciaux",
        },
      ],
    },
    {
      titreFr: "Module 2 — Trouver et qualifier ses prospects",
      steps: [
        { titre: "Définir sa cible et son persona avant de lancer la moindre recherche" },
        {
          titre:
            "La recherche augmentée : identifier des prospects et vérifier les informations trouvées",
        },
        { titre: "Structurer une recherche approfondie et en tirer une liste exploitable" },
        {
          titre:
            "Qualifier un prospect : signaux d\'achat, actualités de l\'entreprise, identification des interlocuteurs clés",
        },
        {
          titre:
            "Exercice pratique : chaque participant construit une liste de prospects qualifiés sur sa propre cible",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Guide de la recherche augmentée pour la prospection + prompts de sourcing et de qualification",
        },
      ],
    },
    {
      titreFr: "Module 3 — Préparer, mener et suivre ses rendez-vous",
      steps: [
        {
          titre:
            "Préparer un rendez-vous en quelques minutes : synthèse de l\'entreprise, enjeux, interlocuteur",
        },
        {
          titre:
            "Construire un argumentaire adapté au profil, au secteur et au moment du cycle de vente",
        },
        { titre: "Anticiper les objections et préparer ses réponses" },
        { titre: "Rédiger ses comptes-rendus et ses relances personnalisées en quelques minutes" },
        {
          titre:
            "Exercice pratique : chaque participant prépare un rendez-vous réel de bout en bout",
        },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Trames de préparation de rendez-vous, d\'argumentaire, de compte-rendu et de relance",
        },
      ],
    },
    {
      titreFr: "Module 4 — Créer ses assistants IA commerciaux",
      steps: [
        {
          titre:
            "Architecture d\'un assistant IA : instructions en français + base de connaissances, aucun code requis",
        },
        {
          titre:
            "Atelier pratique guidé : chaque participant crée son assistant « prospection », calibré sur son offre et sa cible — le formateur guide tout le groupe simultanément",
        },
        {
          titre:
            "Démonstration : industrialiser les relances vues au module 3 dans un assistant dédié, qui les rédige à partir du contexte du compte",
        },
        {
          titre:
            "Démonstration : relier Claude à ses outils commerciaux (agenda, messagerie, documents) grâce aux connecteurs, pour le suivi et les relances",
        },
        { titre: "Partager ses assistants avec toute l\'équipe commerciale et les faire évoluer" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre:
            "Plus de 20 kits assistants IA commerciaux + guide des connecteurs + l\'assistant prospection créé par chaque participant",
        },
      ],
    },
    {
      titreFr: "Module 5 — Déléguer ses tâches commerciales et construire sa feuille de route",
      steps: [
        {
          titre:
            "Savoir reconnaître quand un prompt ponctuel ne suffit plus et qu\'il faut déléguer une tâche complète",
        },
        {
          titre:
            "Cas d\'usage commerciaux à fort potentiel : veille sur un portefeuille de comptes, synthèse d\'un lot de comptes-rendus, rapports d\'activité récurrents",
        },
        {
          titre:
            "Démonstration commentée : le formateur délègue à Claude Cowork une veille sur un portefeuille de comptes et la production d\'une note de synthèse",
        },
        {
          titre:
            "Chacun construit sa feuille de route : 3 à 5 actions concrètes à tester dès la semaine suivante",
        },
        { titre: "Bilan de la journée et temps de questions ouvertes" },
        { titre: "QCM de validation des acquis en fin de module" },
        {
          temps: "Livrable",
          titre: "Guide Claude Cowork pour la vente + trame de feuille de route personnalisable",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il déjà savoir utiliser l\'IA pour suivre cette formation ?",
      reponse:
        "Non. Aucun prérequis technique n\'est demandé et une première expérience de l\'IA est un plus, pas une obligation. Chaque notion est expliquée avant d\'être illustrée, sans jargon. Prévoyez simplement un ordinateur et un compte Claude gratuit pour les exercices pratiques.",
    },
    {
      question: "La formation s\'adapte-t-elle à mon secteur d\'activité ?",
      reponse:
        "Le programme est standardisé et applicable sans adaptation à tout service commercial, quel que soit le secteur. Les démonstrations s\'appuient sur des cas transversaux, mais les exercices se font sur vos propres cibles, prospects et rendez-vous réels : chacun repart avec des livrables directement liés à son activité.",
    },
    {
      question: "Que repartent concrètement faire les participants ?",
      reponse:
        "Chacun repart avec la méthode AXION appliquée à la vente, une bibliothèque de prompts commerciaux, une liste de prospects qualifiés, ses trames de rendez-vous et de relance, son propre assistant IA de prospection créé pendant la session, et une feuille de route de 3 à 5 actions à tester dès la semaine suivante.",
    },
  ],
};

const IA_FINANCE_7H: FormationV2 = {
  id: "ia-finance-reporting-analyses-pilotage-7h",
  slugFr: "ia-finance-reporting-analyses-pilotage-7h",
  slugEn: "ai-finance-reporting-analytics-7h",
  numero: 14,
  gamme: "ia-standard",
  duree: "1j",
  surDevis: true,
  titreFr: "IA Finance — Reporting, analyses & pilotage",
  accrocheFr:
    "L'IA sans le stress — reprenez du temps sur tout ce qui entoure les chiffres : commentaires de gestion, analyses d'écarts, synthèses et écrits récurrents, en 1 jour",
  h1Fr: "Formation IA pour la finance et le contrôle de gestion (1 jour)",
  metaTitleFr: "Formation IA Finance & contrôle de gestion — 1j | Axion-IA",
  metaDescriptionFr:
    "Formation IA finance, 1 jour : produire commentaires de gestion, analyses d'écarts et synthèses en une fraction du temps avec la méthode AXION. Sur devis.",
  termesSemantiquesFr: [
    "formation IA finance",
    "IA contrôle de gestion",
    "commentaire de gestion IA",
    "analyse d'écarts",
    "reporting financier IA",
    "méthode AXION",
    "note de synthèse financière",
    "assistant IA finance",
  ],
  publicViseFr:
    "Directeurs administratifs et financiers, contrôleurs de gestion, comptables, responsables administratifs et financiers, gestionnaires et dirigeants de PME assurant le suivi financier — toute personne dont le quotidien mêle production de chiffres et production d'écrits autour de ces chiffres.",
  prerequisFr:
    "Aucun prérequis technique. Une première utilisation de l'IA générative est un plus, mais n'est pas indispensable. Prévoir un ordinateur et un compte Claude gratuit (création en quelques clics, sans carte bancaire) pour l'exercice pratique du module 5.",
  casUsageFr: [
    {
      texteFr: "Produire ses commentaires de gestion en une fraction du temps",
      imageSrc:
        "/illustrations/formations/fiches/ia-finance-reporting-analyses-pilotage-7h/cas-1.webp",
      imageCredit: {
        name: "Jakub Żerdzicki",
        url: "https://unsplash.com/@jakubzerdzicki?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Analyser écarts et tendances à partir de ses exports",
      imageSrc:
        "/illustrations/formations/fiches/ia-finance-reporting-analyses-pilotage-7h/cas-2.webp",
      imageCredit: {
        name: "Mika Baumeister",
        url: "https://unsplash.com/@kommumikation?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Rédiger synthèses et reportings prêts à diffuser",
      imageSrc:
        "/illustrations/formations/fiches/ia-finance-reporting-analyses-pilotage-7h/cas-3.webp",
      imageCredit: {
        name: "Vitaly Gariev",
        url: "https://unsplash.com/@silverkblack?utm_source=axion-ia&utm_medium=referral",
      },
    },
    {
      texteFr: "Fiabiliser ses contrôles avec des garde-fous anti-erreur",
      imageSrc:
        "/illustrations/formations/fiches/ia-finance-reporting-analyses-pilotage-7h/cas-4.webp",
      imageCredit: {
        name: "Windows",
        url: "https://unsplash.com/@windows?utm_source=axion-ia&utm_medium=referral",
      },
    },
  ],
  objectifsFr: [
    "Rédiger des prompts efficaces grâce à la méthode AXION, appliquée aux cas de la finance et du contrôle de gestion",
    "Savoir précisément ce qu'on confie à l'IA et ce qui reste dans le tableur — la règle qui évite l'erreur la plus coûteuse du métier",
    "Produire ses commentaires de gestion et ses analyses d'écarts en une fraction du temps habituel",
    "Interroger et synthétiser un document long : rapport, contrat, convention, liasse",
    "Accélérer ses écrits récurrents : relances clients, procédures, notes internes, supports de présentation",
    "Créer un assistant IA pour ses tâches récurrentes, et identifier quand déléguer une tâche complète",
  ],
  beneficeDirigeantFr:
    "Votre service financier reprend du temps sur tout ce qui entoure les chiffres — commentaires, analyses d'écarts, synthèses, courriers — sans jamais confier un calcul à l'IA : les chiffres restent dans le tableur, la rédaction et l'analyse s'accélèrent.",
  equationTempsFr:
    "1 jour de formation → commentaires de gestion, analyses d'écarts et notes de synthèse produits en une fraction du temps habituel, avec un assistant IA « commentaire de gestion » opérationnel.",
  programme: [
    {
      titreFr: "Module 1 — L'IA générative appliquée à la finance",
      steps: [
        {
          titre:
            "Fonctionnement de l'IA générative expliqué simplement, et ce qu'elle change concrètement pour un poste financier",
        },
        { titre: "Panorama des outils : ChatGPT, Claude, Gemini — lequel ouvrir selon la tâche" },
        {
          titre:
            "La méthode AXION appliquée à vos cas : Acteur, conteXte, Intention, Output, Normes",
        },
        {
          titre:
            "Le partage des rôles : les chiffres restent dans votre tableur, l'IA prend tout ce qu'il y a autour — la rédaction, la structure, l'explication, la synthèse",
        },
        {
          titre:
            "Confidentialité : ce qui ne doit jamais sortir de l'entreprise, et comment travailler malgré tout sur un document financier",
        },
        {
          titre:
            "Exercices pratiques sur ChatGPT, Claude et Gemini, à partir de cas réels apportés par les participants",
        },
        {
          titre:
            "La règle du métier : l'IA ne calcule pas de façon fiable et ne remplace ni votre tableur ni votre logiciel comptable ; elle excelle sur tout ce qui entoure les chiffres",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Guide du prompt AXION pour la finance + bibliothèque de 50 prompts + mémo du partage des rôles",
        },
      ],
    },
    {
      titreFr: "Module 2 — Reporting et commentaires de gestion",
      steps: [
        {
          titre:
            "Le plus gros gain du métier : vous avez les chiffres, l'IA rédige l'analyse autour",
        },
        {
          titre:
            "Expliquer un écart, une variance, une tendance : donner le contexte et obtenir un commentaire exploitable",
        },
        { titre: "Adapter le niveau de lecture : comité de direction, opérationnel, actionnaire" },
        {
          titre:
            "Structurer un tableau de bord : quels indicateurs, quel ordre, quelle mise en récit",
        },
        { titre: "Garder la main : relire, corriger, valider — le commentaire reste le vôtre" },
        {
          titre:
            "Exercice pratique : chaque participant rédige le commentaire de son dernier reporting",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre: "Trames de commentaires de gestion et d'analyses d'écarts, par niveau de lecture",
        },
      ],
    },
    {
      titreFr: "Module 3 — Interroger et synthétiser ses documents",
      steps: [
        {
          titre:
            "Poser des questions à un document long plutôt que de le lire en entier : rapport, contrat, bail, convention",
        },
        { titre: "Produire une note de synthèse pour quelqu'un qui n'a que cinq minutes" },
        {
          titre:
            "Comparer plusieurs documents : versions successives, offres concurrentes, clauses",
        },
        {
          titre:
            "Se tenir à jour : dégrossir une veille réglementaire ou fiscale, puis vérifier auprès des sources officielles",
        },
        {
          titre:
            "Exercice pratique : chaque participant fait analyser un document réel et en tire une note d'une page",
        },
        { titre: "QCM de validation des acquis" },
        { temps: "Livrable", titre: "Guide d'analyse documentaire + trames de notes de synthèse" },
      ],
    },
    {
      titreFr: "Module 4 — Écrits récurrents et organisation du service",
      steps: [
        {
          titre:
            "Relances clients : trouver le ton juste selon l'ancienneté de la créance et la relation commerciale",
        },
        {
          titre:
            "Formaliser une procédure ou un mode opératoire à partir de ce que vous faites déjà sans l'avoir écrit",
        },
        { titre: "Comptes-rendus de réunion budgétaire et notes internes" },
        { titre: "Préparer un support de présentation : budget, clôture, prévisionnel" },
        {
          titre:
            "Exercice pratique : chaque participant produit une trame réutilisable sur un écrit qui lui revient tous les mois",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Bibliothèque de trames : relances, procédures, comptes-rendus, supports de présentation",
        },
      ],
    },
    {
      titreFr: "Module 5 — Créer son assistant IA et déléguer ses tâches",
      steps: [
        {
          titre:
            "Architecture d'un assistant IA : instructions en français + base de connaissances, aucun code requis",
        },
        {
          titre:
            "Atelier pratique guidé : chaque participant crée son assistant « commentaire de gestion », calibré sur le format de son entreprise, le formateur guidant tout le groupe simultanément",
        },
        {
          titre:
            "Savoir reconnaître quand un prompt ponctuel ne suffit plus et qu'il faut déléguer une tâche complète",
        },
        {
          titre:
            "Démonstration commentée : le formateur délègue à Claude Cowork la synthèse d'un lot de documents et la production d'une note de restitution",
        },
        {
          titre:
            "Chacun construit sa feuille de route : 3 à 5 actions concrètes à tester dès la semaine suivante, et bilan de la journée",
        },
        { titre: "QCM de validation des acquis" },
        {
          temps: "Livrable",
          titre:
            "Plus de 20 kits assistants IA pour la finance + guide Claude Cowork + trame de feuille de route",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "L'IA va-t-elle faire les calculs à la place de mon tableur ?",
      reponse:
        "Non, et c'est la règle centrale de la journée : l'IA ne calcule pas de façon fiable et ne remplace ni votre tableur ni votre logiciel comptable. Les chiffres restent chez vous ; l'IA prend tout ce qui les entoure — commentaires, analyses d'écarts, synthèses, courriers — là où elle est réellement excellente.",
    },
    {
      question: "Présentiel ou distanciel ?",
      reponse:
        "Au choix : dans vos locaux, ou entièrement à distance via Microsoft Teams, avec exactement le même contenu et le même niveau d'interactivité. Les démonstrations se font en partage d'écran et les exercices fonctionnent à l'identique, chacun sur son propre poste.",
    },
    {
      question: "Que repartent faire concrètement les participants ?",
      reponse:
        "Chacun repart avec la méthode AXION appliquée à la finance, des bibliothèques de prompts et de trames (commentaires de gestion, analyses d'écarts, relances, notes de synthèse), son assistant IA « commentaire de gestion » créé pendant la session, et une feuille de route de 3 à 5 actions à tester dès la semaine suivante.",
    },
  ],
};

const SEMINAIRE_IA_ENTREPRISE: FormationV2 = {
  id: "seminaire-ia-toute-l-entreprise-1j",
  slugFr: "seminaire-ia-toute-l-entreprise-1j",
  slugEn: "ai-seminar-whole-company-1d",
  numero: 15,
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
  metaTitleFr: "Séminaire IA en entreprise — toute l'équipe | Axion-IA",
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
  BIEN_DEMARRER_4H,
  BIEN_DEMARRER_JOURNEE_7H,
  PROMPTS_AVANCES_ASSISTANTS_4H,
  GAGNER_DU_TEMPS_7H,
  CLAUDE_PRISE_EN_MAIN_7H,
  CLAUDE_MAITRISE_AVANCEE_2J,
  CLAUDE_CODE_PROJET_3J,
  IA_ACT_CONFORMITE_7H,
  REFERENT_IA_GOUVERNANCE_7H,
  IA_RH_7H,
  IA_ASSISTANAT_7H,
  IA_MARKETING_7H,
  IA_VENTE_7H,
  IA_FINANCE_7H,
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

/** Formations d'une gamme. */
export function getFormationsV2ByGamme(gamme: FormationGamme): ReadonlyArray<FormationV2> {
  return FORMATIONS_V2.filter((f) => f.gamme === gamme);
}

/** Formations d'une durée. */
export function getFormationsV2ByDuree(duree: FormationDuree): ReadonlyArray<FormationV2> {
  return FORMATIONS_V2.filter((f) => f.duree === duree);
}

/** Tranches d'effectif d'une formation (dérivées de la matrice prix). */
export function getFormationV2Brackets(f: FormationV2): ReadonlyArray<FormationBracket> {
  if (f.surDevis) return [];
  return getFormationBrackets(f.gamme, f.duree);
}

/** Prix d'une formation pour une tranche (dérivé de la matrice prix). */
export function getFormationV2Price(f: FormationV2, bracket: FormationBracket): number | undefined {
  if (f.surDevis) return undefined;
  return getFormationPrice(f.gamme, f.duree, bracket);
}

/** Prix d'entrée d'une formation (« à partir de »). */
export function getFormationV2EntryPrice(f: FormationV2): number | undefined {
  if (f.surDevis) return undefined;
  return getFormationEntryPrice(f.gamme, f.duree);
}
