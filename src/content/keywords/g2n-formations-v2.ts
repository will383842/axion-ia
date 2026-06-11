/**
 * Keyword Strategy — Verticale FORMATIONS V2 (catalogue SSOT des 17 formations
 * intra-entreprise + page sur-mesure).
 *
 * Source du contenu :
 *   - `Downloads/formations-axion-ia/50-commercial/mots-cles-seo-formations.md`
 *   - `src/content/formations/catalog-v2.ts` (h1/metaTitle/metaDescription/slugFr)
 *
 * Une formation = 1 page = 1 `urlCible` `/fr/formations/<slugFr>`. La page
 * sur-mesure (pilier) cible `/fr/formations/sur-mesure`.
 *
 * Règle anti-cannibalisation (R5 + Section 1.7 du prompt master) :
 *   - EXACTEMENT 1 requête HEAD (`niveau: 1`) par `urlCible` = la « requête
 *     principale » du fichier source. Les secondaires sont `niveau: 2`
 *     (BODY → H2/H3) et la longue traîne `niveau: 3` (FAQ).
 *   - `niveau: 1` impose `priorite >= 2` (HEAD jamais attaquable immédiatement).
 *
 * Le champ `injection` aligne H1 / metaTitle / metaDescription / H2 sur
 * `catalog-v2.ts` (la page formation est la source d'affichage ; ces injections
 * servent au Content Engine et au monitoring, sans diverger du catalogue).
 *
 * Aucun montant € en dur ici : les prix vivent dans `pricing.ts`
 * (FORMATION_PRICE_MATRIX) → ce fichier ne porte que de la sémantique.
 *
 * Contenu 100 % FRANÇAIS (EN désactivé 301→FR).
 */

import type { KeywordSeed } from "./types";

const M = "interventions-formations" as const;

// ============================================================================
// GAMME IA STANDARD — 4 HEURES
// ============================================================================

// ── 1. IA Express (/fr/formations/ia-express) ──────────────────────────────
const IA_EXPRESS: KeywordSeed[] = [
  {
    keyword: "formation IA 4 heures entreprise",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-express",
    injection: {
      h1: "Former toute votre équipe à l'IA en une demi-journée",
      metaTitle: "Formation IA 4 heures en entreprise — équipe complète | Axion-IA",
      metaDescription:
        "Formation IA intra-entreprise de 4 h, tous postes, sans prérequis : vos équipes produisent avec l'IA dès le lendemain. Dans vos locaux.",
      h2Variants: [
        "Sensibilisation IA pour toute l'équipe, sans prérequis",
        "Initiation IA salariés : produire dès le lendemain",
      ],
    },
    note: "Sémantique : prise en main, dictée vocale, méthode de prompt CRFE, premiers usages, comptes gratuits. Secondaires : initiation IA salariés, formation ChatGPT entreprise courte, sensibilisation IA équipe, formation IA demi-journée.",
  },
  {
    keyword: "initiation IA salariés sans ordinateur",
    intent: "transactionnel",
    module: M,
    cible: "tpe",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-express",
  },
  {
    keyword: "former toute son équipe à l'IA en une demi-journée",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-express",
  },
  {
    keyword: "formation IA débutant tous postes confondus entreprise",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-express",
  },
];

// ── 2. L'Art du Prompt (/fr/formations/art-du-prompt) ──────────────────────
const ART_DU_PROMPT: KeywordSeed[] = [
  {
    keyword: "formation prompt engineering français",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/art-du-prompt",
    injection: {
      h1: "Savoir demander à l'IA : la compétence qui change tout",
      metaTitle: "Formation prompt engineering en français — niveau 2 | Axion-IA",
      metaDescription:
        "Formation prompt avancé intra-entreprise (4 h) pour équipes qui utilisent déjà l'IA : construire des demandes efficaces, itérer, créer ses gabarits.",
      h2Variants: [
        "Rédiger des prompts efficaces : les 6 leviers",
        "Améliorer ses prompts et créer ses gabarits réutilisables",
      ],
    },
    note: "Sémantique : gabarits réutilisables, itération, few-shot, contexte rôle format, hallucinations, fiabilité. Secondaires : formation rédiger des prompts, formation prompt avancé entreprise, améliorer ses prompts.",
  },
  {
    keyword: "formation prompt avancé entreprise niveau 2",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/art-du-prompt",
  },
  {
    keyword: "comment écrire des prompts efficaces au travail",
    intent: "voice_search",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/art-du-prompt",
  },
  {
    keyword: "formation prompt pour salariés qui utilisent déjà ChatGPT ou Claude",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/art-du-prompt",
  },
];

// ── 3. IA & Sécurité (/fr/formations/ia-securite) ──────────────────────────
const IA_SECURITE: KeywordSeed[] = [
  {
    keyword: "formation IA sécurité des données entreprise",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-securite",
    injection: {
      h1: "Utiliser l'IA sans mettre l'entreprise en danger",
      metaTitle: "Formation IA sécurité des données en entreprise | Axion-IA",
      metaDescription:
        "Formation IA & sécurité intra-entreprise (4 h) : anonymisation, liste rouge, RGPD, charte d'usage rédigée en séance. Maîtrisez le risque shadow AI.",
      h2Variants: [
        "Anonymiser et protéger les données avant de les confier à l'IA",
        "Charte d'usage IA rédigée en séance, réflexes RGPD",
      ],
    },
    note: "Sémantique : anonymisation, liste rouge, données personnelles, AI Act, circuit d'alerte, shadow AI, RGPD. Secondaires : formation RGPD intelligence artificielle, charte IA entreprise, confidentialité ChatGPT entreprise.",
  },
  {
    keyword: "charte d'utilisation de l'IA en entreprise",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-securite",
  },
  {
    keyword: "que peut-on mettre dans ChatGPT au travail",
    intent: "voice_search",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-securite",
  },
  {
    keyword: "encadrer le shadow AI des salariés formation",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-securite",
  },
];

// ── 17. IA & Conformité (/fr/formations/ia-conformite) ─────────────────────
const IA_CONFORMITE: KeywordSeed[] = [
  {
    keyword: "formation AI Act entreprise",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-conformite",
    injection: {
      h1: "Transformer l'obligation AI Act en feuille de route, en une demi-journée",
      metaTitle: "Formation AI Act en entreprise — obligations employeur | Axion-IA",
      metaDescription:
        "Formation AI Act intra-entreprise (4 h) : obligations employeur, cartographie des usages, registre v1 et plan 90 jours construits en séance.",
      h2Variants: [
        "Les obligations employeur de l'AI Act, sans jargon",
        "Registre des usages et plan 90 jours construits en séance",
      ],
    },
    note: "Sémantique : article 4 AI Act, maîtrise de l'IA, shadow AI, registre des usages, charte, plan 90 jours, responsabilité employeur, RGPD. Secondaires : obligations IA employeur, conformité IA, registre des usages IA.",
  },
  {
    keyword: "obligations IA employeur mise en conformité",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-conformite",
  },
  {
    keyword: "comment se mettre en conformité avec l'AI Act",
    intent: "voice_search",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-conformite",
  },
  {
    keyword: "quelles obligations pour une entreprise dont les salariés utilisent l'IA",
    intent: "ai_overview",
    module: M,
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-conformite",
  },
];

// ============================================================================
// GAMME IA STANDARD — 1 JOUR
// ============================================================================

// ── 4. IA Fondamentaux (/fr/formations/ia-fondamentaux) ────────────────────
const IA_FONDAMENTAUX: KeywordSeed[] = [
  {
    keyword: "formation IA 1 jour entreprise",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-fondamentaux",
    injection: {
      h1: "Rendre toute votre équipe autonome avec l'IA en une journée",
      metaTitle: "Formation IA 1 jour en entreprise — équipe autonome | Axion-IA",
      metaDescription:
        "Formation IA générative intra-entreprise (1 jour), sans prérequis : analyse de documents, livrable complet, boîte à outils personnelle. Dans vos locaux.",
      h2Variants: [
        "Devenir autonome avec l'IA : un livrable complet en séance",
        "Panorama des outils et boîte à outils personnelle",
      ],
    },
    note: "Sémantique : analyse de documents, livrable professionnel, panorama des outils, boîte à outils, autonomie. Secondaires : formation IA générative salariés, formation complète IA bureau, devenir autonome avec l'IA.",
  },
  {
    keyword: "formation IA générative salariés une journée",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-fondamentaux",
  },
  {
    keyword: "formation IA une journée pour passer de débutant à autonome",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-fondamentaux",
  },
  {
    keyword: "formation IA avec livrable concret en séance",
    intent: "benefice",
    module: M,
    cible: "pme",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-fondamentaux",
  },
];

// ── 5. IA & Commercial (/fr/formations/ia-commercial) ──────────────────────
const IA_COMMERCIAL: KeywordSeed[] = [
  {
    keyword: "formation IA commerciaux",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-commercial",
    injection: {
      h1: "Répondre plus vite et mieux que vos concurrents grâce à l'IA",
      metaTitle: "Formation IA pour commerciaux — devis & relances | Axion-IA",
      metaDescription:
        "Formation IA pour la force de vente (1 jour) : devis et propositions 3× plus vite, réclamations, relances personnalisées. Intra-entreprise.",
      h2Variants: [
        "Devis et propositions commerciales 3× plus vite",
        "Relances personnalisées et préparation de rendez-vous",
      ],
    },
    note: "Sémantique : pipeline, proposition commerciale, réclamation, relances personnalisées, gabarit de devis. Secondaires : IA pour la vente, formation IA devis propositions, IA relance client, formation IA force de vente.",
  },
  {
    keyword: "formation IA force de vente devis propositions",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-commercial",
  },
  {
    keyword: "faire ses devis avec l'intelligence artificielle",
    intent: "transactionnel",
    module: M,
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-commercial",
  },
  {
    keyword: "préparer un rendez-vous commercial avec l'IA",
    intent: "voice_search",
    module: M,
    cible: "pme",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-commercial",
  },
];

// ── 6. IA au bureau (/fr/formations/ia-au-bureau) ──────────────────────────
const IA_AU_BUREAU: KeywordSeed[] = [
  {
    keyword: "formation IA assistante administrative",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-au-bureau",
    injection: {
      h1: "Produire vos documents et courriers deux fois plus vite",
      metaTitle: "Formation IA assistante administrative & secrétariat | Axion-IA",
      metaDescription:
        "Formation IA pour l'administratif (1 jour) : gabarits de courriers, dépouillement de dossiers, réponses aux administrations, suivi sans ressaisie.",
      h2Variants: [
        "Gabarits de courriers récurrents et comptes rendus",
        "Réponses aux administrations et suivi sans ressaisie",
      ],
    },
    note: "Sémantique : gabarits de courriers, comptes rendus, dossiers, échéancier, suivi sans ressaisie, RH et paie (liste rouge). Secondaires : IA secrétariat, IA tâches administratives, formation IA gestion, IA courriers administratifs.",
  },
  {
    keyword: "formation IA tâches administratives secrétariat",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-au-bureau",
  },
  {
    keyword: "automatiser ses courriers récurrents avec l'IA",
    intent: "transactionnel",
    module: M,
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-au-bureau",
  },
  {
    keyword: "rédiger les réponses aux administrations avec l'IA",
    intent: "voice_search",
    module: M,
    cible: "pme",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-au-bureau",
  },
];

// ── 7. IA sur le terrain (/fr/formations/ia-sur-le-terrain) ────────────────
const IA_SUR_LE_TERRAIN: KeywordSeed[] = [
  {
    keyword: "formation IA smartphone terrain",
    intent: "transactionnel",
    module: M,
    cible: "tpe",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-sur-le-terrain",
    injection: {
      h1: "Boucler le circuit terrain → bureau depuis un simple smartphone",
      metaTitle: "Formation IA terrain sur smartphone, sans ordinateur | Axion-IA",
      metaDescription:
        "Formation IA pour les équipes terrain (1 jour, smartphone uniquement) : comptes rendus dictés, signalements photo, documents depuis le téléphone.",
      h2Variants: [
        "Comptes rendus d'intervention dictés à la voix",
        "Signalements et documents depuis une simple photo",
      ],
    },
    note: "Sémantique : dictée vocale, photo signalement, compte rendu d'intervention, mobilité, non scolaire. Secondaires : IA pour techniciens, dictée vocale compte rendu, IA artisans, IA chauffeurs ouvriers.",
  },
  {
    keyword: "formation IA pour techniciens dictée vocale",
    intent: "transactionnel",
    module: M,
    cible: "tpe",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-sur-le-terrain",
  },
  {
    keyword: "faire ses comptes rendus d'intervention à la voix",
    intent: "transactionnel",
    module: M,
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-sur-le-terrain",
  },
  {
    keyword: "formation IA sans ordinateur pour équipes terrain",
    intent: "transactionnel",
    module: M,
    cible: "tpe",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-sur-le-terrain",
  },
];

// ── 8. Automatisations IA Découverte (/fr/formations/automatisations-decouverte)
const AUTOMATISATIONS_DECOUVERTE: KeywordSeed[] = [
  {
    keyword: "formation automatisation IA entreprise découverte",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/automatisations-decouverte",
    injection: {
      h1: "Découvrir ce que l'automatisation IA peut faire pour votre entreprise",
      metaTitle: "Formation découverte automatisation IA en entreprise | Axion-IA",
      metaDescription:
        "Journée découverte de l'automatisation IA en intra-entreprise : repérer les tâches automatisables, chiffrer les gains, repartir avec un plan priorisé.",
      h2Variants: [
        "Identifier les tâches automatisables de votre PME",
        "Matrice gain / difficulté et plan d'automatisation chiffré",
      ],
    },
    note: "Sémantique : déclencheur traitement action, matrice gain difficulté, plan d'automatisation, ROI, tâches répétitives. Secondaires : identifier les tâches à automatiser, audit automatisation PME, atelier automatisation IA.",
  },
  {
    keyword: "atelier identifier les tâches à automatiser PME",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/automatisations-decouverte",
  },
  {
    keyword: "quelles tâches automatiser avec l'IA dans une PME",
    intent: "ai_overview",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/automatisations-decouverte",
  },
  {
    keyword: "journée découverte automatisation avec plan chiffré",
    intent: "benefice",
    module: M,
    cible: "pme",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/automatisations-decouverte",
  },
];

// ============================================================================
// GAMME IA STANDARD — 2 JOURS
// ============================================================================

// ── 9. IA Intégration métier (/fr/formations/ia-integration-metier) ────────
const IA_INTEGRATION_METIER: KeywordSeed[] = [
  {
    keyword: "formation IA métier 2 jours",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-integration-metier",
    injection: {
      h1: "Vos 5 tâches les plus chronophages transformées avant la fin",
      metaTitle: "Formation IA métier 2 jours — tâches transformées | Axion-IA",
      metaDescription:
        "Formation IA intégration métier (2 jours) : chaque participant transforme ses 5 tâches les plus chronophages en séance, kit d'équipe remis. Intra.",
      h2Variants: [
        "Transformer ses tâches chronophages avec des gabarits reproductibles",
        "Kit d'équipe : bibliothèque de prompts validés",
      ],
    },
    note: "Sémantique : tâches chronophages, gabarits reproductibles, kit d'équipe, bibliothèque de prompts, gains de temps mesurés. Secondaires : intégrer l'IA dans son poste, transformation des tâches par l'IA, formation IA cas d'usage métier.",
  },
  {
    keyword: "intégrer l'IA dans son poste cas d'usage métier",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-integration-metier",
  },
  {
    keyword: "transformer ses 5 tâches les plus chronophages avec l'IA",
    intent: "benefice",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-integration-metier",
  },
  {
    keyword: "formation IA avec kit d'équipe reproductible",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-integration-metier",
  },
];

// ── 10. IA & Commercial avancé (/fr/formations/ia-commercial-avance) ───────
const IA_COMMERCIAL_AVANCE: KeywordSeed[] = [
  {
    keyword: "formation IA cycle de vente complet",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-commercial-avance",
    injection: {
      h1: "Tout le cycle de vente passé à l'IA, de la prospection à la signature",
      metaTitle: "Formation IA commerciale avancée — appels d'offres | Axion-IA",
      metaDescription:
        "Formation IA commerciale avancée (2 jours) : prospection personnalisée, appels d'offres, propositions différenciantes, bibliothèque d'équipe. Intra.",
      h2Variants: [
        "Répondre à un appel d'offres avec l'IA",
        "Prospection personnalisée en série et relances multi-touches",
      ],
    },
    note: "Sémantique : mémoire technique, matrice de conformité, message-souche, bibliothèque commerciale, pipeline réel. Secondaires : IA appels d'offres, IA prospection personnalisée, formation IA commerciale avancée.",
  },
  {
    keyword: "formation IA appels d'offres réponse",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-commercial-avance",
  },
  {
    keyword: "prospection personnalisée en série avec l'IA",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-commercial-avance",
  },
  {
    keyword: "répondre à un appel d'offres avec l'IA séquences de relance",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-commercial-avance",
  },
];

// ============================================================================
// GAMME IA STANDARD — 3 JOURS
// ============================================================================

// ── 11. IA Transformation d'équipe (/fr/formations/ia-transformation-equipe)
const IA_TRANSFORMATION_EQUIPE: KeywordSeed[] = [
  {
    keyword: "formation transformation IA équipe entreprise",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-transformation-equipe",
    injection: {
      h1: "Rendre votre équipe autonome sur l'IA en 3 jours, sans prestataire",
      metaTitle: "Formation transformation IA d'équipe 3 jours | Axion-IA",
      metaDescription:
        "Formation transformation IA (3 jours) : 2 processus passés à l'IA, des référents internes formés, un tableau de bord des gains remis à la direction.",
      h2Variants: [
        "Former des référents IA internes",
        "Passer ses processus à l'IA en 3 jours avec tableau de bord des gains",
      ],
    },
    note: "Sémantique : processus de bout en bout, points de contrôle humain, tableau de bord des gains, gouvernance, restitution direction. Secondaires : référents IA internes, déploiement IA PME, processus IA entreprise.",
  },
  {
    keyword: "former des référents IA internes en entreprise",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-transformation-equipe",
  },
  {
    keyword: "passer ses processus à l'IA en 3 jours",
    intent: "benefice",
    module: M,
    cible: "eti",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-transformation-equipe",
  },
  {
    keyword: "déploiement IA PME autonomie équipe",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/ia-transformation-equipe",
  },
];

// ============================================================================
// GAMME AGENTS & AUTOMATISATIONS
// ============================================================================

// ── 12. Agents & Automatisations (/fr/formations/agents-automatisations) ───
const AGENTS_AUTOMATISATIONS: KeywordSeed[] = [
  {
    keyword: "formation créer ses automatisations IA sans coder",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/agents-automatisations",
    injection: {
      h1: "Faire écrire vos automatisations par l'IA — le code reste à l'entreprise",
      metaTitle: "Formation créer ses automatisations IA sans coder | Axion-IA",
      metaDescription:
        "Formation Agents & Automatisations (2 jours, groupe 2-12) : vos équipes créent leurs automatisations en code source qui appartient à l'entreprise, sans coder.",
      h2Variants: [
        "Créer une automatisation sans savoir programmer",
        "Un code source qui appartient à l'entreprise, sans abonnement",
      ],
    },
    note: "Sémantique : code source généré par l'IA, propriété du code, zéro abonnement, spécification en français, DSI, gestion d'erreurs. Secondaires : formation agents IA entreprise, automatisation code source.",
  },
  {
    keyword: "formation agents IA entreprise code source",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/agents-automatisations",
  },
  {
    keyword: "créer une automatisation sans savoir programmer",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/agents-automatisations",
  },
  {
    keyword: "automatisations qui appartiennent à l'entreprise sans abonnement",
    intent: "benefice",
    module: M,
    cible: "pme",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/agents-automatisations",
  },
];

// ── 13. Agents & Automatisations avancé (/fr/formations/agents-automatisations-avance)
const AGENTS_AUTOMATISATIONS_AVANCE: KeywordSeed[] = [
  {
    keyword: "formation automatisation IA déploiement production",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/agents-automatisations-avance",
    injection: {
      h1: "Construire ET déployer son automatisation complète, en fonctionnement le dernier jour",
      metaTitle: "Formation déploiement d'automatisations IA 3 jours | Axion-IA",
      metaDescription:
        "Formation Agents & Automatisations avancé (3 jours, groupe 2-12) : étendre, fiabiliser et déployer une automatisation qui tourne tous les jours, testée au chaos.",
      h2Variants: [
        "Déployer une automatisation IA qui tourne tous les jours",
        "Journal d'activité, alertes et test du chaos",
      ],
    },
    note: "Sémantique : exécution planifiée, test du chaos, check-list de mise en service, dépôt central, robustesse. Secondaires : fiabiliser une automatisation IA, automatisation en production PME, agents IA avancé.",
  },
  {
    keyword: "fiabiliser une automatisation IA en production",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/agents-automatisations-avance",
  },
  {
    keyword: "déployer une automatisation IA qui tourne tous les jours",
    intent: "benefice",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/agents-automatisations-avance",
  },
  {
    keyword: "autonomie création d'automatisations IA en interne",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/agents-automatisations-avance",
  },
];

// ============================================================================
// GAMME CLAUDE (formateur certifié écosystème Claude)
// ============================================================================

// ── 14. Claude Découverte (/fr/formations/claude-decouverte) ───────────────
const CLAUDE_DECOUVERTE: KeywordSeed[] = [
  {
    keyword: "formation Claude entreprise français",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-decouverte",
    injection: {
      h1: "Découvrir Claude et tout ce qu'il rend possible pour votre entreprise",
      metaTitle: "Formation Claude en entreprise — formateur certifié | Axion-IA",
      metaDescription:
        "Formation Claude (Anthropic) en intra-entreprise (1 jour), animée par un formateur certifié : analyse de documents, Projets, confidentialité.",
      h2Variants: [
        "Claude par un formateur certifié de l'écosystème",
        "Analyse de documents, Projets Claude, confidentialité",
      ],
    },
    note: "Sémantique : Anthropic, Projets Claude, analyse de documents, comparatif factuel, confidentialité, comptes gratuits, formateur certifié. Secondaires : formation Claude AI français, découvrir Claude Anthropic, formation Claude salariés.",
  },
  {
    keyword: "découvrir Claude Anthropic en entreprise",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-decouverte",
  },
  {
    keyword: "Claude ou ChatGPT pour mon entreprise",
    intent: "commercial_investigation",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-decouverte",
  },
  {
    keyword: "formateur certifié Claude pour entreprise en France",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-decouverte",
  },
];

// ── 15. Claude Créateur (/fr/formations/claude-createur) ───────────────────
const CLAUDE_CREATEUR: KeywordSeed[] = [
  {
    keyword: "formation Claude Projets instructions permanentes",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-createur",
    injection: {
      h1: "Chaque participant construit son propre outil IA — et repart avec",
      metaTitle: "Formation Claude Projets — assistant IA personnalisé | Axion-IA",
      metaDescription:
        "Formation Claude Créateur (2 jours, groupe 2-12, formateur certifié) : chaque salarié construit son assistant Claude personnalisé sur ses vrais dossiers.",
      h2Variants: [
        "Créer son assistant Claude personnalisé",
        "Instructions permanentes et base documentaire d'équipe",
      ],
    },
    note: "Sémantique : Projet Claude, instructions permanentes, base documentaire, gabarits, partage d'équipe, formateur certifié. Secondaires : créer son assistant Claude, formation Claude Pro Team entreprise, personnaliser Claude.",
  },
  {
    keyword: "créer son assistant Claude personnalisé entreprise",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-createur",
  },
  {
    keyword: "construire son outil IA personnalisé avec Claude",
    intent: "benefice",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-createur",
  },
  {
    keyword: "instructions permanentes Claude exemples métier",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-createur",
  },
];

// ── 16. Claude Architecte (/fr/formations/claude-architecte) ───────────────
const CLAUDE_ARCHITECTE: KeywordSeed[] = [
  {
    keyword: "formation Claude avancée complète entreprise",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-architecte",
    injection: {
      h1: "Son outil IA complet, opérationnel le dernier jour",
      metaTitle: "Formation Claude avancée — outil IA complet 3 jours | Axion-IA",
      metaDescription:
        "Formation Claude Architecte (3 jours, groupe 2-12, formateur certifié) : chaque participant connecte son outil Claude à ses flux réels et automatise.",
      h2Variants: [
        "Connecter Claude à ses flux de travail quotidiens",
        "Automatiser dans Claude : séquences multi-étapes",
      ],
    },
    note: "Sémantique : flux de travail, routine quotidienne, séquences multi-étapes, versionnage des instructions, test des 3 pièges. Secondaires : automatisations Claude, assistant IA complet entreprise, expert Claude entreprise.",
  },
  {
    keyword: "automatisations Claude assistant IA complet entreprise",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 2,
    niveau: 2,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-architecte",
  },
  {
    keyword: "connecter Claude à ses flux de travail quotidiens",
    intent: "benefice",
    module: M,
    cible: "eti",
    priorite: 2,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-architecte",
  },
  {
    keyword: "devenir autonome sur l'écosystème Claude formation",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 3,
    niveau: 3,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/claude-architecte",
  },
];

// ============================================================================
// PAGE PILIER SUR-MESURE (/fr/formations/sur-mesure)
// ============================================================================

const SUR_MESURE: KeywordSeed[] = [
  {
    keyword: "formation IA sur mesure entreprise",
    intent: "transactionnel",
    module: M,
    cible: "grand-compte",
    priorite: 2,
    niveau: 1,
    formationFormat: "transverse",
    urlCible: "/fr/formations/sur-mesure",
    injection: {
      h1: "Votre formation IA construite de A à Z, sur vos métiers",
      metaTitle: "Formation IA sur mesure en entreprise — multi-sites | Axion-IA",
      metaDescription:
        "Formation IA personnalisée et co-construite : contenu, durée, format et équipes définis avec vous. De la TPE au grand compte, multi-sites, secteurs réglementés.",
      h2Variants: [
        "Un programme IA co-construit avec vos équipes",
        "Multi-sites, grands comptes, secteurs réglementés et données sensibles",
      ],
    },
    note: "Page pilier (7 entrées sur-mesure du catalogue → ancres). Sémantique : cadrage, devis, multi-sites, confidentialité renforcée, combinaison de gammes. Secondaires : formation IA personnalisée, programme IA co-construit, formation IA grands comptes multi-sites.",
  },
  {
    keyword: "formation IA personnalisée co-construite entreprise",
    intent: "transactionnel",
    module: M,
    cible: "eti",
    priorite: 2,
    niveau: 2,
    formationFormat: "transverse",
    urlCible: "/fr/formations/sur-mesure",
  },
  {
    keyword: "formation intelligence artificielle construite sur nos métiers",
    intent: "transactionnel",
    module: M,
    cible: "grand-compte",
    priorite: 2,
    niveau: 3,
    formationFormat: "transverse",
    urlCible: "/fr/formations/sur-mesure",
  },
  {
    keyword: "formation IA secteur réglementé données sensibles",
    intent: "transactionnel",
    module: M,
    cible: "grand-compte",
    priorite: 3,
    niveau: 3,
    formationFormat: "transverse",
    urlCible: "/fr/formations/sur-mesure",
  },
];

// ============================================================================
// EXPORT
// ============================================================================

export const KEYWORDS_FORMATIONS_V2: KeywordSeed[] = [
  ...IA_EXPRESS,
  ...ART_DU_PROMPT,
  ...IA_SECURITE,
  ...IA_CONFORMITE,
  ...IA_FONDAMENTAUX,
  ...IA_COMMERCIAL,
  ...IA_AU_BUREAU,
  ...IA_SUR_LE_TERRAIN,
  ...AUTOMATISATIONS_DECOUVERTE,
  ...IA_INTEGRATION_METIER,
  ...IA_COMMERCIAL_AVANCE,
  ...IA_TRANSFORMATION_EQUIPE,
  ...AGENTS_AUTOMATISATIONS,
  ...AGENTS_AUTOMATISATIONS_AVANCE,
  ...CLAUDE_DECOUVERTE,
  ...CLAUDE_CREATEUR,
  ...CLAUDE_ARCHITECTE,
  ...SUR_MESURE,
];
