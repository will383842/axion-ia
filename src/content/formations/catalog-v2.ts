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

const IA_EXPRESS: FormationV2 = {
  id: "ia-express",
  slugFr: "ia-express",
  slugEn: "ai-express",
  numero: 1,
  gamme: "ia-standard",
  duree: "4h",
  titreFr: "IA Express",
  accrocheFr: "4 heures pour que toute votre équipe travaille avec l'IA, dès demain",
  h1Fr: "Former toute votre équipe à l'IA en une demi-journée",
  metaTitleFr: "Formation IA 4 heures en entreprise — équipe complète | Axion-IA",
  metaDescriptionFr:
    "Formation IA intra-entreprise de 4 h, tous postes, sans prérequis : vos équipes produisent avec l'IA dès le lendemain. Dans vos locaux, à partir de 1 200 € HT.",
  termesSemantiquesFr: [
    "prise en main",
    "dictée vocale",
    "méthode de prompt CRFE",
    "premiers usages",
    "comptes gratuits",
    "anonymisation",
  ],
  publicViseFr:
    "Tout salarié, tous postes mélangés (bureau, terrain, commercial, technique). Aucun pré-requis. Un smartphone suffit.",
  objectifsFr: [
    "Produire un texte professionnel au clavier ou en dictée vocale",
    "Formuler une demande qui donne un bon résultat du premier coup (méthode CRFE)",
    "Comprendre vite un document long : essentiel, points de vigilance, actions",
    "Faire refaire et améliorer jusqu'au résultat voulu, et repérer les inventions",
    "Anonymiser en 30 secondes et respecter la liste rouge des données sensibles",
  ],
  beneficeDirigeantFr:
    "Toute l'équipe au même niveau de base en une demi-journée, sans abonnement (comptes gratuits) — pas de fracture entre ceux qui se sont mis à l'IA et les autres.",
  equationTempsFr:
    "4 h investies par salarié → 30 à 60 min gagnées par jour dès la semaine suivante. Rentabilisée en moins de 2 semaines.",
  programme: [
    {
      titreFr: "Demi-journée (ex. 08h30–12h30)",
      steps: [
        { temps: "15'", titre: "Accueil et mise en route" },
        { temps: "25'", titre: "Première production réelle de chacun" },
        { temps: "35'", titre: "La méthode CRFE : Contexte, Rôle, Format, Exemple" },
        { temps: "30'", titre: "Comprendre un document long : synthèse, vigilances, actions" },
        { temps: "Pause", titre: "Pause" },
        { temps: "30'", titre: "Faire refaire jusqu'au résultat voulu + détecter les inventions" },
        { temps: "20'", titre: "La ligne rouge sécurité + anonymiser en 30 secondes" },
        { temps: "45'", titre: "Atelier libre sur SA tâche de demain" },
        { temps: "25'", titre: "Clôture, quiz, engagement individuel" },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il un ordinateur ?",
      reponse:
        "Non, un simple smartphone suffit pour chaque participant — et à deux sur un appareil, ça marche aussi. Aucun abonnement IA n'est requis : les exercices fonctionnent avec les comptes gratuits.",
    },
    {
      question: "Faut-il un niveau en IA pour participer ?",
      reponse:
        "Aucun. IA Express est conçue pour démarrer tous les postes en même temps, y compris ceux qui n'ont jamais essayé l'IA.",
    },
    {
      question: "Combien de personnes par session ?",
      reponse:
        "De 2 à 15 personnes (1 200 € HT) ou de 16 à 30 personnes (1 900 € HT), en intra-entreprise dans vos locaux.",
    },
    {
      question: "Peut-on former toute son équipe à l'IA en une demi-journée ?",
      reponse:
        "Oui : IA Express tient en 4 heures et mélange tous les postes, sans prérequis ni ordinateur. Chaque participant produit dès la séance et repart capable de travailler avec l'IA le lendemain.",
    },
  ],
};

const ART_DU_PROMPT: FormationV2 = {
  id: "art-du-prompt",
  slugFr: "art-du-prompt",
  slugEn: "prompt-mastery",
  numero: 2,
  gamme: "ia-standard",
  duree: "4h",
  prerequisFr: "Utiliser déjà l'IA (seul ou après IA Express) — vérifié au cadrage.",
  titreFr: "L'Art du Prompt (Niveau 2)",
  accrocheFr:
    "Vos équipes utilisent déjà l'IA mais les résultats sont moyens ? La compétence qui change tout, en 4 heures",
  h1Fr: "Savoir demander à l'IA : la compétence qui change tout",
  metaTitleFr: "Formation prompt engineering en français — niveau 2 | Axion-IA",
  metaDescriptionFr:
    "Formation prompt avancé intra-entreprise (4 h) pour équipes qui utilisent déjà l'IA : demandes efficaces, itération, gabarits. Dès 1 200 € HT.",
  termesSemantiquesFr: [
    "gabarits réutilisables",
    "itération",
    "few-shot",
    "contexte rôle format",
    "hallucinations",
    "fiabilité",
  ],
  publicViseFr:
    "Salariés qui ont déjà pratiqué l'IA (seuls ou après IA Express) et qui plafonnent : résultats génériques, reprises multiples, outil sous-exploité.",
  objectifsFr: [
    "Construire une demande avec les 6 leviers d'un prompt qui marche",
    "Itérer jusqu'à un niveau diffusable (critiques précises, rôle de relecteur)",
    "Adapter un même contenu à 3 destinataires différents",
    "Créer des gabarits réutilisables sans donnée sensible",
    "Repérer quand l'IA invente et la recadrer",
  ],
  beneficeDirigeantFr:
    "Ceux qui « bidouillent » l'IA deviennent ceux qui la maîtrisent — résultats constants, fini la loterie. Ces 4 heures multiplient le rendement des outils déjà payés.",
  equationTempsFr:
    "4 h investies → chaque tâche IA existante faite 2 à 3 fois plus vite. Rentabilisée en 1 à 2 semaines pour une équipe qui utilise déjà l'IA au quotidien.",
  programme: [
    {
      titreFr: "Demi-journée",
      steps: [
        { temps: "10'", titre: "Diagnostic éclair des prompts actuels" },
        { temps: "35'", titre: "Anatomie d'un prompt qui marche : les 6 leviers" },
        { temps: "35'", titre: "L'itération experte : critiques précises, rôle de relecteur" },
        { temps: "30'", titre: "Adapter un même contenu à 3 destinataires" },
        { temps: "Pause", titre: "Pause" },
        { temps: "35'", titre: "Exemples et gabarits réutilisables : la vraie puissance" },
        { temps: "25'", titre: "Chasse aux inventions + filtre confidentialité des gabarits" },
        { temps: "40'", titre: "Atelier : ma bibliothèque de 5 prompts/gabarits validés" },
        { temps: "15'", titre: "Clôture et quiz" },
      ],
    },
  ],
  faqs: [
    {
      question: "Pour qui est cette formation ?",
      reponse:
        "Pour les salariés qui utilisent déjà l'IA et veulent dépasser les résultats moyens. C'est la seule formation du catalogue avec un pré-requis (pratique préalable de l'IA), vérifié au cadrage.",
    },
    {
      question: "En quoi diffère-t-elle d'IA Express ?",
      reponse:
        "IA Express initie les débutants ; L'Art du Prompt fait passer les utilisateurs déjà à l'aise au niveau supérieur : prompts experts, itération, gabarits réutilisables.",
    },
    {
      question: "Comment écrire des prompts efficaces au travail ?",
      reponse:
        "On structure chaque demande avec contexte, rôle, format et exemple, puis on itère par critiques précises jusqu'à un résultat diffusable. La formation transforme cette méthode en gabarits réutilisables pour vos tâches récurrentes.",
    },
  ],
};

const IA_SECURITE: FormationV2 = {
  id: "ia-securite",
  slugFr: "ia-securite",
  slugEn: "ai-security",
  numero: 3,
  gamme: "ia-standard",
  duree: "4h",
  titreFr: "IA & Sécurité",
  accrocheFr:
    "Vos salariés utilisent déjà l'IA. Apprenez-leur à le faire sans risque pour l'entreprise",
  h1Fr: "Utiliser l'IA sans mettre l'entreprise en danger",
  metaTitleFr: "Formation IA sécurité des données en entreprise | Axion-IA",
  metaDescriptionFr:
    "Formation IA & sécurité intra-entreprise (4 h) : anonymisation, liste rouge, RGPD, charte d'usage en séance, risque shadow AI maîtrisé. Dès 1 200 € HT.",
  termesSemantiquesFr: [
    "anonymisation",
    "liste rouge",
    "données personnelles",
    "AI Act",
    "circuit d'alerte",
    "shadow AI",
    "conformité",
    "RGPD",
  ],
  publicViseFr:
    "Tout salarié ; dirigeant et DSI bienvenus. Format largement collectif (peu d'appareils requis). Complément individuel d'IA & Conformité (qui traite, elle, les obligations de l'entreprise).",
  objectifsFr: [
    "Identifier les données qui ne doivent jamais sortir de l'entreprise",
    "Anonymiser correctement un document ou une photo avant de le confier à une IA",
    "Distinguer les outils sûrs des outils à risque (gratuit vs pro, où vont les données)",
    "Vérifier ce que produit l'IA avant diffusion (client, administration)",
    "Appliquer les 4 réflexes RGPD et la charte d'usage de l'entreprise",
  ],
  beneficeDirigeantFr:
    "Vos salariés utilisent déjà l'IA, avec ou sans accord : après cette demi-journée, ils connaissent la ligne rouge et le risque RGPD/confidentialité est maîtrisé. Livrable : votre charte d'usage IA personnalisée.",
  equationTempsFr:
    "4 h investies → un seul incident évité (fuite de données client, document confidentiel dans un outil public) vaut des dizaines de fois le coût. Une assurance au prix d'une demi-journée.",
  programme: [
    {
      titreFr: "Demi-journée",
      steps: [
        { temps: "10'", titre: "Sondage dédramatisant" },
        { temps: "30'", titre: "Où vont vos données : démonstration factuelle gratuit vs pro" },
        {
          temps: "35'",
          titre: "La ligne rouge entreprise : 15 situations votées + votre liste rouge",
        },
        { temps: "30'", titre: "Anonymiser en 30 secondes : pratique sur ses documents" },
        { temps: "Pause", titre: "Pause" },
        { temps: "30'", titre: "Vérifier avant de diffuser : inventions, responsabilité" },
        { temps: "35'", titre: "RGPD sans jargon : les 4 réflexes, le circuit d'alerte interne" },
        { temps: "35'", titre: "La charte d'usage de l'entreprise rédigée en séance" },
        { temps: "20'", titre: "Clôture et quiz" },
      ],
    },
  ],
  faqs: [
    {
      question: "Quelle différence avec IA & Conformité ?",
      reponse:
        "IA & Sécurité traite les pratiques INDIVIDUELLES des salariés (anonymiser, vérifier, liste rouge). IA & Conformité traite les obligations de l'ENTREPRISE (AI Act, registre, plan 90 jours).",
    },
    {
      question: "Qu'est-ce qu'on repart avec ?",
      reponse:
        "Votre charte d'usage IA personnalisée, rédigée en séance, plus la liste rouge des données de l'entreprise et les réflexes RGPD pour chaque salarié.",
    },
    {
      question: "Que peut-on mettre dans une IA au travail ?",
      reponse:
        "Tout ce qui n'est ni une donnée personnelle, ni un secret professionnel, ni une information client identifiante. La formation construit votre liste rouge et apprend à anonymiser en 30 secondes avant de confier un document à une IA.",
    },
  ],
};

const IA_CONFORMITE: FormationV2 = {
  id: "ia-conformite",
  slugFr: "ia-conformite",
  slugEn: "ai-compliance",
  numero: 17,
  gamme: "ia-standard",
  duree: "4h",
  featured: true,
  titreFr: "IA & Conformité",
  accrocheFr: "Vos obligations d'employeur quand vos équipes utilisent l'IA",
  h1Fr: "Transformer l'obligation AI Act en feuille de route, en une demi-journée",
  metaTitleFr: "Formation AI Act en entreprise — obligations employeur | Axion-IA",
  metaDescriptionFr:
    "Formation AI Act intra-entreprise (4 h) : obligations employeur, cartographie des usages, registre v1 et plan 90 jours construits en séance. Dès 1 200 € HT.",
  termesSemantiquesFr: [
    "article 4 AI Act",
    "maîtrise de l'IA",
    "shadow AI",
    "registre des usages",
    "charte",
    "plan 90 jours",
    "attestations de formation",
    "responsabilité employeur",
    "RGPD",
  ],
  publicViseFr:
    "Dirigeants, RH, managers, référents, DPO. Format collectif, peu d'appareils requis. Aucun pré-requis.",
  objectifsFr: [
    "Identifier les obligations applicables (AI Act, RGPD, droit du travail) sans jargon",
    "Cartographier et classer les usages IA de l'entreprise (shadow AI compris)",
    "Constituer le dossier de conformité (registre, charte, preuves de formation)",
    "Piloter le plan de mise en conformité 90 jours",
    "Communiquer le cadre en interne sans freiner l'adoption",
  ],
  beneficeDirigeantFr:
    "Vous sortez avec VOTRE dossier de conformité démarré : cartographie, registre v1, plan 90 jours, trame de communication. L'obligation réglementaire transformée en feuille de route — et chaque formation Axion-IA suivie ensuite ajoute ses attestations au dossier.",
  equationTempsFr:
    "4 h investies → 4 livrables de conformité construits en séance (cartographie, registre, plan 90 jours, communication), qui auraient coûté plusieurs jours de conseil.",
  programme: [
    {
      titreFr: "Demi-journée",
      steps: [
        { temps: "10'", titre: "État des lieux éclair : le shadow AI révélé sans procès" },
        {
          temps: "35'",
          titre: "Ce que la réglementation impose vraiment : AI Act, RGPD, droit du travail",
        },
        {
          temps: "35'",
          titre: "Cartographier les usages IA réels (courant / sensible / à proscrire)",
        },
        { temps: "30'", titre: "Qui est responsable de quoi : employeur, manager, salarié" },
        { temps: "Pause", titre: "Pause" },
        { temps: "40'", titre: "Le dossier de conformité : registre v1 construit en séance" },
        {
          temps: "35'",
          titre: "Le plan de mise en conformité 90 jours : actions, responsables, échéances",
        },
        { temps: "25'", titre: "Communiquer en interne : « on encadre, on n'interdit pas »" },
        { temps: "15'", titre: "Clôture et quiz" },
      ],
    },
  ],
  faqs: [
    {
      question: "Pourquoi commencer par cette formation ?",
      reponse:
        "L'AI Act impose un niveau de maîtrise de l'IA à tout personnel qui l'utilise. C'est le point de départ logique : vous cadrez vos obligations, puis chaque formation suivie ajoute ses attestations à votre dossier de conformité.",
    },
    {
      question: "Est-ce un conseil juridique ?",
      reponse:
        "Non. C'est une formation et un outillage opérationnel ; elle ne constitue pas un conseil juridique individualisé.",
    },
    {
      question: "Comment se mettre en conformité avec l'AI Act ?",
      reponse:
        "On cartographie les usages réels, on classe les risques, puis on construit le registre v1 et un plan 90 jours. Les attestations de formation de vos équipes complètent le dossier comme élément de preuve de la maîtrise de l'IA exigée.",
    },
  ],
};

// ============================================================================
// GAMME IA STANDARD — FORMATS 1 JOUR
// ============================================================================

const IA_FONDAMENTAUX: FormationV2 = {
  id: "ia-fondamentaux",
  slugFr: "ia-fondamentaux",
  slugEn: "ai-fundamentals",
  numero: 4,
  gamme: "ia-standard",
  duree: "1j",
  titreFr: "IA Fondamentaux",
  accrocheFr: "Une journée pour passer toute l'équipe de débutant à autonome",
  h1Fr: "Rendre toute votre équipe autonome avec l'IA en une journée",
  metaTitleFr: "Formation IA 1 jour en entreprise — équipe autonome | Axion-IA",
  metaDescriptionFr:
    "Formation IA générative intra-entreprise (1 jour), sans prérequis : analyse de documents, livrable complet, boîte à outils personnelle. Dès 1 900 € HT.",
  termesSemantiquesFr: [
    "analyse de documents",
    "livrable professionnel",
    "panorama des outils",
    "boîte à outils",
    "autonomie",
  ],
  publicViseFr: "Tout salarié. Aucun pré-requis.",
  objectifsFr: [
    "Tout le contenu d'IA Express, ancré par une journée de pratique",
    "Analyser un document long et complexe et en tirer une synthèse fiable et vérifiée",
    "Produire un livrable complet de A à Z : dossier, proposition, support",
    "Travailler en plusieurs étapes : brouillon → critique → version finale",
    "Choisir le bon outil selon la tâche et se constituer sa boîte à outils personnelle",
  ],
  beneficeDirigeantFr:
    "Une équipe réellement autonome, pas juste initiée — chaque participant repart avec un vrai livrable terminé et sa boîte à outils, sans fracture entre les profils.",
  equationTempsFr:
    "1 jour investi → ~1 h gagnée par jour et par salarié. Sur une équipe de 8, l'équivalent d'un temps plein récupéré chaque mois. Rentabilisée en moins de 2 semaines.",
  programme: [
    {
      titreFr: "Matin",
      steps: [
        { temps: "60'", titre: "Mise en route et premières productions + méthode CRFE" },
        {
          temps: "45'",
          titre: "Analyse d'un document complexe de son poste : synthèse, vigilances",
        },
        {
          temps: "60'",
          titre: "Le livrable complet de A à Z (partie 1) : plan, structure, sections",
        },
        { temps: "30'", titre: "Vérification et chasse aux inventions" },
      ],
    },
    {
      titreFr: "Après-midi",
      steps: [
        { temps: "30'", titre: "Réactivation + bloc sécurité / anonymisation" },
        {
          temps: "60'",
          titre: "Le livrable complet (partie 2) : finalisation « diffusable », relecture croisée",
        },
        { temps: "45'", titre: "Panorama des outils : lequel pour quoi, démontré" },
        {
          temps: "50'",
          titre: "Atelier boîte à outils personnelle : 5-8 prompts/gabarits validés",
        },
        { temps: "25'", titre: "Clôture, quiz + livrable constaté" },
      ],
    },
  ],
  faqs: [
    {
      question: "Quelle différence avec IA Express ?",
      reponse:
        "IA Express (4 h) initie ; IA Fondamentaux (1 jour) rend autonome : chaque participant produit un livrable complet et repart avec sa boîte à outils, pas seulement une initiation.",
    },
    {
      question: "Faut-il un niveau préalable ?",
      reponse: "Aucun. La journée part des bases et amène chaque participant à l'autonomie.",
    },
    {
      question: "Quelle durée pour une formation IA ?",
      reponse:
        "Comptez 4 heures pour une initiation collective et une journée complète pour rendre l'équipe autonome avec un vrai livrable. Les formats 2 et 3 jours servent à transformer des tâches et des processus en profondeur.",
    },
  ],
};

const IA_COMMERCIAL: FormationV2 = {
  id: "ia-commercial",
  slugFr: "ia-commercial",
  slugEn: "ai-sales",
  numero: 5,
  gamme: "ia-standard",
  duree: "1j",
  titreFr: "IA & Commercial",
  accrocheFr: "Devis, propositions, relances : répondre plus vite et mieux que vos concurrents",
  h1Fr: "Répondre plus vite et mieux que vos concurrents grâce à l'IA",
  metaTitleFr: "Formation IA pour commerciaux — devis & relances | Axion-IA",
  metaDescriptionFr:
    "Formation IA pour la force de vente (1 jour) : devis et propositions 3× plus vite, réclamations, relances personnalisées. Intra-entreprise, dès 1 900 € HT.",
  termesSemantiquesFr: [
    "pipeline",
    "proposition commerciale",
    "réclamation",
    "relances personnalisées",
    "gabarit de devis",
  ],
  publicViseFr: "Commerciaux, ADV, SAV, dirigeants qui vendent.",
  objectifsFr: [
    "Traiter une demande client complexe dans la journée, complète et sans faute",
    "Produire devis et propositions depuis son gabarit (chiffres vérifiés à la main)",
    "Désamorcer une réclamation difficile par écrit : ton juste, réponse solide",
    "Préparer un rendez-vous en 10 minutes : fiche client, arguments, objections",
    "Relancer avec des séquences personnalisées, sans y passer ses soirées",
  ],
  beneficeDirigeantFr:
    "Les réponses partent en heures, plus en jours — et le premier qui répond bien est souvent celui qui signe. Plus d'affaires traitées par commercial, sans embaucher.",
  equationTempsFr:
    "1 jour investi → des propositions 2 à 3 fois plus rapides à produire. Un seul devis signé en plus rembourse la formation ; le reste de l'année est du gain net.",
  programme: [
    {
      titreFr: "Matin — répondre",
      steps: [
        { temps: "40'", titre: "Bases express orientées vente + anonymisation client" },
        { temps: "45'", titre: "La demande client complexe traitée le jour même" },
        {
          temps: "60'",
          titre: "Devis et propositions 3× plus vite : gabarit personnel construit et testé",
        },
        { temps: "30'", titre: "La réclamation désamorcée par écrit" },
      ],
    },
    {
      titreFr: "Après-midi — conquérir",
      steps: [
        { temps: "45'", titre: "Préparer un RDV en 10 minutes + jeu de rôle" },
        { temps: "45'", titre: "Relances qui obtiennent des réponses : séquence de 3 relances" },
        {
          temps: "60'",
          titre: "Atelier pipeline réel : on vide les dossiers en attente en séance",
        },
        { temps: "35'", titre: "Bibliothèque commerciale d'équipe" },
        { temps: "25'", titre: "Clôture" },
      ],
    },
  ],
  faqs: [
    {
      question: "Travaille-t-on sur nos vraies affaires ?",
      reponse:
        "Oui : l'atelier pipeline vide vos dossiers en attente en séance, avec votre gabarit de devis et vos séquences de relance — la formation produit du chiffre d'affaires visible.",
    },
    {
      question: "Les chiffres des devis sont-ils générés par l'IA ?",
      reponse:
        "Non : l'IA structure et rédige, mais les montants restent vérifiés à la main. On vous apprend justement à fiabiliser avant d'envoyer.",
    },
    {
      question: "Peut-on faire ses devis avec l'intelligence artificielle ?",
      reponse:
        "Oui : on construit votre gabarit de devis et l'IA le remplit trois fois plus vite à partir de la demande client. Les chiffres restent vérifiés à la main ; vous gagnez sur la rédaction, pas sur le contrôle.",
    },
  ],
};

const IA_AU_BUREAU: FormationV2 = {
  id: "ia-au-bureau",
  slugFr: "ia-au-bureau",
  slugEn: "ai-at-the-office",
  numero: 6,
  gamme: "ia-standard",
  duree: "1j",
  titreFr: "IA au bureau",
  accrocheFr: "Documents, courriers, dossiers : produire deux fois plus vite",
  h1Fr: "Produire vos documents et courriers deux fois plus vite",
  metaTitleFr: "Formation IA assistante administrative & secrétariat | Axion-IA",
  metaDescriptionFr:
    "Formation IA pour l'administratif (1 jour) : gabarits de courriers, dépouillement de dossiers, réponses aux administrations, suivi. Dès 1 900 € HT.",
  termesSemantiquesFr: [
    "assistante administrative",
    "gabarits de courriers",
    "comptes rendus",
    "dossiers",
    "échéancier",
    "suivi sans ressaisie",
    "RH et paie",
  ],
  publicViseFr:
    "Tout collaborateur qui produit des documents au quotidien : assistant(e)s, secrétariat et office management, gestion, comptabilité et paie, RH, ADV et services généraux — mais aussi chefs de projet, managers, professions libérales et indépendants. Aucun profil technique requis.",
  imageSrc:
    "/illustrations/formations/fiches/ia-au-bureau-administratif-secretariat-formation-ia-axion-ia.webp",
  imageAltFr:
    "Formation IA au bureau Axion-IA — poste administratif (secrétariat, gestion) accompagné par l'IA pour produire courriers, comptes rendus et dossiers deux fois plus vite.",
  imageCredit: { name: "Arisa Chattasa", url: "https://unsplash.com/@golfarisa" },
  objectifsFr: [
    "Créer ses gabarits de documents et courriers récurrents",
    "Transformer des notes en vrac en document propre et diffusable",
    "Dépouiller un dossier épais : synthèse, échéancier, pièces manquantes",
    "Préparer les réponses aux administrations et organismes",
    "Tenir un suivi sans ressaisie (échanges → tableau → relances)",
  ],
  beneficeDirigeantFr:
    "L'administratif cesse d'être le goulot d'étranglement. La banque de gabarits remise au responsable = le savoir-faire administratif structuré, qui reste même si la personne part.",
  equationTempsFr:
    "1 jour investi → 1 à 2 h gagnées par jour sur les postes administratifs. Rentabilisée en une dizaine de jours ouvrés ; plusieurs semaines récupérées par personne sur l'année.",
  avantApresFr: {
    avant:
      "Courriers repris de zéro à chaque fois, dossiers épais dépouillés à la main, réponses aux administrations chronophages, suivi éparpillé entre mails et tableurs.",
    apres:
      "Des gabarits prêts à l'emploi, un dossier synthétisé en quelques minutes, des réponses préparées d'un clic, un suivi centralisé sans ressaisie.",
  },
  resultatsFr: [
    { valeur: "1 à 2 h", label: "gagnées par jour sur l'administratif" },
    { valeur: "~10 j", label: "ouvrés pour rentabiliser la formation" },
    { valeur: "1 journée", label: "sur site, sur vos vrais dossiers" },
  ],
  casUsageFr: [
    {
      texteFr:
        "Générer un courrier type (relance, convocation, attestation) à partir d'un modèle maison",
      imageSrc: "/illustrations/formations/fiches/ia-au-bureau/courrier-type-gabarit.webp",
      imageCredit: { name: "Towfiqu barbhuiya", url: "https://unsplash.com/@towfiqu999999" },
    },
    {
      texteFr: "Transformer des notes de réunion en compte rendu propre et diffusable",
      imageSrc: "/illustrations/formations/fiches/ia-au-bureau/compte-rendu-reunion.webp",
      imageCredit: { name: "Luke Southern", url: "https://unsplash.com/@lukesouthern" },
    },
    {
      texteFr: "Dépouiller un dossier épais : synthèse, échéancier, pièces manquantes",
      imageSrc: "/illustrations/formations/fiches/ia-au-bureau/dossier-synthese.webp",
      imageCredit: { name: "Wesley Tingey", url: "https://unsplash.com/@wesleyphotography" },
    },
    {
      texteFr: "Préparer une réponse à une administration ou un organisme",
      imageSrc: "/illustrations/formations/fiches/ia-au-bureau/reponse-administration.webp",
      imageCredit: { name: "Romain Dancre", url: "https://unsplash.com/@romaindancre" },
    },
    {
      texteFr: "Tenir un suivi (échanges → tableau → relances) sans ressaisie",
      imageSrc: "/illustrations/formations/fiches/ia-au-bureau/suivi-relances.webp",
      imageCredit: { name: "Carlos Muza", url: "https://unsplash.com/@kmuza" },
    },
    {
      texteFr: "Constituer une banque de gabarits réutilisable par toute l'équipe",
      imageSrc: "/illustrations/formations/fiches/ia-au-bureau/banque-gabarits.webp",
      imageCredit: { name: "Maksym Kaharlytskyi", url: "https://unsplash.com/@qwitka" },
    },
  ],
  programme: [
    {
      titreFr: "Matin — produire",
      steps: [
        { temps: "60'", titre: "Inventaire des 5 documents récurrents de chacun + bases" },
        {
          temps: "45'",
          titre:
            "L'usine à courriers : chaque courrier récurrent transformé en gabarit à variables",
        },
        { temps: "45'", titre: "Notes en vrac → document propre" },
        {
          temps: "45'",
          titre: "Le dossier épais dépouillé : synthèse, échéancier, pièces manquantes",
        },
      ],
    },
    {
      titreFr: "Après-midi — fiabiliser et suivre",
      steps: [
        {
          temps: "30'",
          titre: "Réactivation + liste rouge renforcée (RH, paie, données personnelles)",
        },
        {
          temps: "60'",
          titre: "Réponses aux administrations : une vraie réponse en attente traitée",
        },
        {
          temps: "60'",
          titre: "Atelier « mon stock » : banque de 5-8 gabarits couvrant 80 % du récurrent",
        },
        { temps: "35'", titre: "Suivi sans ressaisie : échanges → tableau → relances" },
        { temps: "25'", titre: "Clôture" },
      ],
    },
  ],
  faqs: [
    {
      question: "Qu'est-ce qui reste à l'entreprise ?",
      reponse:
        "La banque de gabarits (courriers, documents récurrents) remise au responsable : le savoir-faire administratif structuré, qui reste même en cas de départ.",
    },
    {
      question: "Est-ce adapté à la RH et la paie ?",
      reponse:
        "Oui, avec une liste rouge renforcée sur les données personnelles : on apprend à gagner du temps tout en protégeant les données sensibles.",
    },
    {
      question: "Comment rédiger les réponses aux administrations avec l'IA ?",
      reponse:
        "On part d'une vraie réponse en attente : l'IA structure le courrier à partir de vos pièces, vous vérifiez et validez. La formation produit des gabarits réutilisables pour vos échanges récurrents avec les organismes et administrations.",
    },
  ],
};

const IA_SUR_LE_TERRAIN: FormationV2 = {
  id: "ia-sur-le-terrain",
  slugFr: "ia-sur-le-terrain",
  slugEn: "ai-in-the-field",
  numero: 7,
  gamme: "ia-standard",
  duree: "1j",
  titreFr: "IA sur le terrain",
  accrocheFr: "Comptes rendus, photos, dictée vocale : tout depuis son téléphone",
  h1Fr: "Boucler le circuit terrain → bureau depuis un simple smartphone",
  metaTitleFr: "Formation IA terrain sur smartphone, sans ordinateur | Axion-IA",
  metaDescriptionFr:
    "Formation IA pour les équipes terrain (1 jour, smartphone) : comptes rendus dictés, signalements photo, documents depuis le téléphone. Dès 1 900 € HT.",
  termesSemantiquesFr: [
    "dictée vocale",
    "photo signalement",
    "compte rendu d'intervention",
    "mobilité",
    "non scolaire",
  ],
  publicViseFr:
    "Techniciens, ouvriers, chauffeurs, agents, atelier. Un smartphone suffit — aucun ordinateur de la journée. Format non scolaire.",
  objectifsFr: [
    "Produire un compte rendu structuré à la voix en quittant le site",
    "Rédiger un signalement exploitable depuis une photo (constat / cause / action / urgence)",
    "Reformuler un message délicat avant de l'envoyer au client ou au bureau",
    "Comprendre une consigne ou une notice via photo",
    "Boucler le circuit terrain → bureau en autonomie",
  ],
  beneficeDirigeantFr:
    "Les comptes rendus arrivent le soir même, propres et exploitables — fini les rapports en retard ou illisibles, et le bureau ne perd plus de temps à déchiffrer. Une fiche plastifiée format poche est remise.",
  equationTempsFr:
    "1 jour investi → 30 à 45 min de paperasse en moins par jour et par personne de terrain, et des heures de ressaisie économisées au bureau. Rentabilisée en 2 à 3 semaines.",
  programme: [
    {
      titreFr: "Matin — parler, pas taper",
      steps: [
        { temps: "25'", titre: "Installation et test du micro" },
        { temps: "45'", titre: "Le compte rendu dicté : vrac parlé → CR structuré envoyé" },
        {
          temps: "45'",
          titre: "La photo qui parle : signalement (constat / cause / action / urgence)",
        },
        { temps: "40'", titre: "Messages délicats reformulés avant envoi" },
        { temps: "40'", titre: "Comprendre une consigne ou une notice via photo" },
      ],
    },
    {
      titreFr: "Après-midi — ancrer dans la journée type",
      steps: [
        { temps: "20'", titre: "Sécurité version terrain" },
        {
          temps: "60'",
          titre:
            "Le circuit complet en binômes : consigne → intervention → photo → CR dicté → message au bureau",
        },
        {
          temps: "60'",
          titre: "Atelier « ma semaine » : raccourcis installés, rapports en retard traités",
        },
        { temps: "40'", titre: "Mes documents récurrents en dictée + gabarit" },
        { temps: "30'", titre: "Clôture avec évaluation PRATIQUE (pas de quiz écrit)" },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il un ordinateur ?",
      reponse:
        "Non : un smartphone suffit, on n'ouvre aucun ordinateur de la journée. Le format est volontairement non scolaire, pensé pour les équipes de terrain.",
    },
    {
      question: "C'est quoi le bénéfice pour le bureau ?",
      reponse:
        "Les comptes rendus arrivent le soir même, propres et structurés : fini la ressaisie et les rapports illisibles ou en retard.",
    },
    {
      question: "Comment faire ses comptes rendus d'intervention à la voix ?",
      reponse:
        "On dicte le déroulé en quittant le site et l'IA le met en forme en compte rendu structuré, prêt à envoyer. La journée entraîne ce réflexe sur smartphone, plus le signalement à partir d'une photo (constat, cause, action, urgence).",
    },
  ],
};

const AUTOMATISATIONS_DECOUVERTE: FormationV2 = {
  id: "automatisations-decouverte",
  slugFr: "automatisations-decouverte",
  slugEn: "automation-discovery",
  numero: 8,
  gamme: "ia-standard",
  duree: "1j",
  titreFr: "Automatisations IA Découverte",
  accrocheFr: "Une journée pour voir ce que l'automatisation peut faire pour votre entreprise",
  h1Fr: "Découvrir ce que l'automatisation IA peut faire pour votre entreprise",
  metaTitleFr: "Formation découverte automatisation IA en entreprise | Axion-IA",
  metaDescriptionFr:
    "Journée découverte de l'automatisation IA en intra-entreprise : repérer les tâches automatisables, chiffrer les gains, plan priorisé. Dès 1 900 € HT.",
  termesSemantiquesFr: [
    "déclencheur traitement action",
    "matrice gain difficulté",
    "plan d'automatisation",
    "ROI",
    "tâches répétitives",
  ],
  publicViseFr:
    "Tout salarié et encadrement ; dirigeant invité à la restitution finale. Aucun matériel participant requis. Journée démonstrative : on identifie, on chiffre, on priorise — on ne construit pas (c'est l'objet des formats 2-3 jours).",
  objectifsFr: [
    "Expliquer le principe d'une automatisation : déclencheur → traitement → action",
    "Identifier dans son poste les tâches automatisables — et celles qui ne le sont pas",
    "Estimer ce que chaque automatisation ferait gagner (temps, délais, erreurs)",
    "Prioriser les 3-5 premières automatisations (matrice gain / difficulté)",
  ],
  beneficeDirigeantFr:
    "Avant d'investir, savoir exactement quoi automatiser et ce que ça rapporterait. Vous repartez avec un plan d'automatisation priorisé et chiffré par vos propres équipes — la feuille de route, pas un discours.",
  equationTempsFr:
    "1 jour investi → un plan d'automatisation chiffré qui aurait coûté plusieurs jours de conseil. Et chaque mauvais investissement évité vaut bien plus que la journée.",
  programme: [
    {
      titreFr: "Matin — comprendre et voir",
      steps: [
        { temps: "20'", titre: "La tâche que je refais sans cesse" },
        {
          temps: "40'",
          titre:
            "Anatomie d'une automatisation : déclencheur → traitement → action, 3 démos en direct",
        },
        { temps: "45'", titre: "Démonstrations sur VOS cas sectoriels" },
        {
          temps: "60'",
          titre: "Atelier chasse aux tâches : inventaire par service avec la grille AUTO",
        },
        { temps: "30'", titre: "Ce qui ne s'automatise PAS" },
      ],
    },
    {
      titreFr: "Après-midi — chiffrer et décider",
      steps: [
        { temps: "60'", titre: "Chiffrage des gains : heures/an, erreurs, délais" },
        {
          temps: "45'",
          titre: "La matrice gain / difficulté : priorisation collective des 3-5 premières",
        },
        {
          temps: "60'",
          titre: "Le plan d'action : description, données, contrôle humain, voie de réalisation",
        },
        { temps: "45'", titre: "Restitution au dirigeant + quiz" },
      ],
    },
  ],
  faqs: [
    {
      question: "Construit-on des automatisations ce jour-là ?",
      reponse:
        "Non : c'est une journée démonstrative pour identifier, chiffrer et prioriser. La construction relève des formats 2-3 jours (gamme Agents & Automatisations) ou du développement clé en main.",
    },
    {
      question: "Qu'est-ce qu'on repart avec ?",
      reponse:
        "Le plan d'automatisation de l'entreprise : les 3-5 premières automatisations priorisées et chiffrées, prêtes à réaliser ensuite par vos équipes ou en clé en main.",
    },
    {
      question: "Quelles tâches automatiser avec l'IA dans une PME ?",
      reponse:
        "Les tâches répétitives, à règles claires et déclenchées par un événement : saisies, relances, tris, mises en forme. La journée les inventorie par service, chiffre les gains et les classe sur une matrice gain / difficulté.",
    },
  ],
};

// ============================================================================
// GAMME IA STANDARD — FORMATS 2 JOURS
// ============================================================================

const IA_INTEGRATION_METIER: FormationV2 = {
  id: "ia-integration-metier",
  slugFr: "ia-integration-metier",
  slugEn: "ai-business-integration",
  numero: 9,
  gamme: "ia-standard",
  duree: "2j",
  titreFr: "IA Intégration métier",
  accrocheFr: "Vos 5 tâches les plus chronophages transformées avant la fin de la formation",
  h1Fr: "Vos 5 tâches les plus chronophages transformées avant la fin",
  metaTitleFr: "Formation IA métier 2 jours — tâches transformées | Axion-IA",
  metaDescriptionFr:
    "Formation IA intégration métier (2 jours) : chaque participant transforme ses 5 tâches les plus chronophages en séance, kit d'équipe remis. Dès 3 600 € HT.",
  termesSemantiquesFr: [
    "tâches chronophages",
    "gabarits reproductibles",
    "kit d'équipe",
    "bibliothèque de prompts",
    "gains de temps mesurés",
  ],
  publicViseFr: "Tout salarié ; équipes constituées recommandées.",
  objectifsFr: [
    "Tout le contenu d'IA Fondamentaux",
    "Transformer réellement ses 3 à 5 tâches chronophages avec gabarits reproductibles",
    "Vérifier et fiabiliser systématiquement ce que produit l'IA avant diffusion",
    "Contribuer au kit d'équipe (bibliothèque de modèles validés) et le faire vivre",
    "Transmettre les bonnes pratiques à un collègue",
  ],
  beneficeDirigeantFr:
    "On ne repart pas avec des intentions : les méthodes de travail sont déjà transformées à la fin du jour 2. L'entreprise garde un kit complet et les gains ne dépendent plus de la motivation de chacun.",
  equationTempsFr:
    "2 jours investis → les 5 tâches les plus lourdes de chaque participant accélérées de 50 à 80 %, dès le retour au poste. Rentabilisée en 3 à 4 semaines, puis gains permanents.",
  programme: [
    {
      titreFr: "Jour 1 — la maîtrise",
      steps: [
        {
          temps: "Jour 1",
          titre:
            "Tout le programme IA Fondamentaux (productions, document complexe, livrable de A à Z, panorama outils, sécurité)",
        },
        {
          temps: "Fin J1",
          titre:
            "Préparation du J2 : validation avec le formateur de la liste de 5 tâches cibles et des matériaux",
        },
      ],
    },
    {
      titreFr: "Jour 2 — la transformation",
      steps: [
        { temps: "30'", titre: "Réactivation" },
        { temps: "75'", titre: "Tâche 1 de chacun transformée, gabarit documenté au kit d'équipe" },
        {
          temps: "90'",
          titre:
            "Tâches 2 et 3 — règle qualité : « transformée » = diffusable ET reproductible, testé 2 fois",
        },
        { temps: "90'", titre: "Tâches 4 et 5, entraide organisée" },
        { temps: "45'", titre: "Fiabilisation transverse de toutes les productions" },
        { temps: "45'", titre: "Le kit d'équipe finalisé et remis au responsable" },
        { temps: "30'", titre: "Clôture : quiz + comptage des tâches transformées" },
      ],
    },
  ],
  faqs: [
    {
      question: "Les gains sont-ils réels en fin de formation ?",
      reponse:
        "Oui : les tâches transformées sont CONSTATÉES en fin de jour 2 (diffusables et reproductibles, testées deux fois), pas promises pour plus tard.",
    },
    {
      question: "Qu'est-ce qui reste à l'entreprise ?",
      reponse:
        "Le kit d'équipe : bibliothèque de modèles validés + règles d'usage écrites, remis au responsable — les gains sont standardisés, pas individuels.",
    },
    {
      question: "Comment transformer ses 5 tâches les plus chronophages avec l'IA ?",
      reponse:
        "Chaque participant liste ses tâches lourdes, les valide avec le formateur, puis les reconstruit en gabarits diffusables et reproductibles, testés deux fois. À la fin du jour 2, les 5 tâches sont réellement transformées, pas promises.",
    },
  ],
};

const IA_COMMERCIAL_AVANCE: FormationV2 = {
  id: "ia-commercial-avance",
  slugFr: "ia-commercial-avance",
  slugEn: "ai-sales-advanced",
  numero: 10,
  gamme: "ia-standard",
  duree: "2j",
  titreFr: "IA & Commercial avancé",
  accrocheFr: "Tout le cycle de vente passé à l'IA : de la prospection à la signature",
  h1Fr: "Tout le cycle de vente passé à l'IA, de la prospection à la signature",
  metaTitleFr: "Formation IA commerciale avancée — appels d'offres | Axion-IA",
  metaDescriptionFr:
    "Formation IA commerciale avancée (2 jours) : prospection personnalisée, appels d'offres, propositions différenciantes, bibliothèque d'équipe. Dès 3 600 € HT.",
  termesSemantiquesFr: [
    "mémoire technique",
    "matrice de conformité",
    "message-souche",
    "bibliothèque commerciale",
    "pipeline réel",
  ],
  publicViseFr: "Commerciaux confirmés, responsables commerciaux, ADV impliquée dans les offres.",
  objectifsFr: [
    "Tout le contenu d'IA & Commercial",
    "Prospecter en série personnalisée, dans les règles (déontologie)",
    "Décortiquer un appel d'offres et bâtir la trame de réponse + matrice de conformité",
    "Produire une proposition différenciante (objections, récit client)",
    "Dérouler des séquences de relance multi-touches et faire vivre la bibliothèque d'équipe",
  ],
  beneficeDirigeantFr:
    "Le jour 2 traite VOS affaires en cours — des réponses d'appels d'offres et des propales qui partent, plus la bibliothèque commerciale d'équipe qui reste même quand un commercial s'en va.",
  equationTempsFr:
    "2 jours investis → capacité de prospection et de réponse multipliée à effectif constant. Une seule affaire gagnée grâce à une réponse plus rapide ou plus soignée rembourse la formation plusieurs fois.",
  programme: [
    {
      titreFr: "Jour 1 — le cycle complet",
      steps: [
        { temps: "40'", titre: "Socle express vente" },
        {
          temps: "60'",
          titre:
            "Prospection : message-souche + personnalisation réelle, mini-campagne de 10 messages (+ déontologie)",
        },
        {
          temps: "75'",
          titre:
            "L'appel d'offres décortiqué : exigences, preuves, trame, matrice de conformité — sur un vrai AO",
        },
        {
          temps: "75'",
          titre: "La proposition qui gagne : différenciation, objections, récit client",
        },
        { temps: "60'", titre: "Séquences de relance 4 touches pour 2 dossiers dormants" },
        { temps: "75'", titre: "Bibliothèque commerciale v1" },
      ],
    },
    {
      titreFr: "Jour 2 — les affaires réelles",
      steps: [
        { temps: "30'", titre: "Tri du pipeline avec le formateur" },
        {
          temps: "165'",
          titre:
            "Sprint affaires 1 : AO/propales/relances réels traités, grille avant statut « prêt à partir »",
        },
        { temps: "120'", titre: "Sprint affaires 2 + comptage des livrables prêts" },
        { temps: "45'", titre: "Bibliothèque v2 + rituel d'équipe hebdo, remise au responsable" },
        { temps: "45'", titre: "Clôture" },
      ],
    },
  ],
  faqs: [
    {
      question: "Travaille-t-on sur un vrai appel d'offres ?",
      reponse:
        "Oui : on décortique un de vos vrais AO (exigences, matrice de conformité, trame) et le jour 2 traite vos affaires en cours jusqu'au statut « prêt à partir ».",
    },
    {
      question: "Quelle différence avec IA & Commercial (1 jour) ?",
      reponse:
        "Le 1 jour couvre devis/propositions/relances ; l'avancé ajoute la prospection en série, les appels d'offres et un jour entier sur vos affaires réelles.",
    },
    {
      question: "Comment répondre à un appel d'offres avec l'IA ?",
      reponse:
        "On décortique un vrai AO en exigences et preuves, on bâtit la trame de réponse et la matrice de conformité, puis l'IA aide à produire une proposition différenciante. Le jour 2 traite vos affaires en cours jusqu'au statut « prêt à partir ».",
    },
  ],
};

// ============================================================================
// GAMME IA STANDARD — FORMAT 3 JOURS
// ============================================================================

const IA_TRANSFORMATION_EQUIPE: FormationV2 = {
  id: "ia-transformation-equipe",
  slugFr: "ia-transformation-equipe",
  slugEn: "ai-team-transformation",
  numero: 11,
  gamme: "ia-standard",
  duree: "3j",
  titreFr: "IA Transformation d'équipe",
  accrocheFr: "Vos processus passés à l'IA, des référents formés, une équipe autonome",
  h1Fr: "Rendre votre équipe autonome sur l'IA en 3 jours, sans prestataire",
  metaTitleFr: "Formation transformation IA d'équipe 3 jours | Axion-IA",
  metaDescriptionFr:
    "Formation transformation IA (3 jours) : 2 processus passés à l'IA, des référents internes formés, un tableau de bord des gains direction. Dès 4 900 € HT.",
  termesSemantiquesFr: [
    "processus de bout en bout",
    "points de contrôle humain",
    "tableau de bord des gains",
    "gouvernance",
    "restitution direction",
  ],
  publicViseFr:
    "Équipe constituée + 1-2 référents volontaires ; direction présente à la restitution finale.",
  objectifsFr: [
    "Tout le contenu d'IA Intégration métier",
    "Outiller un processus complet de bout en bout avec points de contrôle humain",
    "Choisir les bons outils et arrêter de payer des abonnements inutiles",
    "Chiffrer ses propres gains (temps, délais, qualité), présentables à la direction",
    "Pour 1-2 référents : intégrer les nouveaux arrivants et faire vivre les méthodes en interne",
  ],
  beneficeDirigeantFr:
    "L'autonomie complète : 2 processus transformés, des référents internes capables de former les suivants, un tableau de bord des gains et le dossier complet remis à la direction. Plus besoin de prestataire pour les usages courants.",
  equationTempsFr:
    "3 jours investis une fois → des processus accélérés en permanence, des référents qui forment les nouveaux (chaque embauche opérationnelle sans coût externe), et des abonnements inutiles résiliés. L'investissement formation le plus durable du catalogue.",
  programme: [
    {
      titreFr: "Jours 1-2 — la maîtrise et la transformation",
      steps: [
        {
          temps: "Jours 1-2",
          titre:
            "Tout le programme IA Intégration métier (maîtrise + 5 tâches transformées par personne + kit d'équipe)",
        },
      ],
    },
    {
      titreFr: "Jour 3 — l'organisation",
      steps: [
        { temps: "30'", titre: "Bascule d'échelle" },
        {
          temps: "90'",
          titre:
            "Processus n°1 de bout en bout : cartographie, étapes outillées, points de contrôle humain, filtre confidentialité, testé sur 2 cas réels",
        },
        { temps: "90'", titre: "Processus n°2, conduit par les référents" },
        {
          temps: "45'",
          titre:
            "Le ménage dans les outils : inventaire des abonnements IA, garder/tester/résilier",
        },
        {
          temps: "60'",
          titre:
            "Mesurer ses gains : indicateurs simples, tableau de bord 1 page + revue sécurité des processus",
        },
        {
          temps: "45'",
          titre:
            "Atelier référents : intégrer un nouveau en 1 h, faire vivre le kit, mise en situation",
        },
        {
          temps: "45'",
          titre:
            "Restitution direction : processus, kit, charte, tableau de bord, rôle des référents",
        },
        { temps: "15'", titre: "Clôture" },
      ],
    },
  ],
  faqs: [
    {
      question: "L'équipe devient-elle vraiment autonome ?",
      reponse:
        "Oui : 2 processus transformés, des référents internes capables de former les suivants et un tableau de bord des gains — l'équipe ne dépend plus du formateur.",
    },
    {
      question: "Faut-il une équipe déjà constituée ?",
      reponse:
        "C'est recommandé, avec 1-2 référents volontaires, et la direction présente à la restitution finale pour s'approprier le dispositif.",
    },
    {
      question: "Comment former des référents IA en interne ?",
      reponse:
        "Le jour 3 outille 1-2 volontaires : intégrer un nouvel arrivant en une heure, faire vivre le kit d'équipe et animer une revue mensuelle. Ils deviennent autonomes pour former les suivants, sans recourir à un prestataire externe.",
    },
  ],
};

// ============================================================================
// GAMME AGENTS & AUTOMATISATIONS (groupes limités à 12, code source)
// ============================================================================

const AGENTS_AUTOMATISATIONS: FormationV2 = {
  id: "agents-automatisations",
  slugFr: "agents-automatisations",
  slugEn: "agents-automations",
  numero: 12,
  gamme: "agents-automatisations",
  duree: "2j",
  prerequisFr:
    "PC avec droits d'installation (point réglé avec votre DSI à J-15, à notre initiative). Aucune connaissance en programmation requise.",
  titreFr: "Agents & Automatisations",
  accrocheFr: "Créez vos propres automatisations IA, sans savoir coder",
  h1Fr: "Faire écrire vos automatisations par l'IA — le code reste à l'entreprise",
  metaTitleFr: "Formation créer ses automatisations IA sans coder | Axion-IA",
  metaDescriptionFr:
    "Formation Agents & Automatisations (2 jours, groupe 2-12) : vos équipes créent des automatisations en code source, propriété de l'entreprise. 3 600 € HT.",
  termesSemantiquesFr: [
    "code source généré par l'IA",
    "propriété du code",
    "zéro abonnement",
    "spécification en français",
    "DSI",
    "gestion d'erreurs",
  ],
  publicViseFr:
    "Tout salarié SANS connaissance en programmation. L'IA écrit le code en clair : il appartient à l'entreprise, documenté, zéro abonnement à une plateforme. Groupe limité à 12 pour l'accompagnement individuel.",
  objectifsFr: [
    "Spécifier une automatisation en français (fiche de spec)",
    "Faire écrire, lire, tester et corriger le code en dialoguant avec l'IA",
    "Sécuriser les données et les secrets (jamais en clair)",
    "Livrer une automatisation fonctionnelle, documentée — propriété de l'entreprise",
  ],
  beneficeDirigeantFr:
    "Des tâches répétitives qui tournent toutes seules, créées par vos propres salariés : zéro abonnement mensuel, zéro dépendance à un prestataire, et le code appartient à l'entreprise. Chaque participant ressort avec une automatisation réelle en fonctionnement.",
  equationTempsFr:
    "2 jours investis → chaque automatisation créée fait gagner de 15 min à plusieurs heures par jour, indéfiniment, sans coût récurrent. Une tâche quotidienne de 30 min automatisée = plus de 100 h récupérées par an et par participant.",
  programme: [
    {
      titreFr: "Jour 1 — comprendre et construire ensemble",
      steps: [
        { temps: "45'", titre: "Vérification des environnements" },
        {
          temps: "45'",
          titre:
            "Comment ça marche sans jargon : vous DEMANDEZ le code, le LISEZ en français, le TESTEZ",
        },
        {
          temps: "105'",
          titre:
            "Automatisation collective n°1 guidée pas à pas, avec bug volontaire corrigé par chacun",
        },
        {
          temps: "45'",
          titre: "Lire sans savoir coder : les 5 questions à poser à l'IA sur tout code",
        },
        { temps: "75'", titre: "Automatisation collective n°2 avec gestion d'erreur" },
        {
          temps: "60'",
          titre: "Spécifier MON automatisation : la fiche de spec en français, faisabilité validée",
        },
        { temps: "30'", titre: "Sécurité : données, secrets jamais en clair" },
      ],
    },
    {
      titreFr: "Jour 2 — chacun la sienne",
      steps: [
        {
          temps: "180'",
          titre: "Sprint de construction individuelle, formateur en rotation garantie",
        },
        {
          temps: "105'",
          titre:
            "Fiabiliser : cas d'erreur, messages clairs, test par un voisin, documentation générée",
        },
        {
          temps: "60'",
          titre:
            "Démonstrations : chaque automatisation tourne + doc 1 page, inventaire remis à l'entreprise et à la DSI",
        },
        { temps: "45'", titre: "Clôture" },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il savoir coder ?",
      reponse:
        "Non, aucune connaissance en programmation n'est requise : l'IA écrit le code, vos équipes le lisent en français, le testent et le pilotent. Groupe limité à 12 pour l'accompagnement.",
    },
    {
      question: "Le code nous appartient-il ?",
      reponse:
        "Oui : le code source est documenté, il appartient à l'entreprise et tourne chez vous, sans abonnement à une plateforme. Un inventaire est remis à votre DSI.",
    },
    {
      question: "Quelle différence avec la gamme Claude ?",
      reponse:
        "Ici vos équipes créent des automatisations autonomes en code source, indépendantes de tout outil. Dans la gamme Claude, chacun construit son outil dans l'environnement Claude.",
    },
    {
      question:
        "Peut-on avoir des automatisations qui appartiennent à l'entreprise sans abonnement ?",
      reponse:
        "Oui : l'IA écrit un code source en clair qui tourne chez vous, sans plateforme ni abonnement mensuel. Il est documenté, appartient à l'entreprise et un inventaire est remis à votre DSI — zéro dépendance à un prestataire.",
    },
  ],
};

const AGENTS_AUTOMATISATIONS_AVANCE: FormationV2 = {
  id: "agents-automatisations-avance",
  slugFr: "agents-automatisations-avance",
  slugEn: "agents-automations-advanced",
  numero: 13,
  gamme: "agents-automatisations",
  duree: "3j",
  prerequisFr:
    "Mêmes pré-requis que le niveau 2 jours + lieu d'exécution récurrente décidé avec la DSI au cadrage.",
  titreFr: "Agents & Automatisations avancé",
  accrocheFr:
    "Chaque participant construit et déploie son automatisation complète — en fonctionnement le dernier jour",
  h1Fr: "Construire ET déployer son automatisation complète, en fonctionnement le dernier jour",
  metaTitleFr: "Formation déploiement d'automatisations IA 3 jours | Axion-IA",
  metaDescriptionFr:
    "Formation Agents & Automatisations avancé (3 jours, groupe 2-12) : étendre, fiabiliser et déployer une automatisation qui tourne chaque jour. 4 900 € HT.",
  termesSemantiquesFr: [
    "exécution planifiée",
    "test du chaos",
    "check-list de mise en service",
    "dépôt central",
    "robustesse",
  ],
  publicViseFr: "Tout salarié sans connaissance en programmation. Groupe limité à 12.",
  objectifsFr: [
    "Tout le niveau 2 jours",
    "Étendre une automatisation : plusieurs étapes, plusieurs outils connectés",
    "Fiabiliser (erreurs gérées, journal d'activité, alertes d'échec, vérification des résultats)",
    "Déployer en exécution récurrente et savoir intervenir si ça s'arrête",
    "Être autonome pour créer la prochaine automatisation seul",
  ],
  beneficeDirigeantFr:
    "Des automatisations qui tournent TOUS LES JOURS (pas « chez moi ça marche ») — testées au chaos, déployées, inventoriées pour la DSI, et des salariés capables d'en créer d'autres seuls.",
  equationTempsFr:
    "3 jours investis → des automatisations robustes qui tournent sans surveillance, et la capacité d'en créer de nouvelles chaque mois. Chaque nouvelle automatisation créée en interne aurait coûté plusieurs milliers d'euros en développement externe.",
  programme: [
    {
      titreFr: "Jours 1-2 — tout le programme Agents & Automatisations",
      steps: [
        {
          temps: "Jours 1-2",
          titre: "Les 2 automatisations collectives + la sienne construite et documentée",
        },
      ],
    },
    {
      titreFr: "Jour 3 — robustesse et déploiement",
      steps: [
        { temps: "30'", titre: "État des automatisations, incidents de la nuit" },
        {
          temps: "90'",
          titre:
            "Monter en ambition : une étape de plus, une 2e source, ou enchaînement avec celle d'un collègue",
        },
        {
          temps: "90'",
          titre:
            "Fiabilisation sérieuse, les 4 piliers : erreurs gérées, journal d'activité, alertes d'échec, vérification des résultats",
        },
        {
          temps: "75'",
          titre:
            "Déployer pour de vrai : exécution planifiée, hébergement, dépôt central du code, check-list de mise en service signée",
        },
        {
          temps: "45'",
          titre:
            "Le test du chaos : 3 pannes organisées par un binôme, l'automatisation doit réagir proprement",
        },
        { temps: "45'", titre: "Démonstrations finales devant dirigeant/DSI" },
        { temps: "45'", titre: "Autonomie : la prochaine spécifiée et démarrée SEUL" },
      ],
    },
  ],
  faqs: [
    {
      question: "Les automatisations tournent-elles vraiment en production ?",
      reponse:
        "Oui : elles sont déployées en exécution récurrente, testées au « chaos » (pannes provoquées) et inventoriées pour la DSI — pas un « chez moi ça marche ».",
    },
    {
      question: "Que se passe-t-il si une automatisation s'arrête ?",
      reponse:
        "Vous apprenez à gérer les erreurs, lire le journal d'activité, recevoir des alertes d'échec et intervenir — et à en créer de nouvelles seul.",
    },
    {
      question: "Comment déployer une automatisation IA qui tourne tous les jours ?",
      reponse:
        "On met en place l'exécution planifiée, l'hébergement et un dépôt central du code, puis on signe une check-list de mise en service. Le test du chaos provoque des pannes pour vérifier que l'automatisation réagit proprement avant la production.",
    },
  ],
};

// ============================================================================
// GAMME CLAUDE — formateur certifié écosystème Claude (+20 %)
// ============================================================================

const CLAUDE_DECOUVERTE: FormationV2 = {
  id: "claude-decouverte",
  slugFr: "claude-decouverte",
  slugEn: "claude-discovery",
  numero: 14,
  gamme: "claude",
  duree: "1j",
  prerequisFr:
    "Comptes gratuits suffisent (les fonctions avancées sont démontrées par le formateur certifié).",
  titreFr: "Claude Découverte",
  accrocheFr: "Découvrir Claude et tout ce qu'il rend possible pour votre entreprise",
  h1Fr: "Évaluer Claude sur pièces en une journée, avec un formateur certifié",
  metaTitleFr: "Formation Claude en entreprise — formateur certifié | Axion-IA",
  metaDescriptionFr:
    "Formation Claude (Anthropic) en intra-entreprise (1 jour), animée par un formateur certifié : analyse de documents, Projets, confidentialité. Dès 2 300 € HT.",
  termesSemantiquesFr: [
    "Anthropic",
    "Projets Claude",
    "analyse de documents",
    "comparatif factuel",
    "confidentialité",
    "comptes gratuits",
    "formateur certifié",
  ],
  publicViseFr:
    "Tout salarié. Comptes gratuits suffisent (les fonctions avancées sont démontrées par le formateur certifié).",
  objectifsFr: [
    "Produire et analyser de vrais documents de travail avec Claude",
    "Construire un livrable fini (plan → sections → relecture-critique)",
    "Comprendre l'apport des Projets (instructions permanentes + base documentaire)",
    "Choisir l'outil adapté sur critères démontrés (Claude vs les autres)",
    "Appliquer les bonnes pratiques de confidentialité propres à Claude",
  ],
  beneficeDirigeantFr:
    "Évaluer sur pièces, en une journée et sans abonnement, si l'écosystème Claude est le bon investissement. Formation dispensée par un spécialiste certifié de l'écosystème Claude — une expertise que quasi aucun organisme ne propose en France.",
  equationTempsFr:
    "1 jour investi → ~1 h gagnée par jour et par salarié sur le travail documentaire, avec moins de reprises. Rentabilisée en moins de 2 semaines.",
  programme: [
    {
      titreFr: "Matin",
      steps: [
        {
          temps: "40'",
          titre: "Claude en 40 minutes : prise en main, documents joints, première production",
        },
        {
          temps: "45'",
          titre:
            "L'analyse de documents, point fort : synthèse, vigilances, comparaison de 2 versions",
        },
        { temps: "45'", titre: "Livrables finis : plan → sections → relecture-critique" },
        {
          temps: "45'",
          titre:
            "Démonstration commentée des Projets : instructions permanentes + base documentaire, avant/après",
        },
      ],
    },
    {
      titreFr: "Après-midi",
      steps: [
        {
          temps: "45'",
          titre: "Claude vs les autres : démonstration comparée factuelle sur 3 tâches",
        },
        {
          temps: "45'",
          titre: "Confidentialité version Claude : paramètres en direct, liste rouge",
        },
        { temps: "75'", titre: "Atelier d'application : 2-3 tâches réelles de sa semaine" },
        { temps: "45'", titre: "Et après ? Panorama honnête des comptes Pro/Team, quiz, clôture" },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il un abonnement payant ?",
      reponse:
        "Non pour Découverte : les comptes gratuits suffisent, et le formateur certifié démontre les fonctions avancées. Vous évaluez l'écosystème avant tout investissement.",
    },
    {
      question: "Pourquoi un formateur certifié Claude ?",
      reponse:
        "C'est un différenciateur : une expertise certifiée de l'écosystème Claude (Anthropic) que quasi aucun organisme ne propose en France.",
    },
    {
      question: "Claude ou ChatGPT pour mon entreprise ?",
      reponse:
        "La journée compare les outils sur trois tâches réelles, de façon factuelle et sans dénigrement. Vous repartez avec des critères de choix démontrés (analyse de documents, Projets, confidentialité) pour décider sur pièces, pas sur la réputation.",
    },
  ],
};

const CLAUDE_CREATEUR: FormationV2 = {
  id: "claude-createur",
  slugFr: "claude-createur",
  slugEn: "claude-creator",
  numero: 15,
  gamme: "claude",
  duree: "2j",
  prerequisFr:
    "Comptes Claude Pro ou Team actifs avant J1, fournis par l'entreprise (conseil licences offert au cadrage). Groupe limité à 12.",
  titreFr: "Claude Créateur",
  accrocheFr: "Chaque participant construit son propre outil IA pour son activité — et repart avec",
  h1Fr: "Chaque participant construit son propre outil IA — et repart avec",
  metaTitleFr: "Formation Claude Projets — assistant IA personnalisé | Axion-IA",
  metaDescriptionFr:
    "Formation Claude Créateur (2 jours, groupe 2-12, formateur certifié) : chaque salarié construit son assistant Claude sur ses vrais dossiers. 4 300 € HT.",
  termesSemantiquesFr: [
    "Projet Claude",
    "instructions permanentes",
    "base documentaire",
    "gabarits",
    "partage d'équipe",
    "formateur certifié",
  ],
  publicViseFr:
    "Tout salarié. Pré-requis : comptes Claude Pro ou Team actifs avant J1, fournis par l'entreprise. Groupe limité à 12. Formateur certifié écosystème Claude.",
  objectifsFr: [
    "Tout le contenu de Claude Découverte",
    "Construire son assistant personnalisé (métier, entreprise, formats, ton) configuré une fois pour toutes",
    "Organiser ses espaces de travail : un projet par activité, base documentaire intégrée",
    "Industrialiser ses tâches récurrentes avec ses modèles validés",
    "Protéger les données sensibles",
  ],
  beneficeDirigeantFr:
    "Chaque salarié repart avec un outil opérationnel configuré pour son poste — pas une compétence théorique, un actif qui reste dans l'entreprise et que les collègues peuvent dupliquer.",
  equationTempsFr:
    "2 jours investis → l'assistant configuré supprime la mise en contexte à chaque utilisation : les tâches récurrentes passent de 30 min à 5 min. Rentabilisée en 3 à 4 semaines, puis l'outil travaille tous les jours.",
  programme: [
    {
      titreFr: "Jour 1 — maîtriser l'environnement",
      steps: [
        { temps: "60'", titre: "Socle Claude condensé" },
        {
          temps: "105'",
          titre:
            "Mon premier Projet : instructions permanentes + base documentaire, test avant/après",
        },
        {
          temps: "90'",
          titre:
            "L'art des instructions permanentes : les 5 blocs (identité, formats, ton, interdits, exemples), revue croisée en binômes",
        },
        {
          temps: "90'",
          titre: "Industrialiser ses tâches récurrentes : gabarits testés en reproductibilité",
        },
        { temps: "30'", titre: "Préparation J2" },
      ],
    },
    {
      titreFr: "Jour 2 — mon outil sur mes vrais dossiers",
      steps: [
        {
          temps: "165'",
          titre: "Sprint dossiers réels 1 : chaque friction = amélioration immédiate de l'outil",
        },
        { temps: "90'", titre: "Sprint 2 + organisation multi-projets et partage d'équipe" },
        {
          temps: "60'",
          titre:
            "La revue de l'outil sur grille : répond juste sans re-contexte, formats conformes, interdits respectés, données protégées",
        },
        { temps: "60'", titre: "Démonstrations + doc de duplication + clôture" },
      ],
    },
  ],
  faqs: [
    {
      question: "Faut-il des comptes Claude payants ?",
      reponse:
        "Oui : des comptes Claude Pro ou Team actifs avant le jour 1, fournis par l'entreprise (indispensables pour construire et continuer à utiliser l'outil). Conseil sur les licences offert au cadrage.",
    },
    {
      question: "Qu'est-ce que chaque participant construit ?",
      reponse:
        "Son assistant personnalisé qui connaît son métier, ses formats et son ton, configuré une fois pour toutes — un actif qui reste dans l'entreprise et se duplique aux collègues.",
    },
    {
      question: "Comment construire son outil IA personnalisé avec Claude ?",
      reponse:
        "On crée un Projet Claude par activité, avec instructions permanentes (identité, formats, ton, interdits, exemples) et base documentaire intégrée. Chacun l'affine sur ses vrais dossiers jusqu'à un outil qui répond juste sans remise en contexte.",
    },
  ],
};

const CLAUDE_ARCHITECTE: FormationV2 = {
  id: "claude-architecte",
  slugFr: "claude-architecte",
  slugEn: "claude-architect",
  numero: 16,
  gamme: "claude",
  duree: "3j",
  prerequisFr:
    "Comptes Claude Pro ou Team actifs avant J1 + flux de travail réels identifiés au cadrage. Groupe limité à 12. Formateur certifié.",
  titreFr: "Claude Architecte",
  accrocheFr:
    "Son outil complet : assistant personnalisé, automatisations, espaces de travail — opérationnel le dernier jour",
  h1Fr: "Son outil IA complet, opérationnel le dernier jour",
  metaTitleFr: "Formation Claude avancée — outil IA complet 3 jours | Axion-IA",
  metaDescriptionFr:
    "Formation Claude Architecte (3 jours, groupe 2-12, formateur certifié) : chaque participant connecte son outil Claude à ses flux réels. 5 900 € HT.",
  termesSemantiquesFr: [
    "flux de travail",
    "routine quotidienne",
    "séquences multi-étapes",
    "versionnage des instructions",
    "test des 3 pièges",
  ],
  publicViseFr:
    "Tout salarié. Pré-requis : comptes Claude Pro ou Team actifs avant J1 + flux de travail réels identifiés au cadrage. Groupe limité à 12. Formateur certifié.",
  objectifsFr: [
    "Tout le contenu de Claude Créateur",
    "Connecter son outil au travail réel : documents, données, flux entrants",
    "Construire ses premières automatisations Claude pour ses tâches récurrentes",
    "Fiabiliser et faire évoluer son outil en autonomie (versionnage, revue mensuelle)",
  ],
  beneficeDirigeantFr:
    "Le niveau le plus avancé du marché : chaque participant possède son outil IA complet, construit par lui, opérationnel le dernier jour, qui travaille tous les jours sur ses flux réels — démontré devant vous.",
  equationTempsFr:
    "3 jours investis → un outil complet par participant, qui aurait coûté plusieurs milliers d'euros s'il avait été développé pour lui — et qu'il sait faire évoluer seul. L'actif reste, le gain se cumule.",
  programme: [
    {
      titreFr: "Jours 1-2 — tout le programme Claude Créateur",
      steps: [
        { temps: "Jours 1-2", titre: "Projet, instructions permanentes, gabarits, vrais dossiers" },
      ],
    },
    {
      titreFr: "Jour 3 — l'outil complet",
      steps: [
        { temps: "30'", titre: "Frictions de la veille traitées" },
        {
          temps: "90'",
          titre:
            "Connecter l'outil au travail réel : filtre confidentialité d'entrée, flux entrants organisés, la « tournée du matin » (30-45 min ce qui prenait 2-3 h)",
        },
        {
          temps: "90'",
          titre:
            "Automatiser DANS Claude : séquences réutilisables, traitements en série, générations multi-étapes",
        },
        {
          temps: "75'",
          titre:
            "Fiabiliser et faire évoluer seul : revue mensuelle, versionnage des instructions, le test des 3 pièges (inventer / violer un interdit / cas hors périmètre)",
        },
        {
          temps: "60'",
          titre: "Frontières et suite : ce qui relève de Claude, du code source, du clé en main",
        },
        { temps: "45'", titre: "Démonstrations finales devant l'entreprise + doc de duplication" },
        { temps: "30'", titre: "Clôture" },
      ],
    },
  ],
  faqs: [
    {
      question: "En quoi est-ce le niveau le plus avancé ?",
      reponse:
        "Chaque participant repart avec un outil COMPLET (assistant + automatisations + espaces de travail) connecté à ses flux réels et opérationnel — démontré devant l'entreprise le dernier jour.",
    },
    {
      question: "Quelle frontière avec la gamme Agents ?",
      reponse:
        "Claude Architecte automatise DANS l'environnement Claude ; la gamme Agents crée des automatisations autonomes en code source. Le jour 3 clarifie ce qui relève de chaque approche et du clé en main.",
    },
    {
      question: "Comment connecter Claude à ses flux de travail quotidiens ?",
      reponse:
        "Le jour 3 organise les flux entrants avec un filtre de confidentialité, met en place la « tournée du matin » et des séquences réutilisables multi-étapes. Ce qui prenait 2 à 3 heures se traite en 30 à 45 minutes, démontré sur vos flux réels.",
    },
  ],
};

// ============================================================================
// Registre + helpers (formations « sur mesure » par durée : cf. PLAN P1 lot
// suivant ; pour l'instant le devis passe par le CTA contact).
// ============================================================================

export const FORMATIONS_V2: ReadonlyArray<FormationV2> = [
  // 4 heures (gamme IA)
  IA_EXPRESS,
  ART_DU_PROMPT,
  IA_SECURITE,
  IA_CONFORMITE,
  // 1 jour (gamme IA)
  IA_FONDAMENTAUX,
  IA_COMMERCIAL,
  IA_AU_BUREAU,
  IA_SUR_LE_TERRAIN,
  AUTOMATISATIONS_DECOUVERTE,
  // 2 jours (gamme IA)
  IA_INTEGRATION_METIER,
  IA_COMMERCIAL_AVANCE,
  // 3 jours (gamme IA)
  IA_TRANSFORMATION_EQUIPE,
  // Gamme Agents & Automatisations
  AGENTS_AUTOMATISATIONS,
  AGENTS_AUTOMATISATIONS_AVANCE,
  // Gamme Claude
  CLAUDE_DECOUVERTE,
  CLAUDE_CREATEUR,
  CLAUDE_ARCHITECTE,
];

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
  return getFormationBrackets(f.gamme, f.duree);
}

/** Prix d'une formation pour une tranche (dérivé de la matrice prix). */
export function getFormationV2Price(f: FormationV2, bracket: FormationBracket): number | undefined {
  return getFormationPrice(f.gamme, f.duree, bracket);
}

/** Prix d'entrée d'une formation (« à partir de »). */
export function getFormationV2EntryPrice(f: FormationV2): number | undefined {
  return getFormationEntryPrice(f.gamme, f.duree);
}
