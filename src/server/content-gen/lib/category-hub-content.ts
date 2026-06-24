/**
 * Contenu éditorial des hubs de catégorie blog — schéma de héro (orbital) + FAQ.
 *
 * SSOT pour :
 *   • le graphique de héro (schéma orbital `ServiceHero`/`ImplementationHeroSchema`,
 *     comme /audit et /un-a-un) — 8 satellites par catégorie ;
 *   • la FAQ visible + le JSON-LD FAQPage (AEO / featured snippets / AI Overviews).
 *
 * Les 5 slugs content-gen sont couverts ; `getCategoryHubContent` retombe sur un
 * preset générique pour les catégories FS legacy hors content-gen.
 */

import type { Locale } from "@/i18n/routing";

type Accent = "terracotta" | "primary" | "sage" | "mocha";

export interface HeroSchemaNode {
  readonly label: string;
  readonly benefit: string;
  readonly accent: Accent;
}

export interface CategoryFaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface CategoryHubContent {
  /** Label central du schéma orbital (ex « Formations IA »). */
  readonly centerLabel: string;
  /** 8 satellites — un par dimension de la thématique. */
  readonly nodes: ReadonlyArray<HeroSchemaNode>;
  /** aria-label complet du schéma (a11y). */
  readonly schemaAriaLabel: string;
  /** 3-4 questions/réponses (FAQ visible + FAQPage JSON-LD). */
  readonly faq: ReadonlyArray<CategoryFaqItem>;
}

const ACCENTS: readonly Accent[] = ["terracotta", "primary", "sage", "mocha"];

/** Construit 8 nodes en alternant les accents, à partir de paires label/benefit. */
function buildNodes(pairs: ReadonlyArray<readonly [string, string]>): HeroSchemaNode[] {
  return pairs.map(([label, benefit], i) => ({
    label,
    benefit,
    accent: ACCENTS[i % ACCENTS.length] as Accent,
  }));
}

type Catalog = Record<string, Record<Locale, CategoryHubContent>>;

const CATALOG: Catalog = {
  "blog-formations-ia": {
    fr: {
      centerLabel: "Formations IA",
      nodes: buildNodes([
        ["Fondamentaux", "Comprendre l'IA"],
        ["Prompt engineering", "Prompts efficaces"],
        ["Cas pratiques", "Mise en application"],
        ["Outils", "Stack adaptée"],
        ["Sécurité", "Usage maîtrisé"],
        ["Méthode", "Cadre éprouvé"],
        ["ROI", "Gains mesurés"],
        ["Suivi", "Ancrage durable"],
      ]),
      schemaAriaLabel:
        "Schéma : « Formations IA » au centre, entouré des 8 dimensions de la montée en compétences.",
      faq: [
        {
          question: "À qui s'adressent les formations IA Axion-IA ?",
          answer:
            "Aux dirigeants, équipes et indépendants qui veulent passer de la théorie à un usage concret de l'IA dans leur métier, sans prérequis technique.",
        },
        {
          question: "Les formations IA sont-elles finançables ?",
          answer:
            "Oui : Axion-IA est un organisme de formation et les parcours peuvent être financés (OPCO, plan de développement des compétences) selon votre situation.",
        },
        {
          question: "Combien de temps pour être autonome sur l'IA ?",
          answer:
            "La plupart des participants appliquent les premiers cas d'usage dès la première session ; l'autonomie sur un workflow complet se construit en quelques semaines de pratique.",
        },
      ],
    },
    en: {
      centerLabel: "AI training",
      nodes: buildNodes([
        ["Fundamentals", "Understand AI"],
        ["Prompt engineering", "Effective prompts"],
        ["Hands-on", "Real practice"],
        ["Tooling", "Right stack"],
        ["Security", "Safe usage"],
        ["Method", "Proven framework"],
        ["ROI", "Measured gains"],
        ["Follow-up", "Lasting habits"],
      ]),
      schemaAriaLabel:
        "Diagram: “AI training” at the center, surrounded by the 8 dimensions of upskilling.",
      faq: [
        {
          question: "Who are Axion-IA's AI trainings for?",
          answer:
            "For leaders, teams and freelancers who want to move from theory to concrete AI use in their work, with no technical prerequisite.",
        },
        {
          question: "Can the AI trainings be funded?",
          answer:
            "Yes: Axion-IA is a registered training provider and programs can be funded depending on your situation.",
        },
        {
          question: "How long until I'm autonomous with AI?",
          answer:
            "Most participants apply their first use cases in the very first session; full-workflow autonomy builds over a few weeks of practice.",
        },
      ],
    },
  },

  "blog-coaching-1-to-1": {
    fr: {
      centerLabel: "Coaching 1-to-1",
      nodes: buildNodes([
        ["Diagnostic", "Point de départ"],
        ["Objectifs", "Cap clair"],
        ["Outils IA", "Sélection ciblée"],
        ["Productivité", "Temps gagné"],
        ["Décision", "Mieux arbitrer"],
        ["Posture", "Confiance IA"],
        ["Suivi", "Accompagnement"],
        ["Résultats", "Impact concret"],
      ]),
      schemaAriaLabel:
        "Schéma : « Coaching 1-to-1 » au centre, entouré des 8 dimensions de l'accompagnement individuel.",
      faq: [
        {
          question: "Comment se déroule un coaching IA individuel ?",
          answer:
            "En séances individuelles centrées sur vos cas réels : on diagnostique vos besoins, on choisit les bons outils IA et on les met en place sur votre poste, avec un suivi.",
        },
        {
          question: "Le coaching 1-to-1 est-il finançable (AFEST) ?",
          answer:
            "Oui : le coaching peut être structuré en AFEST (action de formation en situation de travail) et financé via votre OPCO selon votre éligibilité.",
        },
        {
          question: "Faut-il des connaissances techniques ?",
          answer:
            "Non. L'accompagnement part de votre métier et de vos outils actuels ; aucune compétence technique préalable n'est requise.",
        },
      ],
    },
    en: {
      centerLabel: "1-to-1 coaching",
      nodes: buildNodes([
        ["Diagnosis", "Starting point"],
        ["Goals", "Clear direction"],
        ["AI tools", "Targeted picks"],
        ["Productivity", "Time saved"],
        ["Decisions", "Better calls"],
        ["Mindset", "AI confidence"],
        ["Follow-up", "Ongoing support"],
        ["Results", "Concrete impact"],
      ]),
      schemaAriaLabel:
        "Diagram: “1-to-1 coaching” at the center, surrounded by the 8 dimensions of individual support.",
      faq: [
        {
          question: "How does individual AI coaching work?",
          answer:
            "Through one-on-one sessions focused on your real cases: we diagnose your needs, pick the right AI tools and set them up in your role, with follow-up.",
        },
        {
          question: "Can 1-to-1 coaching be funded?",
          answer:
            "Yes: coaching can be structured as on-the-job training and funded through your provider depending on eligibility.",
        },
        {
          question: "Do I need technical skills?",
          answer:
            "No. Coaching starts from your job and current tools; no prior technical skill is required.",
        },
      ],
    },
  },

  "blog-audits-ia": {
    fr: {
      centerLabel: "Audit IA",
      nodes: buildNodes([
        ["Processus", "Cartographie"],
        ["Données", "Qualité & accès"],
        ["Outils", "État des lieux"],
        ["Risques", "Conformité"],
        ["Quick-wins", "Gains rapides"],
        ["Priorisation", "Roadmap"],
        ["ROI", "Chiffrage"],
        ["Feuille de route", "Plan d'action"],
      ]),
      schemaAriaLabel:
        "Schéma : « Audit IA » au centre, entouré des 8 dimensions de l'audit d'opportunités IA.",
      faq: [
        {
          question: "Qu'est-ce qu'un audit IA Axion-IA ?",
          answer:
            "Un état des lieux de vos processus, données et outils pour identifier les cas d'usage IA à plus fort ROI, avec une feuille de route priorisée.",
        },
        {
          question: "Combien de temps dure un audit IA ?",
          answer:
            "Selon le périmètre, un audit se mène en quelques jours à quelques semaines, et aboutit à des quick-wins activables immédiatement.",
        },
        {
          question: "Que livre concrètement l'audit ?",
          answer:
            "Une cartographie des opportunités, une priorisation par ROI/effort, les risques (RGPD, IA Act) et un plan d'action chiffré.",
        },
      ],
    },
    en: {
      centerLabel: "AI audit",
      nodes: buildNodes([
        ["Process", "Mapping"],
        ["Data", "Quality & access"],
        ["Tools", "Current state"],
        ["Risks", "Compliance"],
        ["Quick wins", "Fast gains"],
        ["Prioritization", "Roadmap"],
        ["ROI", "Quantified"],
        ["Roadmap", "Action plan"],
      ]),
      schemaAriaLabel:
        "Diagram: “AI audit” at the center, surrounded by the 8 dimensions of an AI opportunity audit.",
      faq: [
        {
          question: "What is an Axion-IA AI audit?",
          answer:
            "A review of your processes, data and tools to identify the highest-ROI AI use cases, with a prioritized roadmap.",
        },
        {
          question: "How long does an AI audit take?",
          answer:
            "Depending on scope, an audit runs from a few days to a few weeks and surfaces quick wins you can act on immediately.",
        },
        {
          question: "What does the audit deliver?",
          answer:
            "An opportunity map, ROI/effort prioritization, risks (GDPR, AI Act) and a costed action plan.",
        },
      ],
    },
  },

  "blog-implementations-ia": {
    fr: {
      centerLabel: "Automatisation IA",
      nodes: buildNodes([
        ["Cas d'usage", "Bien choisir"],
        ["Intégration", "Vos outils"],
        ["Données", "Pipeline fiable"],
        ["Workflow", "Bout en bout"],
        ["Sécurité", "Conformité"],
        ["Adoption", "Équipe embarquée"],
        ["Mesure", "Suivi des gains"],
        ["Support", "Pérennité"],
      ]),
      schemaAriaLabel:
        "Schéma : « Automatisation IA » au centre, entouré des 8 dimensions de l'implémentation IA.",
      faq: [
        {
          question: "Qu'est-ce qu'une implémentation IA réussie ?",
          answer:
            "Une automatisation intégrée à vos outils existants, fiable sur la durée, adoptée par les équipes et dont les gains sont mesurés.",
        },
        {
          question: "Mes outils actuels sont-ils compatibles ?",
          answer:
            "Le plus souvent oui : on s'intègre à votre stack (CRM, ERP, suite bureautique…) plutôt que de tout remplacer.",
        },
        {
          question: "Comment garantir l'adoption par l'équipe ?",
          answer:
            "Par un cadrage des cas d'usage, une mise en place progressive et un accompagnement au changement avec mesure des gains.",
        },
      ],
    },
    en: {
      centerLabel: "AI automation",
      nodes: buildNodes([
        ["Use cases", "Right picks"],
        ["Integration", "Your tools"],
        ["Data", "Reliable pipeline"],
        ["Workflow", "End to end"],
        ["Security", "Compliance"],
        ["Adoption", "Team on board"],
        ["Measurement", "Track gains"],
        ["Support", "Longevity"],
      ]),
      schemaAriaLabel:
        "Diagram: “AI automation” at the center, surrounded by the 8 dimensions of AI implementation.",
      faq: [
        {
          question: "What is a successful AI implementation?",
          answer:
            "An automation integrated into your existing tools, reliable over time, adopted by teams and with measured gains.",
        },
        {
          question: "Are my current tools compatible?",
          answer:
            "Usually yes: we integrate with your stack (CRM, ERP, office suite…) rather than replacing everything.",
        },
        {
          question: "How do you ensure team adoption?",
          answer:
            "By scoping use cases, rolling out gradually and supporting change management with measured gains.",
        },
      ],
    },
  },

  "blog-sites-web-augmentes": {
    fr: {
      centerLabel: "Site augmenté",
      nodes: buildNodes([
        ["SEO", "Visibilité Google"],
        ["AEO / GEO", "Cité par les IA"],
        ["Performance", "Web Vitals"],
        ["Contenu IA", "À l'échelle"],
        ["Conversion", "Plus de leads"],
        ["Accessibilité", "Pour tous"],
        ["Analytics", "Pilotage"],
        ["Maintenance", "Site vivant"],
      ]),
      schemaAriaLabel:
        "Schéma : « Site augmenté » au centre, entouré des 8 dimensions d'un site web augmenté par l'IA.",
      faq: [
        {
          question: "Qu'est-ce qu'un site web « augmenté par l'IA » ?",
          answer:
            "Un site pensé pour être trouvé (SEO) ET cité par les IA (AEO/GEO), rapide (Web Vitals), avec du contenu produit à l'échelle et optimisé pour la conversion.",
        },
        {
          question: "Quelle différence entre SEO et AEO/GEO ?",
          answer:
            "Le SEO vise le classement dans Google ; l'AEO/GEO vise à être cité dans les réponses des IA (AI Overviews, ChatGPT, Claude) — les deux sont complémentaires.",
        },
        {
          question: "Faut-il refaire tout mon site ?",
          answer:
            "Pas nécessairement : on augmente l'existant (structure, contenu, données structurées, performance) plutôt que de repartir de zéro quand c'est possible.",
        },
      ],
    },
    en: {
      centerLabel: "Augmented site",
      nodes: buildNodes([
        ["SEO", "Google visibility"],
        ["AEO / GEO", "Cited by AIs"],
        ["Performance", "Web Vitals"],
        ["AI content", "At scale"],
        ["Conversion", "More leads"],
        ["Accessibility", "For everyone"],
        ["Analytics", "Steering"],
        ["Maintenance", "Living site"],
      ]),
      schemaAriaLabel:
        "Diagram: “Augmented site” at the center, surrounded by the 8 dimensions of an AI-augmented website.",
      faq: [
        {
          question: "What is an “AI-augmented” website?",
          answer:
            "A site built to be found (SEO) AND cited by AIs (AEO/GEO), fast (Web Vitals), with content produced at scale and optimized for conversion.",
        },
        {
          question: "What's the difference between SEO and AEO/GEO?",
          answer:
            "SEO targets Google rankings; AEO/GEO targets being cited in AI answers (AI Overviews, ChatGPT, Claude) — they are complementary.",
        },
        {
          question: "Do I need to rebuild my whole site?",
          answer:
            "Not necessarily: we augment the existing site (structure, content, structured data, performance) rather than starting from scratch when possible.",
        },
      ],
    },
  },
};

const GENERIC: Record<Locale, CategoryHubContent> = {
  fr: {
    centerLabel: "Thématique",
    nodes: buildNodes([
      ["Méthode", "Cadre éprouvé"],
      ["Cas d'usage", "Concrets"],
      ["Outils", "Sélection"],
      ["Résultats", "Mesurés"],
      ["ROI", "Chiffré"],
      ["Sécurité", "Maîtrisée"],
      ["Ressources", "Complètes"],
      ["Support", "Dédié"],
    ]),
    schemaAriaLabel:
      "Schéma : la thématique au centre, entourée de ses 8 dimensions (méthode, cas d'usage, outils, résultats…).",
    faq: [
      {
        question: "Que trouve-t-on dans cette catégorie ?",
        answer:
          "Des articles concrets — méthodologie, cas d'usage et retours de terrain — pour passer à l'action sur l'IA dans votre métier.",
      },
      {
        question: "Les contenus sont-ils mis à jour ?",
        answer:
          "Oui : les articles sont revus régulièrement pour rester alignés sur les meilleures pratiques IA du moment.",
      },
    ],
  },
  en: {
    centerLabel: "Topic",
    nodes: buildNodes([
      ["Method", "Proven framework"],
      ["Use cases", "Concrete"],
      ["Tools", "Selection"],
      ["Results", "Measured"],
      ["ROI", "Quantified"],
      ["Security", "Controlled"],
      ["Resources", "Complete"],
      ["Support", "Dedicated"],
    ]),
    schemaAriaLabel:
      "Diagram: the topic at the center, surrounded by its 8 dimensions (method, use cases, tools, results…).",
    faq: [
      {
        question: "What's in this category?",
        answer:
          "Concrete articles — methodology, use cases and field feedback — to take action on AI in your work.",
      },
      {
        question: "Is the content kept up to date?",
        answer:
          "Yes: articles are reviewed regularly to stay aligned with current AI best practices.",
      },
    ],
  },
};

/** Contenu du hub pour un slug donné (fallback générique si hors catalogue). */
export function getCategoryHubContent(slug: string, locale: Locale): CategoryHubContent {
  return CATALOG[slug]?.[locale] ?? GENERIC[locale];
}

export interface BlogHubHero {
  readonly centerLabel: string;
  readonly nodes: ReadonlyArray<HeroSchemaNode>;
  readonly schemaAriaLabel: string;
}

/**
 * Schéma orbital du hub /blog/categorie — 8 satellites = les 5 catégories +
 * 3 fils transverses. Centre « Blog IA ».
 */
export function getBlogHubHero(locale: Locale): BlogHubHero {
  if (locale === "fr") {
    return {
      centerLabel: "Blog IA",
      nodes: buildNodes([
        ["Formations IA", "Monter en compétences"],
        ["Coaching 1-to-1", "Accompagnement"],
        ["Audits IA", "Opportunités"],
        ["Implémentation", "Automatisation"],
        ["Sites web", "SEO & AEO"],
        ["Quick-wins", "Gains rapides"],
        ["ROI", "Impact chiffré"],
        ["Méthode", "Cadre éprouvé"],
      ]),
      schemaAriaLabel:
        "Schéma : « Blog IA » au centre, entouré des 5 thématiques et 3 fils transverses du blog.",
    };
  }
  return {
    centerLabel: "AI blog",
    nodes: buildNodes([
      ["AI training", "Upskilling"],
      ["1-to-1 coaching", "Guidance"],
      ["AI audits", "Opportunities"],
      ["Implementation", "Automation"],
      ["Websites", "SEO & AEO"],
      ["Quick wins", "Fast gains"],
      ["ROI", "Measured impact"],
      ["Method", "Proven framework"],
    ]),
    schemaAriaLabel:
      "Diagram: “AI blog” at the center, surrounded by the 5 topics and 3 cross-cutting threads of the blog.",
  };
}

/** FAQ du hub /blog/categorie (orientée organisation des thématiques). */
export function getBlogHubFaq(locale: Locale): ReadonlyArray<CategoryFaqItem> {
  if (locale === "fr") {
    return [
      {
        question: "Comment le blog Axion-IA est-il organisé ?",
        answer:
          "En 5 thématiques : Formations IA, Coaching 1-to-1, Audits IA, Implémentation & automatisation, et Sites web augmentés. Chaque thématique regroupe méthodologie et cas d'usage concrets.",
      },
      {
        question: "Par où commencer si je débute avec l'IA ?",
        answer:
          "Par la thématique « Formations IA » pour les fondamentaux, puis « Audits IA » pour identifier les opportunités à plus fort ROI dans votre activité.",
      },
      {
        question: "Les articles sont-ils mis à jour ?",
        answer:
          "Oui : les contenus sont revus régulièrement pour rester alignés sur les meilleures pratiques IA du moment.",
      },
    ];
  }
  return [
    {
      question: "How is the Axion-IA blog organized?",
      answer:
        "Into 5 topics: AI training, 1-to-1 coaching, AI audits, Implementation & automation, and AI-augmented websites. Each topic gathers methodology and concrete use cases.",
    },
    {
      question: "Where should I start if I'm new to AI?",
      answer:
        "With the “AI training” topic for fundamentals, then “AI audits” to spot the highest-ROI opportunities in your business.",
    },
    {
      question: "Are the articles kept up to date?",
      answer: "Yes: content is reviewed regularly to stay aligned with current AI best practices.",
    },
  ];
}

/** FAQ de l'accueil /blog (orientée ligne éditoriale & confiance). */
export function getBlogHomeFaq(locale: Locale): ReadonlyArray<CategoryFaqItem> {
  if (locale === "fr") {
    return [
      {
        question: "Qui écrit les articles du blog Axion-IA ?",
        answer:
          "Les contenus sont produits et relus par l'équipe Axion-IA (Manon, Williams) à partir de missions réelles : méthodologie testée en mission, pas de théorie générique.",
      },
      {
        question: "À quelle fréquence publiez-vous ?",
        answer:
          "Régulièrement, avec une mise à jour des articles existants pour qu'ils restent exacts et alignés sur les meilleures pratiques IA du moment.",
      },
      {
        question: "Comment passer de la lecture à l'action ?",
        answer:
          "Chaque thématique mène à un format concret : un audit IA pour cadrer les opportunités, une formation pour monter en compétences, ou un coaching individuel.",
      },
    ];
  }
  return [
    {
      question: "Who writes the Axion-IA blog?",
      answer:
        "Content is produced and reviewed by the Axion-IA team (Manon, Williams) from real engagements: field-tested methodology, not generic theory.",
    },
    {
      question: "How often do you publish?",
      answer:
        "Regularly, with updates to existing articles so they stay accurate and aligned with current AI best practices.",
    },
    {
      question: "How do I move from reading to action?",
      answer:
        "Each topic leads to a concrete format: an AI audit to frame opportunities, a training to upskill, or 1-to-1 coaching.",
    },
  ];
}
