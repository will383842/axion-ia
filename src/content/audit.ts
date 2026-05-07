// Content pack — Module 2 Audit & optimisation (5 pages).
// Refonte 2026-05-07 : pyramide 4 niveaux orientée conversion B2B.
//   N1 Flash · 490 € (distance) · 890 € (sur site) — produit d'appel
//   N2 Process · 1 900 → 3 900 € — cœur de marché PME
//   N3 Stratégique PME · 4 900 → 9 900 € — premium PME
//   N4 Stratégique ETI · à partir de 12 000 € — hero offer multi-sites
//
// Garanties par niveau :
//   N1 → satisfait ou intégralement remboursé (booster conversion)
//   N3 → garantie de découverte 30 j (rembourse si aucune action concrète)
//   N4 → devis sous 48 h ouvrées
//
// Pas d'engagement de durée d'audit (pas de "5 jours", "12 mois", etc.).

export type AuditSlug = "flash" | "process" | "strategique-pme" | "strategique-eti";

/** Accent visuel par audit — conserve la palette Editorial v3. */
export type AuditAccent = "terracotta" | "primary" | "sage" | "mocha";

/** Bloc résumé orienté conversion utilisé par la page listing /audit. */
export interface AuditSummary {
  /** Promesse 1 ligne — bénéfice principal, conversion-friendly. */
  benefitTagline: string;
  /** Durée indicative — toujours formulée sans engagement de jours
      (ex "Adapté à votre périmètre"). */
  duration: string;
  /** Prix résumé (ligne unique). À distance, entrée de gamme. */
  priceFrom: string;
  /** Tranches de prix — si > 1, affichées dans le KPI card flagship. */
  priceTiers?: ReadonlyArray<{ size: string; price: string }>;
  /** Modalités proposées (ex "À distance ou sur site"). */
  modality: string;
  /** Audience visée — qui se reconnaîtra. */
  audience: string;
  /** Périmètre concret — ce qu'on étudie / ce qu'on ne fait pas. */
  scope: string;
  /** 3 livrables concrets après l'audit. */
  outcomes: ReadonlyArray<string>;
  /** Déroulement — 3 phases courtes (sans jours engagés). */
  outline: ReadonlyArray<string>;
  /** Garantie ou rassurance phare du niveau (ex "Satisfait ou remboursé"). */
  guarantee?: string;
  /** Texte du CTA dédié. */
  ctaLabel: string;
}

interface AuditContent {
  slug: AuditSlug;
  pathFr: string;
  pathEn: string;
  accent: AuditAccent;
  summary: { fr: AuditSummary; en: AuditSummary };
  fr: PageCopy;
  en: PageCopy;
}

interface PageCopy {
  eyebrow: string;
  title: string;
  answer: string;
  priceEur?: number;
  ctaPrimary: string;
  ctaSecondary: string;
  benefitsTitle: string;
  benefits: ReadonlyArray<{ title: string; description: string }>;
  processTitle: string;
  processSteps: ReadonlyArray<{ title: string; description: string }>;
  metricsTitle: string;
  metrics: ReadonlyArray<{ number: string; suffix: string; label: string }>;
  faqTitle: string;
  faqs: ReadonlyArray<{ id: string; question: string; answer: string }>;
  ctaBlockTitle: string;
  ctaBlockDescription: string;
  metaSeo: { title: string; description: string };
}

export const AUDITS: ReadonlyArray<AuditContent> = [
  // ============================================================
  // NIVEAU 1 — FLASH (produit d'appel)
  // ============================================================
  {
    slug: "flash",
    pathFr: "/audit/flash",
    pathEn: "/audit/flash",
    accent: "terracotta",
    summary: {
      fr: {
        benefitTagline:
          "Mini-diagnostic ciblé sur 1 process clé : 3 à 5 cas d'usage IA, gains estimés, plan d'action 30/90 jours. Le format pour démarrer sans engagement.",
        duration: "Adapté à votre périmètre",
        priceFrom: "Dès 490 € (à distance) · 890 € (sur site)",
        priceTiers: [
          { size: "Flash distance · 1 process", price: "490 €" },
          { size: "Flash terrain · sur site", price: "890 €" },
        ],
        modality: "À distance ou sur site",
        audience: "TPE & petites PME (0-30 salariés)",
        scope: "1 processus clé · ex. acquisition, support, facturation",
        outcomes: [
          "3 à 5 cas d'usage IA / automatisation identifiés",
          "Estimation des gains (heures libérées, erreurs évitées)",
          "Plan d'action 30 et 90 jours, prêt à activer",
        ],
        outline: [
          "On observe · pré-questionnaire + visio (ou jour terrain)",
          "On cartographie · décortique du flux + analyse offline",
          "On vous remet le plan · note 8-12 pages + visio de restitution",
        ],
        guarantee: "Satisfait ou intégralement remboursé",
        ctaLabel: "Réserver mon diagnostic flash",
      },
      en: {
        benefitTagline:
          "Targeted mini-diagnosis on 1 key process: 3-5 AI use cases, estimated gains, 30/90-day action plan. The format to start with zero risk.",
        duration: "Tailored to your scope",
        priceFrom: "From €490 (remote) · €890 (on site)",
        priceTiers: [
          { size: "Flash remote · 1 process", price: "€490" },
          { size: "Flash on site · 1 day", price: "€890" },
        ],
        modality: "Remote or on site",
        audience: "Small businesses (0-30 staff)",
        scope: "1 key process · e.g. acquisition, support, billing",
        outcomes: [
          "3 to 5 AI / automation use cases identified",
          "Gain estimates (hours freed, errors avoided)",
          "30 and 90-day action plan, ready to activate",
        ],
        outline: [
          "We observe · pre-questionnaire + video call (or on-site day)",
          "We map · breakdown of the flow + offline analysis",
          "We hand over the plan · 8-12 page note + debrief call",
        ],
        guarantee: "Satisfied or fully refunded",
        ctaLabel: "Book my flash diagnosis",
      },
    },
    fr: makeFr({
      eyebrow: "Niveau 1 · Flash",
      title: "Diagnostic flash · 490 € à distance, 890 € sur site",
      answer:
        "Mini-diagnostic IA ciblé sur un processus clé. 3 à 5 cas d'usage identifiés, estimation des gains, plan d'action 30/90 jours. Satisfait ou intégralement remboursé. Idéal pour démarrer sans engagement.",
      priceEur: 490,
      ctaPrimary: "Réserver mon diagnostic flash",
    }),
    en: makeEn({
      eyebrow: "Level 1 · Flash",
      title: "Flash diagnosis · €490 remote, €890 on site",
      answer:
        "Targeted mini AI diagnosis on a key process. 3-5 use cases identified, gain estimates, 30/90-day action plan. Satisfied or fully refunded. Ideal to start with zero commitment.",
      priceEur: 490,
      ctaPrimary: "Book my flash diagnosis",
    }),
  },
  // ============================================================
  // NIVEAU 2 — PROCESS (cœur de marché PME)
  // ============================================================
  {
    slug: "process",
    pathFr: "/audit/process",
    pathEn: "/audit/process",
    accent: "primary",
    summary: {
      fr: {
        benefitTagline:
          "Audit poussé d'un processus complet de bout en bout : cartographie as-is/to-be, tâches automatisables chiffrées, roadmap IA 6-12 mois.",
        duration: "Adapté à votre périmètre",
        priceFrom: "1 900 € → 3 900 €",
        priceTiers: [
          { size: "Process Solo · à distance, périmètre simple", price: "1 900 €" },
          { size: "Process Standard · mix site + visio", price: "2 900 €" },
          { size: "Process Avancé · process complexe, multi-acteurs", price: "3 900 €" },
        ],
        modality: "À distance ou mix site + visio",
        audience: "TPE matures · PME 10-80 salariés",
        scope: "1 processus complet (ou 2 petits) — bout en bout",
        outcomes: [
          "Cartographie as-is / to-be du processus",
          "Liste chiffrée des tâches automatisables (gain estimé par tâche)",
          "Roadmap IA 6-12 mois sur ce process : quick-wins + chantiers",
        ],
        outline: [
          "On observe · ateliers process (2-3 sessions) + entretiens utilisateurs (3-6 personnes)",
          "On cartographie · analyse outils, données, points de friction",
          "On vous remet le plan · rapport 20-30 pages + workshop équipe",
        ],
        ctaLabel: "Demander un audit Process",
      },
      en: {
        benefitTagline:
          "In-depth audit of an end-to-end process: as-is/to-be mapping, costed automatable tasks, 6-12 month AI roadmap.",
        duration: "Tailored to your scope",
        priceFrom: "€1,900 → €3,900",
        priceTiers: [
          { size: "Process Solo · remote, simple scope", price: "€1,900" },
          { size: "Process Standard · mix on-site + remote", price: "€2,900" },
          { size: "Process Advanced · complex, multi-stakeholder", price: "€3,900" },
        ],
        modality: "Remote or hybrid on-site + remote",
        audience: "Mature small businesses · SMB 10-80 staff",
        scope: "1 complete process (or 2 small ones) — end to end",
        outcomes: [
          "As-is / to-be process mapping",
          "Costed list of automatable tasks (estimated gain per task)",
          "6-12 month AI roadmap on this process: quick-wins + initiatives",
        ],
        outline: [
          "We observe · process workshops (2-3 sessions) + user interviews (3-6 people)",
          "We map · tools, data, friction points analysis",
          "We hand over the plan · 20-30 page report + team workshop",
        ],
        ctaLabel: "Request a Process audit",
      },
    },
    fr: makeFr({
      eyebrow: "Niveau 2 · Process",
      title: "Audit Process · 1 900 € à 3 900 €",
      answer:
        "Audit IA poussé d'un processus complet. Cartographie as-is/to-be, liste chiffrée des tâches automatisables, roadmap IA 6-12 mois sur ce process. Volontairement focalisé pour rester actionnable.",
      priceEur: 1900,
      ctaPrimary: "Demander un audit Process",
    }),
    en: makeEn({
      eyebrow: "Level 2 · Process",
      title: "Process audit · €1,900 to €3,900",
      answer:
        "In-depth AI audit of an end-to-end process. As-is/to-be mapping, costed list of automatable tasks, 6-12 month AI roadmap. Deliberately focused to stay actionable.",
      priceEur: 1900,
      ctaPrimary: "Request a Process audit",
    }),
  },
  // ============================================================
  // NIVEAU 3 — STRATÉGIQUE PME (premium)
  // ============================================================
  {
    slug: "strategique-pme",
    pathFr: "/audit/strategique-pme",
    pathEn: "/audit/strategic-pme",
    accent: "sage",
    summary: {
      fr: {
        benefitTagline:
          "Vision IA globale de votre PME : 2 à 4 process majeurs cartographiés, priorisation impact/effort, roadmap IA 12-24 mois avec budgets.",
        duration: "Adapté à votre périmètre",
        priceFrom: "4 900 € → 9 900 €",
        priceTiers: [
          { size: "PME 20-50 salariés · 2 process majeurs", price: "4 900 €" },
          { size: "PME 50-250 salariés · 3-4 process majeurs", price: "9 900 €" },
        ],
        modality: "Mix sur site + à distance",
        audience: "PME 20-250 salariés",
        scope: "2 à 4 processus majeurs · acquisition, vente, ops, back-office",
        outcomes: [
          "Cartographie IA globale : où l'IA apporte le plus de valeur",
          "Priorisation des cas d'usage (impact / effort / risque)",
          "Roadmap IA 12-24 mois : phases, budgets indicatifs, jalons",
        ],
        outline: [
          "On observe · 1 atelier direction + 3-6 ateliers métiers + entretiens (5-10 personnes)",
          "On cartographie · analyse data + outils + premiers points de conformité",
          "On vous remet le plan · rapport 40-60 pages + restitution CODIR",
        ],
        guarantee: "Garantie de découverte 30 j",
        ctaLabel: "Demander un audit stratégique PME",
      },
      en: {
        benefitTagline:
          "Global AI vision for your SMB: 2 to 4 major processes mapped, impact/effort prioritisation, 12-24 month AI roadmap with budgets.",
        duration: "Tailored to your scope",
        priceFrom: "€4,900 → €9,900",
        priceTiers: [
          { size: "SMB 20-50 staff · 2 major processes", price: "€4,900" },
          { size: "SMB 50-250 staff · 3-4 major processes", price: "€9,900" },
        ],
        modality: "Hybrid on-site + remote",
        audience: "SMB 20-250 staff",
        scope: "2 to 4 major processes · acquisition, sales, ops, back-office",
        outcomes: [
          "Global AI mapping: where AI brings the most value",
          "Use case prioritisation (impact / effort / risk)",
          "12-24 month AI roadmap: phases, indicative budgets, milestones",
        ],
        outline: [
          "We observe · 1 leadership workshop + 3-6 business workshops + interviews (5-10 people)",
          "We map · data + tools analysis + initial compliance pointers",
          "We hand over the plan · 40-60 page report + leadership debrief",
        ],
        guarantee: "30-day discovery guarantee",
        ctaLabel: "Request a Strategic SMB audit",
      },
    },
    fr: makeFr({
      eyebrow: "Niveau 3 · Stratégique PME",
      title: "Audit stratégique PME · 4 900 € à 9 900 €",
      answer:
        "Vision IA globale pour PME 20-250 salariés. Cartographie de 2 à 4 process majeurs, priorisation des cas d'usage, roadmap 12-24 mois avec phases et budgets. Garantie de découverte 30 jours.",
      priceEur: 4900,
      ctaPrimary: "Demander un audit stratégique PME",
    }),
    en: makeEn({
      eyebrow: "Level 3 · Strategic SMB",
      title: "Strategic SMB audit · €4,900 to €9,900",
      answer:
        "Global AI vision for SMBs 20-250 staff. Mapping of 2-4 major processes, use case prioritisation, 12-24 month roadmap with phases and budgets. 30-day discovery guarantee.",
      priceEur: 4900,
      ctaPrimary: "Request a Strategic SMB audit",
    }),
  },
  // ============================================================
  // NIVEAU 4 — STRATÉGIQUE ETI (hero offer multi-sites)
  // ============================================================
  {
    slug: "strategique-eti",
    pathFr: "/audit/strategique-eti",
    pathEn: "/audit/strategic-eti",
    accent: "mocha",
    summary: {
      fr: {
        benefitTagline:
          "Audit stratégique multi-sites pour ETI / groupes : alignement CODIR, cartographie multi-BU, roadmap IA 24 mois, gouvernance et AI Act.",
        duration: "Adapté à votre périmètre",
        priceFrom: "À partir de 12 000 € · sur devis",
        priceTiers: [
          { size: "1-2 BU · 1-2 sites · 3-4 process", price: "À partir de 12 000 €" },
          { size: "Multi-BU · multi-sites · scope élargi", price: "Jusqu'à 29 000 €" },
        ],
        modality: "Sur site multi-sites + ateliers CODIR",
        audience: "ETI, grandes PME, groupes multi-sites",
        scope: "Plusieurs départements · multi-BU · multi-pays possibles",
        outcomes: [
          "Cartographie IA globale multi-BU",
          "Roadmap IA groupe 24 mois : phases, enveloppes, priorisation",
          "Alignement gouvernance IA + premiers jalons AI Act",
        ],
        outline: [
          "On observe · ateliers CODIR/COMEX + ateliers métiers multi-sites",
          "On cartographie · analyse data, outils, risques, gouvernance",
          "On vous remet le plan · rapport 60-90 pages + restitution direction",
        ],
        guarantee: "Devis personnalisé sous 48 h ouvrées",
        ctaLabel: "Demander un audit stratégique ETI",
      },
      en: {
        benefitTagline:
          "Strategic multi-site audit for mid-cap and groups: leadership alignment, multi-BU mapping, 24-month AI roadmap, governance and AI Act.",
        duration: "Tailored to your scope",
        priceFrom: "From €12,000 · on quote",
        priceTiers: [
          { size: "1-2 BU · 1-2 sites · 3-4 processes", price: "From €12,000" },
          { size: "Multi-BU · multi-site · extended scope", price: "Up to €29,000" },
        ],
        modality: "On-site multi-location + leadership workshops",
        audience: "Mid-cap, large SMB, multi-site groups",
        scope: "Multiple departments · multi-BU · multi-country possible",
        outcomes: [
          "Global multi-BU AI mapping",
          "24-month group AI roadmap: phases, budgets, prioritisation",
          "AI governance alignment + initial AI Act milestones",
        ],
        outline: [
          "We observe · leadership workshops + multi-site business workshops",
          "We map · data, tools, risk, governance analysis",
          "We hand over the plan · 60-90 page report + leadership debrief",
        ],
        guarantee: "Personalised quote within 48 business hours",
        ctaLabel: "Request a Strategic mid-cap audit",
      },
    },
    fr: makeFr({
      eyebrow: "Niveau 4 · Stratégique ETI",
      title: "Audit stratégique ETI · à partir de 12 000 €",
      answer:
        "Audit stratégique multi-sites pour ETI, grandes PME et groupes. Cartographie multi-BU, roadmap IA groupe 24 mois, gouvernance et premiers jalons AI Act. Sur devis personnalisé.",
      priceEur: 12000,
      ctaPrimary: "Demander un audit stratégique ETI",
    }),
    en: makeEn({
      eyebrow: "Level 4 · Strategic mid-cap",
      title: "Strategic mid-cap audit · from €12,000",
      answer:
        "Multi-site strategic audit for mid-caps, large SMBs and groups. Multi-BU mapping, 24-month group AI roadmap, governance and initial AI Act milestones. Custom quote.",
      priceEur: 12000,
      ctaPrimary: "Request a Strategic mid-cap audit",
    }),
  },
];

export function getAudit(slug: AuditSlug): AuditContent {
  const found = AUDITS.find((i) => i.slug === slug);
  if (!found) throw new Error(`Unknown audit slug: ${slug}`);
  return found;
}

function makeFr(args: {
  eyebrow: string;
  title: string;
  answer: string;
  priceEur?: number;
  ctaPrimary?: string;
}): PageCopy {
  return {
    eyebrow: args.eyebrow,
    title: args.title,
    answer: args.answer,
    priceEur: args.priceEur,
    ctaPrimary: args.ctaPrimary ?? "Demander cet audit",
    ctaSecondary: "Voir tous les niveaux",
    benefitsTitle: "Ce que vous obtenez",
    benefits: [
      {
        title: "Rapport détaillé",
        description: "Cartographie complète des process audités, remis en main propre.",
      },
      {
        title: "Quick-wins priorisés",
        description: "Liste actionnable triée par gain attendu et complexité.",
      },
      {
        title: "Plan d'action chiffré",
        description: "Roadmap hiérarchisée et chiffrée selon le périmètre audité.",
      },
    ],
    processTitle: "Comment se déroule un audit",
    processSteps: [
      {
        title: "On observe",
        description: "Entretiens équipes, lecture des process en place, accès aux données.",
      },
      {
        title: "On cartographie",
        description: "Repérage des tâches qui prennent du temps ou qui coûtent cher.",
      },
      {
        title: "On priorise",
        description: "Tri par gain attendu, simplicité de mise en œuvre, rapidité.",
      },
      {
        title: "On vous remet le plan",
        description: "Rapport clair + workshop avec votre équipe pour passer à l'action.",
      },
    ],
    metricsTitle: "Ce que l'audit vous apporte",
    metrics: [
      { number: "CA", suffix: "en hausse", label: "Leviers commerciaux IA identifiés" },
      { number: "Heures", suffix: "libérées", label: "Du temps rendu aux équipes" },
      { number: "Pilotage", suffix: "temps réel", label: "Suivi de l'activité au jour le jour" },
    ],
    faqTitle: "Questions fréquentes",
    faqs: [
      {
        id: "remote",
        question: "À distance ou sur site ?",
        answer:
          "Les deux modalités sont disponibles. Le sur site est recommandé dès le niveau Process pour les ateliers métiers.",
      },
      {
        id: "data",
        question: "Quelles données fournir ?",
        answer:
          "Aucune donnée sensible n'est exfiltrée. Tous les entretiens et analyses se font sur place ou en visio sécurisée.",
      },
      {
        id: "deliverable",
        question: "Format du rapport ?",
        answer:
          "PDF + tableau des quick-wins (priorité, gain attendu, complexité). Restitution en visio incluse.",
      },
      {
        id: "next",
        question: "Et après l'audit ?",
        answer:
          "Vous repartez avec un plan d'action exécutable par vos équipes ou par AxionIA (Module 3 · Implémentation).",
      },
    ],
    ctaBlockTitle: "Prête à cartographier vos opportunités IA ?",
    ctaBlockDescription:
      "Demandez votre audit — réponse sous 48 h ouvrées avec devis personnalisé selon votre taille et votre périmètre.",
    metaSeo: {
      title: `${args.title} · Audit AxionIA`,
      description: args.answer.slice(0, 160),
    },
  };
}

function makeEn(args: {
  eyebrow: string;
  title: string;
  answer: string;
  priceEur?: number;
  ctaPrimary?: string;
}): PageCopy {
  return {
    eyebrow: args.eyebrow,
    title: args.title,
    answer: args.answer,
    priceEur: args.priceEur,
    ctaPrimary: args.ctaPrimary ?? "Request this audit",
    ctaSecondary: "See all levels",
    benefitsTitle: "What you get",
    benefits: [
      {
        title: "Detailed report",
        description: "Full mapping of audited processes, handed over personally.",
      },
      {
        title: "Prioritised quick-wins",
        description: "Actionable list sorted by expected gain and complexity.",
      },
      {
        title: "Costed action plan",
        description: "Prioritised, costed roadmap matched to the audited scope.",
      },
    ],
    processTitle: "How an audit runs",
    processSteps: [
      {
        title: "We observe",
        description: "Team interviews, reading your processes, data access.",
      },
      {
        title: "We map",
        description: "Spot tasks that eat time or money.",
      },
      {
        title: "We prioritise",
        description: "Sort by expected gain, ease of implementation, speed.",
      },
      {
        title: "We hand over the plan",
        description: "Clear report + workshop with your team to act.",
      },
    ],
    metricsTitle: "What the audit brings you",
    metrics: [
      { number: "Revenue", suffix: "growth", label: "AI sales levers identified" },
      { number: "Hours", suffix: "freed", label: "Time given back to teams" },
      { number: "Tracking", suffix: "real time", label: "Day-to-day activity monitoring" },
    ],
    faqTitle: "Frequently asked",
    faqs: [
      {
        id: "remote",
        question: "Remote or on site?",
        answer:
          "Both are available. On site is recommended from Process level upward for business workshops.",
      },
      {
        id: "data",
        question: "What data to provide?",
        answer:
          "No sensitive data is exfiltrated. All interviews and analysis happen on-site or in secure video conferencing.",
      },
      {
        id: "deliverable",
        question: "Report format?",
        answer:
          "PDF + table of quick-wins (priority, expected gain, complexity). Remote debrief included.",
      },
      {
        id: "next",
        question: "What happens next?",
        answer:
          "You leave with an action plan executable by your team or by AxionIA (Module 3 · Implementation).",
      },
    ],
    ctaBlockTitle: "Ready to map your AI opportunities?",
    ctaBlockDescription:
      "Request your audit — reply within 48 business hours with a customized quote based on size and scope.",
    metaSeo: {
      title: `${args.title} · AxionIA Audit`,
      description: args.answer.slice(0, 160),
    },
  };
}
