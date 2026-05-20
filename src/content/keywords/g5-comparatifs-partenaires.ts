/**
 * Keyword Seeds — G5 : Comparatifs & Partenaires
 *
 * Source : MODE G PHASE 5 du prompt `_AUDIT/PROMPT-KEYWORD-STRATEGY-MASTER-V1.md` v1.2
 * Généré le : 2026-05-20
 *
 * Deux exports :
 *   - KW_COMPARATIFS_G5  (~30 seeds) — intent "comparatif", module "transversal"
 *   - KW_PARTENAIRES_G5  (~30 seeds) — intent "partenaire", module "transversal"
 *
 * URL patterns :
 *   - Comparatifs : /fr/comparaisons/[slug]
 *   - Partenaires commerciaux : /fr/partenaires/
 *   - Prescripteurs : /fr/partenaires/prescripteurs
 *   - Sous-traitants dev : /fr/missions-freelance/ (index discret — hors nav principale)
 *
 * Règle R5 anti-cannibalisation respectée : H1 = bénéfice différenciateur, jamais le keyword brut.
 * Règle niveau 1 + priorite 1 interdite : les HEAD (niveau 1) sont en priorite 2 (mois 3-6).
 */

import type { KeywordSeed } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE D — SEEDS COMPARATIFS
// Catégories :
//   D1 — Cabinet IA vs alternatives (7 seeds)
//   D2 — Outils IA comparatifs PME (6 seeds)
//   D3 — Formats de service Axion-IA (5 seeds)
//   D4 — Comparatifs concurrents directs (4 seeds)
//   D5 — Comparatifs intent fort longue traîne (8 seeds supplémentaires)
// ─────────────────────────────────────────────────────────────────────────────

export const KW_COMPARATIFS_G5: KeywordSeed[] = [
  // ── D1 — Cabinet IA vs alternatives ─────────────────────────────────────

  {
    keyword: "cabinet IA vs freelance IA France",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Cabinet IA ou freelance IA : ce qui change vraiment pour une PME",
      metaTitle: "Cabinet IA vs freelance IA France — Comparatif 2026",
      metaDescription:
        "Suivi, responsabilité, montée en charge : découvrez pourquoi les PME choisissent un cabinet IA plutôt qu'un consultant indépendant.",
      h2Variants: [
        "Continuité de mission : cabinet vs indépendant",
        "Responsabilité contractuelle et assurance RC Pro",
        "Ce que le freelance ne peut pas garantir",
      ],
    },
    urlCible: "/fr/comparaisons/cabinet-ia-vs-freelance-ia",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Schema.org : FAQPage + Article ; keyword secondaire : consultant IA indépendant France",
  },

  {
    keyword: "agence IA vs consultant indépendant",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "eti",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Agence IA ou consultant indépendant : quel partenaire pour transformer votre ETI ?",
      metaTitle: "Agence IA vs consultant indépendant — Guide décision ETI",
      metaDescription:
        "Structure, garanties, scalabilité : comparez objectivement agences IA et consultants indépendants avant de signer.",
      h2Variants: [
        "Scalabilité : l'agence s'adapte, l'indépendant sature",
        "Garanties contractuelles et continuité de service",
        "Grille de décision selon votre budget et vos enjeux",
      ],
    },
    urlCible: "/fr/comparaisons/agence-ia-vs-consultant-independant",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Audience ETI + DG ; différenciateur : suivi post-mission structuré",
  },

  {
    keyword: "cabinet IA vs formation en ligne",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Cabinet IA ou formation en ligne : ce que les MOOC ne peuvent pas faire pour vous",
      metaTitle: "Cabinet IA vs formation IA en ligne — Comparatif honnête",
      metaDescription:
        "Les formations en ligne ne transforment pas vos processus. Découvrez pourquoi accompagner vs former change tout.",
      h2Variants: [
        "Ce que la formation en ligne ne couvre pas : le contexte métier",
        "ROI comparé : MOOC vs mission terrain",
        "Quand la formation suffit, quand le cabinet est indispensable",
      ],
    },
    urlCible: "/fr/comparaisons/cabinet-ia-vs-formation-en-ligne",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Segment dirigeants PME qui envisagent Coursera/OpenClassrooms ; ancrer sur bénéfice mesurable",
  },

  {
    keyword: "cabinet IA vs recrutement développeur IA",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Recruter un développeur IA ou faire appel à un cabinet : le vrai calcul pour une PME",
      metaTitle: "Cabinet IA vs recruter développeur IA — Coût & délai réels",
      metaDescription:
        "Salaire chargé, time-to-market, risque de recrutement raté : comparez les deux options en chiffres avant de décider.",
      h2Variants: [
        "Le coût réel d'un développeur IA senior en CDI",
        "Time-to-market : 6 mois de recrutement vs mission en 3 semaines",
        "Quand recruter devient pertinent (après la preuve de concept)",
      ],
    },
    variables: {
      chiffre: "6",
      unite: "mois de recrutement en moyenne",
      delai: "vs 3 semaines pour une mission cabinet",
    },
    urlCible: "/fr/comparaisons/cabinet-ia-vs-recrutement-developpeur-ia",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Chiffre clé : délai recrutement tech France 5-8 mois (Apec 2025). Schema.org : Article + FAQPage",
  },

  {
    keyword: "externaliser IA ou recruter développeur IA",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "eti",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Externaliser l'IA ou recruter en interne : la décision structurante pour votre ETI",
      metaTitle: "Externaliser IA vs recruter développeur — Décision ETI 2026",
      metaDescription:
        "Build vs buy appliqué à l'IA : grille de décision pour ETI qui veulent aller vite sans risquer leur masse salariale.",
      h2Variants: [
        "Les 4 critères qui font basculer vers l'externalisation",
        "Le moment où recruter devient rentable",
        "Modèle hybride : cabinet pilote, recrutement ensuite",
      ],
    },
    urlCible: "/fr/comparaisons/externaliser-ia-ou-recruter-developpeur",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Variation sémantique de cabinet-vs-recrutement ; urlCible distincte pour éviter cannibalisation",
  },

  {
    keyword: "cabinet IA vs logiciel IA clé en main",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "tpe",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Logiciel IA standard ou accompagnement sur-mesure : ce que les éditeurs ne disent pas",
      metaTitle: "Cabinet IA vs logiciel IA clé en main — Comparatif PME/TPE",
      metaDescription:
        "Les outils no-code IA sont puissants mais génériques. Découvrez ce que l'accompagnement sur-mesure apporte en plus.",
      h2Variants: [
        "Pourquoi les logiciels IA génériques ne s'adaptent pas à vos processus",
        "Le coût caché de la personnalisation DIY",
        "Quand l'outil suffit, quand il faut un expert",
      ],
    },
    urlCible: "/fr/comparaisons/cabinet-ia-vs-logiciel-ia-cle-en-main",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "TPE/petite PME hésitant entre Zapier AI, Monday AI, HubSpot AI et prestataire",
  },

  {
    keyword: "prestataire IA vs former en interne",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Prestataire IA ou montée en compétences interne : que choisir selon votre maturité ?",
      metaTitle: "Prestataire IA vs formation interne — Quelle stratégie IA ?",
      metaDescription:
        "Former vos équipes ou sous-traiter ? Comparez les deux stratégies IA selon votre niveau de maturité et vos délais.",
      h2Variants: [
        "Maturité IA : évaluez votre point de départ",
        "Formation interne : investissement, délai, risque d'abandon",
        "Le modèle hybride recommandé par les cabinets IA performants",
      ],
    },
    urlCible: "/fr/comparaisons/prestataire-ia-vs-formation-interne",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
  },

  // ── D2 — Outils IA comparatifs PME ──────────────────────────────────────

  {
    keyword: "Claude Anthropic vs ChatGPT pour entreprise",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 1,
    injection: {
      h1: "Claude vs ChatGPT en entreprise : quel LLM choisir selon vos usages métier ?",
      metaTitle: "Claude Anthropic vs ChatGPT entreprise — Comparatif 2026",
      metaDescription:
        "Sécurité des données, raisonnement long, intégration API : notre comparatif objectif Claude vs ChatGPT pour PME et ETI.",
      h2Variants: [
        "Sécurité et conformité RGPD : Claude vs ChatGPT",
        "Raisonnement complexe et fenêtre de contexte : qui gagne ?",
        "Intégration API et coût réel selon votre volume d'usage",
      ],
    },
    urlCible: "/fr/comparaisons/claude-vs-chatgpt-entreprise",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "HEAD niveau 1 → priorite 2 (règle interdiction niveau 1 + priorite 1). Schema.org : Article + FAQPage. Keyword secondaire : Anthropic vs OpenAI B2B",
  },

  {
    keyword: "ChatGPT vs Copilot Microsoft pour PME",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "ChatGPT ou Microsoft Copilot pour votre PME : le comparatif qui évite les pièges",
      metaTitle: "ChatGPT vs Copilot Microsoft PME | Axion-IA",
      metaDescription:
        "Intégration Office 365, coût par siège, cas d'usage réels : comparez ChatGPT Enterprise et Microsoft Copilot 365 pour PME.",
      h2Variants: [
        "Intégration dans votre écosystème Microsoft existant",
        "Coût total : licences, formation, maintenance",
        "Les cas d'usage où chacun excelle vraiment",
      ],
    },
    urlCible: "/fr/comparaisons/chatgpt-vs-copilot-microsoft-pme",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Fort volume PME sous Office 365 ; capter l'intent décisionnel early-stage",
  },

  {
    keyword: "Make vs n8n automatisation PME",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Make ou n8n pour automatiser vos processus : comparatif concret pour PME",
      metaTitle: "Make vs n8n automatisation PME — Comparatif 2026",
      metaDescription:
        "No-code, self-hosted, connecteurs IA : faites le bon choix entre Make.com et n8n selon votre budget et vos ressources techniques.",
      h2Variants: [
        "Make.com : puissance no-code, dépendance cloud",
        "n8n : liberté self-hosted, courbe d'apprentissage",
        "Grille de choix selon votre maturité technique et votre budget",
      ],
    },
    urlCible: "/fr/comparaisons/make-vs-n8n-automatisation-pme",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Keyword fort sur la stack Axion-IA (Make + n8n dans /stack-ia). Différenciateur : expertise terrain clients",
  },

  {
    keyword: "Zapier vs n8n avis PME",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "tpe",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Zapier ou n8n : retour d'expérience honnête pour TPE/PME en France",
      metaTitle: "Zapier vs n8n PME France — Avis & comparatif terrain 2026",
      metaDescription:
        "Coût, connecteurs, limites d'exécution : notre retour d'expérience terrain sur Zapier vs n8n après 50+ automatisations clients.",
      h2Variants: [
        "Tarification réelle : Zapier devient cher vite",
        "n8n self-hosted : liberté totale, maintenance à prévoir",
        "Notre recommandation selon votre profil PME",
      ],
    },
    variables: {
      chiffre: "50",
      unite: "automatisations clients",
    },
    urlCible: "/fr/comparaisons/zapier-vs-n8n-pme",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Variation sémantique Make vs n8n ; urlCible distincte. Forte intention informelle (avis, retour exp)",
  },

  {
    keyword: "IA générative vs automatisation RPA",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "eti",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "IA générative ou RPA : deux approches d'automatisation, deux niveaux de maturité",
      metaTitle: "IA générative vs RPA automatisation — Comparatif ETI/PME",
      metaDescription:
        "UiPath, Blue Prism ou LLM API ? Comprendre la différence entre RPA et IA générative pour choisir la bonne brique technologique.",
      h2Variants: [
        "RPA : automatisation déterministe de processus structurés",
        "IA générative : traitement du langage et des cas non-structurés",
        "Les deux sont complémentaires : quand les combiner ?",
      ],
    },
    urlCible: "/fr/comparaisons/ia-generative-vs-rpa",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Audience DSI/DRH ETI ; différenciateur Axion-IA = expertise combinée RPA + LLM",
  },

  {
    keyword: "LLM open source vs API propriétaire PME",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "pme",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "LLM open source ou API propriétaire : le vrai arbitrage pour une PME en 2026",
      metaTitle: "LLM open source vs API propriétaire PME — Comparatif 2026",
      metaDescription:
        "Llama, Mistral ou Claude API : comparez coût, latence, sécurité et maintenance entre modèles open source et APIs propriétaires.",
      h2Variants: [
        "Coût réel d'un LLM self-hosted vs API à l'usage",
        "Souveraineté des données : enjeux RGPD selon le modèle",
        "Notre recommandation selon votre volume et vos ressources DevOps",
      ],
    },
    urlCible: "/fr/comparaisons/llm-open-source-vs-api-proprietaire",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Longue traîne technique ; audience CTO/DSI PME tech-savvy",
  },

  // ── D3 — Formats de service Axion-IA ────────────────────────────────────

  {
    keyword: "audit IA vs POC IA quelle différence",
    intent: "comparatif",
    kbType: "comparison",
    module: "audit",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Audit IA ou POC IA : par lequel commencer selon votre maturité ?",
      metaTitle: "Audit IA vs POC IA — différences & guide | Axion-IA",
      metaDescription:
        "L'audit cartographie vos opportunités IA. Le POC valide une solution. Découvrez lequel lancer en premier selon votre contexte.",
      h2Variants: [
        "L'audit IA : cartographie stratégique en 3 jours",
        "Le POC IA : validation technique sur un cas d'usage ciblé",
        "Séquence recommandée : audit d'abord, POC ensuite",
      ],
    },
    urlCible: "/fr/comparaisons/audit-ia-vs-poc-ia",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Sert aussi la page /audit en FAQ ; JSON-LD FAQPage recommandé",
  },

  {
    keyword: "formation présentiel vs distanciel IA",
    intent: "comparatif",
    kbType: "comparison",
    module: "interventions-formations",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Formation IA en présentiel ou à distance : ce que les chiffres d'engagement disent",
      metaTitle: "Formation IA présentiel vs distanciel — Comparatif résultats",
      metaDescription:
        "Rétention, engagement, application terrain : notre comparatif sur 200+ apprenants entre formations IA en salle et en ligne.",
      h2Variants: [
        "Taux de rétention : présentiel +40 % selon nos données",
        "Distanciel : flexibilité mais risque de décrochage",
        "Format hybride : le meilleur des deux mondes pour vos équipes",
      ],
    },
    variables: {
      chiffre: "200",
      unite: "apprenants",
    },
    urlCible: "/fr/comparaisons/formation-ia-presentiel-vs-distanciel",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Page de service /interventions/intra-entreprise peut recevoir un CTA vers ce comparatif",
  },

  {
    keyword: "mission ponctuelle vs maintenance IA mensuelle",
    intent: "comparatif",
    kbType: "comparison",
    module: "maintenance-ia",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Mission IA ponctuelle ou contrat de maintenance mensuel : ce que chaque modèle garantit",
      metaTitle: "Mission IA ponctuelle vs maintenance mensuelle — Comparatif",
      metaDescription:
        "Intervention one-shot ou suivi continu ? Comparez les deux modèles d'engagement IA pour PME selon vos objectifs 6-12 mois.",
      h2Variants: [
        "La mission ponctuelle : quand elle est suffisante",
        "La maintenance mensuelle : ce qu'elle couvre au-delà du projet",
        "Notre recommandation selon la criticité de votre usage IA",
      ],
    },
    urlCible: "/fr/comparaisons/mission-ponctuelle-vs-maintenance-ia",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Différenciateur Axion-IA : module maintenance-ia ; lien vers /maintenance-ia dans le CTA",
  },

  {
    keyword: "intervention 1 jour vs 2 jours formation IA",
    intent: "comparatif",
    kbType: "comparison",
    module: "interventions-formations",
    cible: "pme",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Formation IA 1 jour ou 2 jours : ce qui change vraiment dans les résultats",
      metaTitle: "Formation IA 1 jour vs 2 jours | Axion-IA",
      metaDescription:
        "Immersion, pratique, suivi post-formation : comparez les formats 1 et 2 jours pour choisir selon vos objectifs et contraintes agenda.",
      h2Variants: [
        "1 jour : sensibilisation et cas d'usage immédiats",
        "2 jours : pratique approfondie et plan d'action personnalisé",
        "Critères de choix selon la taille et le niveau de votre équipe",
      ],
    },
    urlCible: "/fr/comparaisons/formation-ia-1-jour-vs-2-jours",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
  },

  // ── D4 — Comparatifs concurrents directs ────────────────────────────────

  {
    keyword: "Axion-IA vs Mister-IA comparatif",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Axion-IA vs Mister-IA : deux approches du conseil IA, deux positionnements",
      metaTitle: "Axion-IA vs Mister-IA — Comparatif honnête 2026",
      metaDescription:
        "Positionnement, tarifs, formats, résultats : comparez Axion-IA et Mister-IA avant de choisir votre partenaire IA.",
      h2Variants: [
        "Volume vs sur-mesure : deux philosophies d'intervention",
        "Ce que Mister-IA fait bien, ce qu'Axion-IA fait différemment",
        "Pour quel profil d'entreprise chacun est le meilleur choix",
      ],
    },
    urlCible: "/fr/comparaisons/axion-ia-vs-mister-ia",
    canonicalParent: "/fr/comparaisons",
    source: "concurrent",
    note: "Page comparatif concurrentielle directe ; ton factuel, jamais dénigrant. Schema.org : Article",
  },

  {
    keyword: "cabinet IA vs organisme de formation IA",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Cabinet IA ou organisme de formation certifié : ce que Qualiopi ne garantit pas",
      metaTitle: "Cabinet IA vs organisme formation IA — Comparatif 2026",
      metaDescription:
        "Certification Qualiopi, financement OPCO et résultats terrain : ce que les organismes de formation ne peuvent pas promettre.",
      h2Variants: [
        "Qualiopi : le label qui rassure, pas celui qui garantit les résultats",
        "Ce que le financement OPCO implique (et ce qu'il ne couvre pas)",
        "Cabinet de conseil IA : responsabilité sur les résultats, pas seulement le contenu",
      ],
    },
    urlCible: "/fr/comparaisons/cabinet-ia-vs-organisme-formation",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Angle différenciateur fort vs concurrents Qualiopi (Mister-IA, Eleven Labs) ; ne pas attaquer la certification, valoriser le suivi résultats",
  },

  {
    keyword: "meilleur cabinet IA France 2026 comparatif",
    intent: "comparatif",
    kbType: "comparison",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 1,
    injection: {
      h1: "Meilleurs cabinets IA France 2026 : notre comparatif complet et objectif",
      metaTitle: "Meilleur cabinet IA France 2026 — Comparatif & classement",
      metaDescription:
        "Mister-IA, Eleven Labs, Drakkar, Axion-IA, Palmer : comparatif des principaux cabinets IA France selon 8 critères objectifs.",
      h2Variants: [
        "Notre grille de comparaison : 8 critères clés",
        "Tableau comparatif des 5 acteurs principaux",
        "Comment choisir selon votre profil et votre budget",
      ],
    },
    urlCible: "/fr/comparaisons/meilleur-cabinet-ia-france-2026",
    canonicalParent: "/fr/comparaisons",
    source: "autocomplete",
    note: "HEAD niveau 1 → priorite 2 obligatoire. Page méta-annuaire favorable AEO (Perplexity, ChatGPT search) ; mettre à jour chaque début d'année",
  },

  // ── D5 — Comparatifs intent fort — longue traîne supplémentaire ──────────

  {
    keyword: "intégration IA dans ERP vs solution IA standalone",
    intent: "comparatif",
    kbType: "comparison",
    module: "implementation",
    cible: "eti",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "IA intégrée dans votre ERP ou solution standalone : l'arbitrage pour une ETI",
      metaTitle: "IA dans ERP vs solution standalone — Comparatif ETI 2026",
      metaDescription:
        "SAP AI, Oracle AI ou solution IA sur-mesure : comparez les coûts d'intégration et la valeur réelle selon votre infrastructure.",
      h2Variants: [
        "IA native ERP : simplicité de déploiement, rigidité fonctionnelle",
        "Solution IA standalone : flexibilité maximale, effort d'intégration",
        "Grille de décision selon votre stack existante",
      ],
    },
    urlCible: "/fr/comparaisons/ia-integree-erp-vs-solution-standalone",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Segment ETI / DSI ; fort différenciateur Axion-IA sur la dimension intégration",
  },

  {
    keyword: "accompagnement IA individualisé vs formation collective",
    intent: "comparatif",
    kbType: "comparison",
    module: "coaching-1-to-1",
    cible: "pme",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Coaching IA individuel ou formation collective : quel format accélère vraiment ?",
      metaTitle: "Accompagnement IA individuel vs collectif | Axion-IA",
      metaDescription:
        "Progression personnalisée vs économie d'échelle : comparez les deux formats pour choisir ce qui correspond à vos enjeux RH.",
      h2Variants: [
        "Formation collective : idéale pour sensibiliser, limitée pour transformer",
        "Coaching individuel : résultats rapides, investissement plus ciblé",
        "Le bon mix selon la taille de vos équipes",
      ],
    },
    urlCible: "/fr/comparaisons/accompagnement-ia-individuel-vs-collectif",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Sert le module coaching-1-to-1 différenciateur vs concurrents formation pure",
  },

  {
    keyword: "coût implémentation IA maison vs cabinet spécialisé",
    intent: "comparatif",
    kbType: "comparison",
    module: "implementation",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Implémenter l'IA en interne ou avec un cabinet : le comparatif de coût réel",
      metaTitle: "Coût IA interne vs cabinet — chiffres réels | Axion-IA",
      metaDescription:
        "Développement interne, temps perdu, erreurs d'architecture : découvrez pourquoi l'accompagnement cabinet est souvent moins cher.",
      h2Variants: [
        "Coûts cachés du DIY : architecture, bugs, formation continue",
        "Ce que le cabinet apporte en plus du code : méthodologie et suivi",
        "Calculez votre ROI sur 12 mois des deux scénarios",
      ],
    },
    urlCible: "/fr/comparaisons/implementation-ia-interne-vs-cabinet",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Lien vers /roi calculateur dans le CTA ; chiffres défendables à valider sur cas clients réels",
  },

  {
    keyword: "chatbot IA vs assistant IA différence pour PME",
    intent: "comparatif",
    kbType: "comparison",
    module: "implementation",
    cible: "pme",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Chatbot ou assistant IA : la différence concrète pour une PME en 2026",
      metaTitle: "Chatbot IA vs assistant IA PME — Quelle différence en 2026 ?",
      metaDescription:
        "Scénarios FAQ automatisés ou agent IA capable de raisonner sur vos données : comparez les deux approches selon vos cas d'usage.",
      h2Variants: [
        "Chatbot : règles, flux, limitations bien définies",
        "Agent IA : raisonnement, mémoire, accès à vos outils",
        "Quel niveau de sophistication selon votre budget ?",
      ],
    },
    urlCible: "/fr/comparaisons/chatbot-ia-vs-assistant-ia-pme",
    canonicalParent: "/fr/comparaisons",
    source: "autocomplete",
    note: "Forte intention informelle ; cible aussi AEO (réponse directe Perplexity / ChatGPT)",
  },

  {
    keyword: "formation IA CPF éligible vs non éligible comparatif",
    intent: "comparatif",
    kbType: "comparison",
    module: "interventions-formations",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Formation IA CPF éligible ou non : ce que le financement change vraiment",
      metaTitle: "Formation IA CPF éligible vs non éligible | Axion-IA",
      metaDescription:
        "CPF, OPCO, plan de formation : comprendre les modalités de financement IA et pourquoi l'éligibilité n'est pas le seul critère.",
      h2Variants: [
        "Ce que le CPF finance et ses limites sur les formations IA avancées",
        "OPCO et plan de développement des compétences : l'alternative B2B",
        "Qualité de formation vs éligibilité CPF : notre position claire",
      ],
    },
    urlCible: "/fr/comparaisons/formation-ia-cpf-vs-non-cpf",
    canonicalParent: "/fr/comparaisons",
    source: "autocomplete",
    note: "Axion-IA non Qualiopi → page doit être honnête, différencier sur qualité plutôt qu'éligibilité",
  },

  {
    keyword: "IA on-premise vs cloud quelle solution pour entreprise",
    intent: "comparatif",
    kbType: "comparison",
    module: "implementation",
    cible: "eti",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "IA on-premise ou cloud : l'arbitrage stratégique pour les ETI sensibles aux données",
      metaTitle: "IA on-premise vs cloud entreprise | Axion-IA",
      metaDescription:
        "Souveraineté des données, latence, coûts d'infrastructure : notre comparatif on-premise vs cloud IA pour ETI sous contrainte RGPD.",
      h2Variants: [
        "On-premise : souveraineté maximale, CAPEX élevé",
        "Cloud IA : flexibilité et rapidité, questions RGPD à anticiper",
        "Modèle hybride : la voie recommandée pour les ETI françaises",
      ],
    },
    urlCible: "/fr/comparaisons/ia-on-premise-vs-cloud",
    canonicalParent: "/fr/comparaisons",
    source: "manuel",
    note: "Angle RGPD / souveraineté données fort en France 2026 ; segment ETI santé/finance/industrie",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE E — SEEDS PARTENAIRES
// Sous-catégories :
//   E1 — Sous-traitants développeurs (~7 seeds) — URL /fr/missions-freelance/ (index discret)
//   E2 — Partenaires commerciaux (~5 seeds)     — URL /fr/partenaires/
//   E3 — Prescripteurs (~8 seeds)               — URL /fr/partenaires/prescripteurs
//   E4 — Partenaires tech (~5 seeds)            — URL /fr/partenaires/
//   E5 — Apporteurs d'affaires (~5 seeds)       — URL /fr/partenaires/
// ─────────────────────────────────────────────────────────────────────────────

export const KW_PARTENAIRES_G5: KeywordSeed[] = [
  // ── E1 — Sous-traitants développeurs (INDEX DISCRET — hors nav) ──────────

  {
    keyword: "mission développeur IA freelance France",
    intent: "partenaire",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "sous-traitant-dev",
    priorite: 3,
    niveau: 2,
    injection: {
      h1: "Missions développeur IA en France : rejoignez le réseau Axion-IA",
      metaTitle: "Mission développeur IA France — Sous-traitance Axion-IA",
      metaDescription:
        "Missions régulières LLM, agents IA, automatisation : rejoignez Axion-IA en tant que développeur sous-traitant senior.",
      h2Variants: [
        "Profils recherchés : Claude API, LangChain, n8n, RAG",
        "Nos missions types et leur durée moyenne",
        "Processus de candidature et critères de sélection",
      ],
    },
    urlCible: "/fr/missions-freelance",
    source: "manuel",
    note: "Page INDEX DISCRET : robots index:true mais hors header ET footer. Accessible via liens LinkedIn/GitHub uniquement. Ne pas ajouter en sitemap priority haute.",
  },

  {
    keyword: "sous-traitance développement agent IA",
    intent: "partenaire",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "sous-traitant-dev",
    priorite: 3,
    niveau: 2,
    injection: {
      h1: "Développement d'agents IA en sous-traitance : missions avec Axion-IA",
      metaTitle: "Sous-traitance agent IA — Missions développeurs Axion-IA",
      metaDescription:
        "Sous-traitance développement agents IA autonomes : missions LangGraph, CrewAI, Claude API pour développeurs expérimentés.",
      h2Variants: [
        "Types de missions : agents autonomes, RAG, pipelines IA",
        "Stack technique : Claude API, LangChain, n8n, Make",
        "Rémunération et conditions de collaboration",
      ],
    },
    urlCible: "/fr/missions-freelance",
    source: "manuel",
    note: "Variation sémantique sur /missions-freelance ; même URL cible. Pas de canonicalParent (page hors navigation).",
  },

  {
    keyword: "rejoindre cabinet IA développeur Claude API",
    intent: "partenaire",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "sous-traitant-dev",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Développeur Claude API : collaborez avec Axion-IA sur des missions clients réels",
      metaTitle: "Rejoindre Axion-IA — Développeur Claude API",
      metaDescription:
        "Vous maîtrisez l'API Claude d'Anthropic ? Axion-IA recherche des développeurs IA pour des missions sous-traitance régulières.",
      h2Variants: [
        "Pourquoi Axion-IA recrute des experts Claude API",
        "Nos projets types : de l'audit technique au déploiement LLM",
        "Comment postuler et ce qu'on attend de vous",
      ],
    },
    urlCible: "/fr/missions-freelance",
    source: "manuel",
    note: "Intent très qualifié (mention explicite Claude API) ; haute conversion potentielle",
  },

  {
    keyword: "mission LangChain n8n Make entreprises France",
    intent: "partenaire",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "sous-traitant-dev",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Missions LangChain, n8n et Make pour entreprises françaises : rejoignez notre réseau",
      metaTitle: "Mission LangChain n8n Make France — Sous-traitance Axion-IA",
      metaDescription:
        "Spécialiste LangChain, n8n ou Make ? Axion-IA mandate régulièrement des développeurs IA pour ses clients PME et ETI.",
      h2Variants: [
        "Stack Make.com : automatisations no-code à fort impact",
        "Stack n8n + LangChain : orchestration avancée agents IA",
        "Profil idéal et conditions de collaboration",
      ],
    },
    urlCible: "/fr/missions-freelance",
    source: "manuel",
  },

  {
    keyword: "développeur IA sous-traitance missions régulières",
    intent: "partenaire",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "sous-traitant-dev",
    priorite: 3,
    niveau: 2,
    injection: {
      h1: "Sous-traitance développement IA : des missions récurrentes avec un cabinet en croissance",
      metaTitle: "Développeur IA sous-traitance missions régulières — Axion-IA",
      metaDescription:
        "Pas de one-shot : Axion-IA propose des collaborations régulières à des développeurs IA séniors pour accompagner sa croissance.",
      h2Variants: [
        "Volume de missions actuel et prévisions 12 mois",
        "Fonctionnement de la collaboration : brief, délai, livrable",
        "Rejoindre le réseau : processus de candidature",
      ],
    },
    urlCible: "/fr/missions-freelance",
    source: "manuel",
    note: "Argument différenciateur : régularité des missions (pas de one-shot)",
  },

  {
    keyword: "prestataire technique implémentation LLM PME",
    intent: "partenaire",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "sous-traitant-dev",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Prestataire technique LLM pour PME : sous-traitez avec Axion-IA",
      metaTitle: "Sous-traitance implémentation LLM PME — Axion-IA",
      metaDescription:
        "Intégration LLM dans les SI PME : nous cherchons des prestataires techniques spécialisés pour des missions clients encadrées.",
      h2Variants: [
        "Ce que nous sous-traitons : intégrations API, pipelines RAG, front IA",
        "Ce que nous gérons en interne : relation client, cadrage, architecture",
        "Conditions et niveaux de rémunération",
      ],
    },
    urlCible: "/fr/missions-freelance",
    source: "manuel",
  },

  {
    keyword: "mission développement RAG entreprise France",
    intent: "partenaire",
    kbType: "implementation_playbook",
    module: "codage-developpement",
    cible: "sous-traitant-dev",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Missions RAG (Retrieval-Augmented Generation) pour entreprises françaises",
      metaTitle: "Mission RAG entreprise France — Sous-traitance Axion-IA",
      metaDescription:
        "Spécialiste RAG, vectorisation, embeddings ? Axion-IA recherche des développeurs pour des projets RAG client en France.",
      h2Variants: [
        "Nos projets RAG types : base de connaissance, support client IA",
        "Stack recommandée : LangChain, pgvector, Qdrant, Claude",
        "Candidater et démarrer une collaboration",
      ],
    },
    urlCible: "/fr/missions-freelance",
    source: "manuel",
    note: "Intent très technique, volume faible mais profil très qualifié ; forte valeur conversion",
  },

  // ── E2 — Partenaires commerciaux ─────────────────────────────────────────

  {
    keyword: "devenir partenaire revendeur cabinet IA France",
    intent: "partenaire",
    kbType: "guide",
    module: "transversal",
    cible: "partenaire-commercial",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Devenir partenaire revendeur d'Axion-IA : rejoignez notre réseau commercial",
      metaTitle: "Devenir partenaire cabinet IA France — Programme Axion-IA",
      metaDescription:
        "Revendez ou recommandez les services Axion-IA à vos clients entreprises : programme partenaires avec commission attractive.",
      h2Variants: [
        "Ce que vous proposez à vos clients : les 6 services Axion-IA",
        "Modalités de commission et de co-vente",
        "Comment rejoindre le programme partenaires",
      ],
    },
    urlCible: "/fr/partenaires",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
    note: "Page /fr/partenaires/ à créer (ABSENT selon audit A5). Footer colonne Entreprise une fois créée.",
  },

  {
    keyword: "programme partenaires IA B2B commission",
    intent: "partenaire",
    kbType: "guide",
    module: "transversal",
    cible: "partenaire-commercial",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Programme partenaires Axion-IA : co-vendez l'IA auprès de vos clients B2B",
      metaTitle: "Programme partenaires IA B2B | Axion-IA",
      metaDescription:
        "Apporteurs, revendeurs, intégrateurs : notre programme partenaires B2B avec commission sur chaque mission signée.",
      h2Variants: [
        "Trois niveaux de partenariat : apporteur, co-vendeur, revendeur",
        "Taux de commission et conditions de paiement",
        "Ressources commerciales mises à disposition",
      ],
    },
    urlCible: "/fr/partenaires",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
  },

  {
    keyword: "co-vendre formation IA entreprises",
    intent: "partenaire",
    kbType: "guide",
    module: "interventions-formations",
    cible: "partenaire-commercial",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Co-vendre la formation IA auprès des entreprises : notre partenariat commercial",
      metaTitle: "Co-vente formation IA entreprises — Partenariat Axion-IA",
      metaDescription:
        "Vous avez accès aux DG et DRH des PME ? Co-vendez nos formations IA opérationnelles avec une commission sur chaque contrat signé.",
      h2Variants: [
        "Ce que vous vendez : formations IA terrain, pas de MOOC",
        "Votre rôle commercial et notre rôle opérationnel",
        "Démarrer une collaboration commerciale",
      ],
    },
    urlCible: "/fr/partenaires",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
  },

  {
    keyword: "apporteur d'affaires cabinet IA France",
    intent: "partenaire",
    kbType: "guide",
    module: "transversal",
    cible: "partenaire-commercial",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Apporteurs d'affaires IA : recommandez Axion-IA et soyez rémunérés",
      metaTitle: "Apporteur d'affaires cabinet IA France — Programme Axion-IA",
      metaDescription:
        "Recommandez nos services IA à vos contacts dirigeants et recevez une commission sur chaque mission signée grâce à vous.",
      h2Variants: [
        "Comment fonctionne l'apport d'affaires chez Axion-IA",
        "Commission et traçabilité : processus transparent",
        "Devenir apporteur d'affaires : démarrer en 48 heures",
      ],
    },
    urlCible: "/fr/partenaires",
    canonicalParent: "/fr/partenaires",
    source: "autocomplete",
  },

  {
    keyword: "recommander cabinet IA rémunération",
    intent: "partenaire",
    kbType: "guide",
    module: "transversal",
    cible: "partenaire-commercial",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Être rémunéré pour recommander Axion-IA : notre programme de recommandation",
      metaTitle: "Recommander un cabinet IA et être rémunéré — Axion-IA",
      metaDescription:
        "Vous recommandez Axion-IA à un dirigeant, il signe une mission : vous percevez une commission. Simple, transparent, sans engagement.",
      h2Variants: [
        "Qui peut recommander Axion-IA ?",
        "Processus de suivi et de paiement de la commission",
        "Rejoindre le programme de recommandation",
      ],
    },
    urlCible: "/fr/partenaires",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
    note: "Longue traîne avec intent très direct (rémunération) ; conversion forte attendue",
  },

  // ── E3 — Prescripteurs ───────────────────────────────────────────────────

  {
    keyword: "expert-comptable recommander IA à ses clients",
    intent: "partenaire",
    kbType: "guide",
    module: "transversal",
    cible: "prescripteur",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Expert-comptable : comment recommander l'IA à vos clients PME et en être reconnu",
      metaTitle: "Expert-comptable & IA — Recommandez Axion-IA à vos clients",
      metaDescription:
        "Vos clients PME vous demandent comment démarrer avec l'IA ? Devenez prescripteur Axion-IA et accompagnez-les avec un cabinet de confiance.",
      h2Variants: [
        "Pourquoi vos clients PME ont besoin d'un cabinet IA maintenant",
        "Ce que vous gagnez en prescrivant Axion-IA : commission + valeur ajoutée client",
        "Processus de recommandation : simple, tracé, rémunéré",
      ],
    },
    urlCible: "/fr/partenaires/prescripteurs",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
    note: "Audience prescripteur clé ; volume faible mais conversion B2B2B très élevée. Schema.org : Service + Organization",
  },

  {
    keyword: "CCI partenariat formation IA adhérents",
    intent: "partenaire",
    kbType: "guide",
    module: "interventions-formations",
    cible: "cci-chambre-metiers",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "CCI & formation IA : un partenariat pour accélérer la transformation de vos adhérents",
      metaTitle: "Partenariat CCI formation IA adhérents — Axion-IA",
      metaDescription:
        "CCI et chambres des métiers : proposez des formations IA opérationnelles à vos adhérents PME avec un cabinet spécialisé.",
      h2Variants: [
        "Ce que nous proposons aux CCI : formats adaptés à vos adhérents",
        "Modalités de partenariat : co-branding ou white-label",
        "Exemples de programmes IA pour adhérents CCI",
      ],
    },
    urlCible: "/fr/partenaires/prescripteurs",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
    note: "Segment cci-chambre-metiers déclaré dans types.ts ; fort levier de volume sur le territoire",
  },

  {
    keyword: "chambre des métiers formation IA artisans",
    intent: "partenaire",
    kbType: "guide",
    module: "interventions-formations",
    cible: "cci-chambre-metiers",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Chambre des Métiers & IA : former les artisans aux outils intelligents",
      metaTitle: "Chambre des métiers formation IA artisans — Axion-IA",
      metaDescription:
        "Artisans et TPE de l'artisanat : des formations IA courtes et pratiques pour optimiser devis, gestion, communication client.",
      h2Variants: [
        "Cas d'usage IA pour artisans : devis rapides, réponse client automatisée",
        "Format adapté aux contraintes des artisans : 1 journée, en région",
        "Partenariat chambre des métiers : démarche de conventionnement",
      ],
    },
    urlCible: "/fr/partenaires/prescripteurs",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
  },

  {
    keyword: "prescripteur IA commission apport affaires",
    intent: "partenaire",
    kbType: "guide",
    module: "transversal",
    cible: "prescripteur",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Prescripteur IA : recommandez Axion-IA et recevez une commission sur chaque affaire",
      metaTitle: "Prescripteur IA commission — Programme Axion-IA",
      metaDescription:
        "Experts-comptables, avocats, CCI : devenez prescripteur officiel Axion-IA avec commission transparente sur chaque mission signée.",
      h2Variants: [
        "Qui peut devenir prescripteur Axion-IA ?",
        "Mécanisme de commission : taux, délai de paiement, traçabilité",
        "Rejoindre le réseau prescripteurs : processus en 3 étapes",
      ],
    },
    urlCible: "/fr/partenaires/prescripteurs",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
  },

  {
    keyword: "avocat recommander transformation IA cabinet",
    intent: "partenaire",
    kbType: "guide",
    module: "transversal",
    cible: "prescripteur",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Avocats : recommandez la transformation IA à vos clients dirigeants",
      metaTitle: "Avocat prescripteur IA — Recommandez Axion-IA à vos clients",
      metaDescription:
        "Vous accompagnez des dirigeants d'entreprises ? Prescrivez Axion-IA pour leur transformation IA et soyez reconnu pour cette valeur ajoutée.",
      h2Variants: [
        "Pourquoi les avocats d'affaires prescrivent l'IA à leurs clients",
        "Ce que vos clients gagnent avec Axion-IA",
        "Devenir prescripteur : simple, transparent, rémunéré",
      ],
    },
    urlCible: "/fr/partenaires/prescripteurs",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
    note: "Audience avocat d'affaires / conseil ; confidentiel, pas de nav principale",
  },

  {
    keyword: "syndicat patronal programme formation IA adhérents",
    intent: "partenaire",
    kbType: "guide",
    module: "interventions-formations",
    cible: "syndicat-patronal",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Syndicats patronaux : proposez la formation IA comme avantage différenciant à vos adhérents",
      metaTitle: "Formation IA syndicats patronaux | Axion-IA",
      metaDescription:
        "MEDEF, CPME, U2P et fédérations sectorielles : construisez une offre de formation IA pour vos adhérents avec Axion-IA.",
      h2Variants: [
        "Nos programmes IA pour fédérations et syndicats patronaux",
        "Modalités : co-branding, catalogue partagé, tarifs membres",
        "Exemples de partenariats sectoriels actifs",
      ],
    },
    urlCible: "/fr/partenaires/prescripteurs",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
    note: "Segment syndicat-patronal dans types.ts ; fort levier de volume sectoriel",
  },

  {
    keyword: "association professionnelle former membres intelligence artificielle",
    intent: "partenaire",
    kbType: "guide",
    module: "interventions-formations",
    cible: "association-professionnelle",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Associations professionnelles : formez vos membres à l'IA opérationnelle",
      metaTitle: "Association professionnelle formation IA membres — Axion-IA",
      metaDescription:
        "Proposez à vos membres des formations IA concrètes via un partenariat Axion-IA : contenu sur-mesure, tarif négocié membres.",
      h2Variants: [
        "Programmes adaptés aux associations professionnelles",
        "Tarification membres : accès préférentiel négocié",
        "Partenariat de contenu : co-production de ressources IA sectorielles",
      ],
    },
    urlCible: "/fr/partenaires/prescripteurs",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
  },

  {
    keyword: "réseau prescripteurs intelligence artificielle France",
    intent: "partenaire",
    kbType: "guide",
    module: "transversal",
    cible: "prescripteur",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Rejoindre le réseau prescripteurs IA d'Axion-IA : experts, institutionnels, partenaires",
      metaTitle: "Réseau prescripteurs IA France — Axion-IA",
      metaDescription:
        "Experts-comptables, avocats, CCI, syndicats : rejoignez le réseau de prescripteurs Axion-IA et recommandez l'IA à vos clients.",
      h2Variants: [
        "Qui fait partie du réseau prescripteurs Axion-IA",
        "Les avantages du réseau : formation, commission, outillage commercial",
        "Candidater au réseau",
      ],
    },
    urlCible: "/fr/partenaires/prescripteurs",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
    note: "Page hub prescripteurs ; JSON-LD Organization + Service recommandé",
  },

  // ── E4 — Partenaires tech ────────────────────────────────────────────────

  {
    keyword: "intégrateur Make IA France certifié",
    intent: "partenaire",
    kbType: "guide",
    module: "implementation",
    cible: "partenaire-commercial",
    priorite: 3,
    niveau: 2,
    injection: {
      h1: "Axion-IA, intégrateur Make.com pour l'automatisation IA des PME françaises",
      metaTitle: "Intégrateur Make IA France — Axion-IA",
      metaDescription:
        "Automatisation no-code avec Make.com couplée aux LLM : Axion-IA conçoit et déploie vos scénarios IA sur Make pour vos processus métier.",
      h2Variants: [
        "Notre expertise Make.com : +50 scénarios déployés clients",
        "Make + Claude API : la combinaison qui transforme vos processus",
        "Démarrer un projet Make IA avec Axion-IA",
      ],
    },
    urlCible: "/fr/partenaires",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
    note: "Axion-IA se positionne comme intégrateur (sans partenariat financier officiel Make). Attention : stack-ia/page.tsx affirme 'aucun partenariat commercial' — formuler soigneusement : 'expert Make' pas 'partenaire certifié Make'.",
  },

  {
    keyword: "consultant n8n certifié PME France",
    intent: "partenaire",
    kbType: "guide",
    module: "implementation",
    cible: "partenaire-commercial",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Consultant n8n pour PME françaises : automatisation open-source et agents IA",
      metaTitle: "Consultant n8n PME France | Axion-IA",
      metaDescription:
        "Déployez n8n dans votre PME avec des consultants qui connaissent les limites et les forces de l'outil dans des contextes réels.",
      h2Variants: [
        "Pourquoi n8n est notre outil d'automatisation de référence pour PME",
        "Nos missions n8n types : de l'install au workflow IA en production",
        "Self-hosted ou cloud n8n : notre recommandation selon votre contexte",
      ],
    },
    urlCible: "/fr/partenaires",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
    note: "Même précaution que Make : 'expert n8n' et non 'certifié n8n' pour respecter charte éditoriale /stack-ia",
  },

  {
    keyword: "agence Claude API France développement",
    intent: "partenaire",
    kbType: "guide",
    module: "codage-developpement",
    cible: "partenaire-commercial",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Développement Claude API France : Axion-IA, cabinet expert des LLM Anthropic",
      metaTitle: "Agence Claude API France — Développement LLM Axion-IA",
      metaDescription:
        "Intégrez Claude d'Anthropic dans vos produits et processus : Axion-IA développe vos applications LLM sur l'API Claude.",
      h2Variants: [
        "Nos usages Claude API : agents, RAG, extraction, génération",
        "Workflow type d'une mission Claude API chez nos clients",
        "Pourquoi nous choisissons Claude pour la majorité de nos projets LLM",
      ],
    },
    urlCible: "/fr/partenaires",
    canonicalParent: "/fr/partenaires",
    source: "autocomplete",
    note: "Différenciateur fort : expertise Claude API = crédibilité technique. Pas de lien vers /stack-ia disclaimers.",
  },

  {
    keyword: "implémenteur IA Anthropic France partenaire",
    intent: "partenaire",
    kbType: "guide",
    module: "implementation",
    cible: "partenaire-commercial",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Partenaires implémenteurs IA Anthropic en France : expertise Claude pour vos projets",
      metaTitle: "Implémenteur IA Anthropic France — Axion-IA",
      metaDescription:
        "Vous cherchez un cabinet français spécialisé dans l'implémentation de Claude et des APIs Anthropic ? Axion-IA est votre partenaire terrain.",
      h2Variants: [
        "Notre expertise Anthropic : API Claude 3.5/Opus dans des contextes B2B",
        "Projets de référence : de l'intégration simple à l'agent complexe",
        "Travailler avec Axion-IA sur votre projet Anthropic",
      ],
    },
    urlCible: "/fr/partenaires",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
  },

  {
    keyword: "partenariat agence IA et cabinet conseil stratégie",
    intent: "partenaire",
    kbType: "guide",
    module: "transversal",
    cible: "partenaire-commercial",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Partenariat Axion-IA × cabinets de conseil : offre IA complémentaire pour vos clients",
      metaTitle: "Partenariat cabinet conseil IA — Co-offre Axion-IA",
      metaDescription:
        "Cabinet de conseil en stratégie ou transformation ? Proposez l'IA opérationnelle à vos clients grâce à un partenariat Axion-IA.",
      h2Variants: [
        "Ce que vous apportez, ce qu'Axion-IA apporte",
        "Modèles de co-vente et de white-label",
        "Démarrer un partenariat cabinet-à-cabinet",
      ],
    },
    urlCible: "/fr/partenaires",
    canonicalParent: "/fr/partenaires",
    source: "manuel",
    note: "Segment B2B2B : cabinets conseil généralistes qui n'ont pas l'expertise IA en interne",
  },
];
