// Content pack — Module 2 Audit & optimisation (5 pages).
// Orange #ff6b00 accent. Source: docs 05 + 21.
// Sprint 6 ships placeholders aligned to the doctrine; refined Sprint 9.

export type AuditSlug = "complet" | "departement" | "point-de-vente" | "cabinet";

interface AuditContent {
  slug: AuditSlug;
  pathFr: string;
  pathEn: string;
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
  {
    slug: "complet",
    pathFr: "/audit/complet",
    pathEn: "/audit/full",
    fr: makeFr({
      eyebrow: "Audit complet entreprise",
      title: "Cartographier tous vos usages IA en 5 jours",
      answer:
        "Un audit IA exhaustif sur toute votre entreprise : cartographie des flux, identification de 15 à 30 quick-wins, plan d'implémentation chiffré 12 mois. Rapport livré sous 5 jours ouvrés. À distance ou sur site.",
    }),
    en: makeEn({
      eyebrow: "Full company audit",
      title: "Map every AI use case in 5 days",
      answer:
        "An exhaustive AI audit across your company: flow mapping, 15-30 quick-win identification, costed 12-month implementation plan. Report delivered within 5 business days. Remote or on site.",
    }),
  },
  {
    slug: "departement",
    pathFr: "/audit/departement",
    pathEn: "/audit/department",
    fr: makeFr({
      eyebrow: "Audit par département",
      title: "Optimiser un département cible",
      answer:
        "Audit IA focalisé sur un département (RH, finance, vente, opérations). Cartographie des process, 8 à 15 quick-wins prioritaires, plan d'implémentation 6 mois centré sur le ROI départemental.",
    }),
    en: makeEn({
      eyebrow: "Department audit",
      title: "Optimize a target department",
      answer:
        "AI audit focused on a single department (HR, finance, sales, operations). Process mapping, 8-15 prioritized quick-wins, 6-month implementation plan centered on departmental ROI.",
    }),
  },
  {
    slug: "point-de-vente",
    pathFr: "/audit/point-de-vente",
    pathEn: "/audit/storefront",
    fr: makeFr({
      eyebrow: "Audit point de vente",
      title: "IA pour commerces et points de vente",
      answer:
        "Audit IA dédié aux points de vente physiques (commerce, restauration, services) : encaissement, fidélisation, prévisions, gestion stocks. 5 à 10 quick-wins immédiats, plan ROI 6 mois.",
    }),
    en: makeEn({
      eyebrow: "Storefront audit",
      title: "AI for retail & storefront businesses",
      answer:
        "AI audit dedicated to physical points of sale (retail, hospitality, services): checkout, loyalty, forecasting, inventory. 5-10 immediate quick-wins, 6-month ROI plan.",
    }),
  },
  {
    slug: "cabinet",
    pathFr: "/audit/cabinet",
    pathEn: "/audit/firm",
    fr: makeFr({
      eyebrow: "Audit cabinet ou agence",
      title: "Optimiser cabinets, études, agences",
      answer:
        "Audit IA pour cabinets d'experts, études notariales, cabinets juridiques, agences de conseil. Automatisation documentaire, recherche assistée, productivité collaborateurs. Plan 6 mois.",
    }),
    en: makeEn({
      eyebrow: "Firm or agency audit",
      title: "Optimize professional firms & agencies",
      answer:
        "AI audit for expert firms, law firms, notary offices, consultancies. Document automation, assisted research, employee productivity. 6-month plan.",
    }),
  },
];

export function getAudit(slug: AuditSlug): AuditContent {
  const found = AUDITS.find((i) => i.slug === slug);
  if (!found) throw new Error(`Unknown audit slug: ${slug}`);
  return found;
}

function makeFr(args: { eyebrow: string; title: string; answer: string }): PageCopy {
  return {
    eyebrow: args.eyebrow,
    title: args.title,
    answer: args.answer,
    ctaPrimary: "Demander cet audit",
    ctaSecondary: "Voir l'Essentielle 490 €",
    benefitsTitle: "Ce que vous obtenez",
    benefits: [
      {
        title: "Rapport détaillé",
        description: "Cartographie complète des process audités, livré sous 5 jours ouvrés.",
      },
      {
        title: "Quick-wins priorisés",
        description: "Liste actionnable triée par ROI estimé et complexité.",
      },
      {
        title: "Plan d'implémentation",
        description: "Roadmap chiffrée 6-12 mois selon le périmètre audité.",
      },
    ],
    processTitle: "Comment se déroule un audit",
    processSteps: [
      {
        title: "Brief 60 min",
        description: "Cadrage du périmètre, accès données, contacts internes.",
      },
      { title: "Collecte 2-3 j", description: "Entretiens, analyse des flux, mesure des temps." },
      { title: "Analyse 1-2 j", description: "Modélisation des gains, scoring des opportunités." },
      { title: "Restitution", description: "Rapport + workshop 90 min avec votre équipe." },
    ],
    metricsTitle: "Résultats observés",
    metrics: [
      { number: "20+", suffix: "", label: "Quick-wins identifiés en moyenne" },
      { number: "12", suffix: "mois", label: "Horizon plan d'implémentation" },
      { number: "5", suffix: "j", label: "Délai rapport audit complet" },
    ],
    faqTitle: "Questions fréquentes",
    faqs: [
      {
        id: "remote",
        question: "À distance ou sur site ?",
        answer:
          "Les deux modalités sont disponibles, avec tarif différencié. Le sur-site est recommandé pour l'audit complet.",
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
          "PDF + tableau Excel des quick-wins (priorité, ROI estimé, complexité). Restitution 90 min en visio incluse.",
      },
    ],
    ctaBlockTitle: "Prête à cartographier vos opportunités IA ?",
    ctaBlockDescription:
      "Demandez un audit — réponse sous 48 h ouvrées avec devis personnalisé selon votre taille et modalité.",
    metaSeo: {
      title: `${args.title} · Audit AxionIA`,
      description: args.answer.slice(0, 160),
    },
  };
}

function makeEn(args: { eyebrow: string; title: string; answer: string }): PageCopy {
  return {
    eyebrow: args.eyebrow,
    title: args.title,
    answer: args.answer,
    ctaPrimary: "Request this audit",
    ctaSecondary: "See the Essential €490",
    benefitsTitle: "What you get",
    benefits: [
      {
        title: "Detailed report",
        description: "Full mapping of audited processes, delivered within 5 business days.",
      },
      {
        title: "Prioritized quick-wins",
        description: "Actionable list sorted by estimated ROI and complexity.",
      },
      {
        title: "Implementation plan",
        description: "Costed 6-12 month roadmap based on the audited scope.",
      },
    ],
    processTitle: "How an audit runs",
    processSteps: [
      { title: "60-min brief", description: "Scope framing, data access, internal contacts." },
      { title: "Collection 2-3d", description: "Interviews, flow analysis, time measurement." },
      { title: "Analysis 1-2d", description: "Gain modeling, opportunity scoring." },
      { title: "Debrief", description: "Report + 90-min workshop with your team." },
    ],
    metricsTitle: "Observed results",
    metrics: [
      { number: "20+", suffix: "", label: "Avg quick-wins identified" },
      { number: "12", suffix: "mo", label: "Plan horizon" },
      { number: "5", suffix: "d", label: "Full-audit report delay" },
    ],
    faqTitle: "Frequently asked",
    faqs: [
      {
        id: "remote",
        question: "Remote or on site?",
        answer:
          "Both are available with differentiated pricing. On-site is recommended for the full audit.",
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
          "PDF + Excel table of quick-wins (priority, estimated ROI, complexity). 90-min remote debrief included.",
      },
    ],
    ctaBlockTitle: "Ready to map your AI opportunities?",
    ctaBlockDescription:
      "Request an audit — reply within 48 business hours with a customized quote based on size and modality.",
    metaSeo: {
      title: `${args.title} · AxionIA Audit`,
      description: args.answer.slice(0, 160),
    },
  };
}
