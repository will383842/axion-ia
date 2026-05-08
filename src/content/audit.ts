// Content pack — Module 2 Audit & optimisation (5 pages).
// Refonte 2026-05-07 : pyramide 4 niveaux orientée conversion B2B.
// Sprint 14.10.3 : prix dérivés de `src/content/pricing.ts` (source unique).
//   N1 Flash — produit d'appel (slug `flash`)
//   N2 Ciblé — cœur de marché PME (slug `process`)
//   N3 Stratégique PME — premium PME (slug `strategique-pme`)
//   N4 Stratégique ETI — hero offer multi-sites (slug `strategique-eti`)
//
// Vocabulaire business : on parle de « zones à automatiser », « services à
// étudier », « où l'IA peut s'insérer » — pas de jargon « process / process
// mapping ». Slug technique `process` conservé, mais l'eyebrow et tout le
// contenu visible parlent en langage entreprise.
//
// Pas d'engagement de durée d'audit (pas de "5 jours", "12 mois", etc.).
// Pas de garantie remboursement (décision Will, 2026-05-07).

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
  /** Eyebrow de la section process (au-dessus du processTitle). */
  processEyebrow?: string;
  processSteps: ReadonlyArray<{ title: string; description: string }>;
  metricsTitle: string;
  /** Eyebrow de la section metrics. */
  metricsEyebrow?: string;
  metrics: ReadonlyArray<{ number: string; suffix: string; label: string }>;
  faqTitle: string;
  faqs: ReadonlyArray<{ id: string; question: string; answer: string }>;
  ctaBlockTitle: string;
  ctaBlockDescription: string;
  /** Optional anti-fear "Pour qui ça marche" — 3 maturity levels (D7 parity v3). */
  maturity?: {
    title: string;
    eyebrow: string;
    intro?: string;
    levels: ReadonlyArray<{ rank: 1 | 2 | 3; name: string; description: string }>;
  };
  metaSeo: { title: string; description: string };
}

// Mapping slug audit → tier id pricing.ts. Source unique des tarifs.
// Sprint 14.10.5 : zéro hardcode — tous les prix dérivent de pricing.ts.
import {
  AUDIT_TIERS,
  formatAmount,
  formatAmountRange,
  getTierById,
  type PricingSubTier,
  type PricingTier,
} from "./pricing";

const AUDIT_TIER_BY_SLUG: Record<AuditSlug, string> = {
  flash: "audit-flash",
  process: "audit-cible",
  "strategique-pme": "audit-strategique-pme",
  "strategique-eti": "audit-strategique-eti",
};

function tierForAudit(slug: AuditSlug): PricingTier {
  return getTierById(AUDIT_TIERS, AUDIT_TIER_BY_SLUG[slug]);
}

function priceEurForAudit(slug: AuditSlug): number {
  const tier = tierForAudit(slug);
  return (tier.priceFlat ?? tier.priceMin)!;
}

/**
 * Mappe les `subTiers` d'un audit vers la shape `{ size, price }` attendue
 * par `AuditSummary.priceTiers`. Les libellés rangeFr/En décrivent le sous-tier
 * (ex « À distance · périmètre simple »).
 */
function buildAuditPriceTiers(
  subTiers: ReadonlyArray<PricingSubTier> | undefined,
  locale: "fr" | "en",
): ReadonlyArray<{ size: string; price: string }> {
  if (!subTiers || subTiers.length === 0) return [];
  return subTiers.map((s) => ({
    size: locale === "fr" ? `${s.labelFr} · ${s.rangeFr}` : `${s.labelEn} · ${s.rangeEn}`,
    price: formatAmount(s.priceFlat, locale, { compact: true }),
  }));
}

// Pré-calcul des chaînes prix dérivées de pricing.ts pour les 4 audits.
// Chaque entrée alimente `priceFrom` + `priceTiers` + `metaSeo.title`.
const FLASH_TIER = tierForAudit("flash");
const PROCESS_TIER = tierForAudit("process");
const PME_TIER = tierForAudit("strategique-pme");
const ETI_TIER = tierForAudit("strategique-eti");

const FLASH_PRICE_FROM_FR = `Dès ${formatAmount(FLASH_TIER.priceFlat!, "fr", { compact: true })} (à distance) · ${formatAmount(FLASH_TIER.priceFlatOnsite!, "fr", { compact: true })} (sur site)`;
const FLASH_PRICE_FROM_EN = `From ${formatAmount(FLASH_TIER.priceFlat!, "en", { compact: true })} (remote) · ${formatAmount(FLASH_TIER.priceFlatOnsite!, "en", { compact: true })} (on site)`;

const PROCESS_PRICE_FROM_FR = formatAmountRange(
  PROCESS_TIER.priceMin!,
  PROCESS_TIER.priceMax!,
  "fr",
  { compact: true },
);
const PROCESS_PRICE_FROM_EN = formatAmountRange(
  PROCESS_TIER.priceMin!,
  PROCESS_TIER.priceMax!,
  "en",
  { compact: true },
);

const PME_PRICE_FROM_FR = formatAmountRange(PME_TIER.priceMin!, PME_TIER.priceMax!, "fr", {
  compact: true,
});
const PME_PRICE_FROM_EN = formatAmountRange(PME_TIER.priceMin!, PME_TIER.priceMax!, "en", {
  compact: true,
});

const ETI_PRICE_FROM_FR = `À partir de ${formatAmount(ETI_TIER.priceMin!, "fr", { compact: true })} · sur devis sur mesure`;
const ETI_PRICE_FROM_EN = `From ${formatAmount(ETI_TIER.priceMin!, "en", { compact: true })} · custom quote, no cap`;

// priceTiers ETI : sous-tier base + variante « sur devis » non listée dans
// pricing.ts (par design — config multi-BU est devisée).
const ETI_PRICE_TIERS_FR: ReadonlyArray<{ size: string; price: string }> = [
  ...buildAuditPriceTiers(ETI_TIER.subTiers, "fr"),
  { size: "Multi-BU · multi-sites · scope élargi", price: "Sur devis sur mesure" },
];
const ETI_PRICE_TIERS_EN: ReadonlyArray<{ size: string; price: string }> = [
  ...buildAuditPriceTiers(ETI_TIER.subTiers, "en"),
  { size: "Multi-BU · multi-site · extended scope", price: "Custom quote, no cap" },
];

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
          "Mini-diagnostic ciblé sur 1 zone clé de votre entreprise : 3 à 5 endroits où l'IA peut s'insérer concrètement, gains estimés, plan d'action immédiat.",
        duration: "Adapté à votre périmètre",
        priceFrom: FLASH_PRICE_FROM_FR,
        priceTiers: buildAuditPriceTiers(FLASH_TIER.subTiers, "fr"),
        modality: "À distance ou sur site",
        audience: "TPE & petites PME (0-30 salariés)",
        scope:
          "1 zone à automatiser · ex. relation client, facturation, support, gestion documentaire",
        outcomes: [
          "3 à 5 cas d'usage IA / automatisations identifiés",
          "Estimation des gains (heures libérées, erreurs évitées, dépenses)",
          "Plan d'action concret, prêt à activer",
        ],
        outline: [
          "On observe · pré-questionnaire + visio (ou jour terrain)",
          "On cartographie · zones où l'IA peut s'insérer + analyse offline",
          "On vous remet le plan · note 8-12 pages + visio de restitution",
        ],
        ctaLabel: "Réserver mon diagnostic flash",
      },
      en: {
        benefitTagline:
          "Targeted mini-diagnosis on 1 key area of your company: 3-5 places where AI can concretely fit in, estimated gains, immediate action plan.",
        duration: "Tailored to your scope",
        priceFrom: FLASH_PRICE_FROM_EN,
        priceTiers: buildAuditPriceTiers(FLASH_TIER.subTiers, "en"),
        modality: "Remote or on site",
        audience: "Small businesses (0-30 staff)",
        scope: "1 area to automate · e.g. customer relations, billing, support, document handling",
        outcomes: [
          "3 to 5 AI / automation use cases identified",
          "Gain estimates (hours freed, errors avoided, spending)",
          "Concrete action plan, ready to activate",
        ],
        outline: [
          "We observe · pre-questionnaire + video call (or on-site day)",
          "We map · areas where AI can fit + offline analysis",
          "We hand over the plan · 8-12 page note + debrief call",
        ],
        ctaLabel: "Book my flash diagnosis",
      },
    },
    fr: makeFr({
      eyebrow: "Niveau 1 · Flash",
      title: `Diagnostic flash · ${formatAmount(FLASH_TIER.priceFlat!, "fr", { compact: true })} à distance, ${formatAmount(FLASH_TIER.priceFlatOnsite!, "fr", { compact: true })} sur site`,
      answer:
        "Mini-diagnostic IA ciblé sur une zone clé de votre entreprise. 3 à 5 endroits où l'IA peut s'insérer, estimation des gains, plan d'action immédiat. Idéal pour démarrer.",
      priceEur: priceEurForAudit("flash"),
      ctaPrimary: "Réserver mon diagnostic flash",
    }),
    en: makeEn({
      eyebrow: "Level 1 · Flash",
      title: `Flash diagnosis · ${formatAmount(FLASH_TIER.priceFlat!, "en", { compact: true })} remote, ${formatAmount(FLASH_TIER.priceFlatOnsite!, "en", { compact: true })} on site`,
      answer:
        "Targeted mini AI diagnosis on a key area of your company. 3-5 places where AI can fit, gain estimates, immediate action plan. Ideal to start.",
      priceEur: priceEurForAudit("flash"),
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
          "Audit poussé d'un service complet : on liste tout ce qui peut être automatisé ou optimisé par l'IA, avec gains chiffrés et plan d'action sur 6-12 mois.",
        duration: "Adapté à votre périmètre",
        priceFrom: PROCESS_PRICE_FROM_FR,
        priceTiers: buildAuditPriceTiers(PROCESS_TIER.subTiers, "fr"),
        modality: "À distance ou mix site + visio",
        audience: "TPE matures · PME 10-80 salariés",
        scope: "1 service complet · RH, vente, ops, finance, support — étudié de A à Z",
        outcomes: [
          "Cartographie complète du service (avant / après IA)",
          "Liste chiffrée des tâches automatisables (gain estimé par tâche)",
          "Plan d'action 6-12 mois sur ce service : quick-wins + chantiers",
        ],
        outline: [
          "On observe · ateliers métier + entretiens des utilisateurs (3-6 personnes)",
          "On cartographie · outils, données, tâches répétitives, points de friction",
          "On vous remet le plan · rapport 20-30 pages + workshop équipe",
        ],
        ctaLabel: "Demander un audit ciblé",
      },
      en: {
        benefitTagline:
          "In-depth audit of a full service: we list everything AI can automate or optimise, with costed gains and 6-12 month action plan.",
        duration: "Tailored to your scope",
        priceFrom: PROCESS_PRICE_FROM_EN,
        priceTiers: buildAuditPriceTiers(PROCESS_TIER.subTiers, "en"),
        modality: "Remote or hybrid on-site + remote",
        audience: "Mature small businesses · SMB 10-80 staff",
        scope: "1 complete service · HR, sales, ops, finance, support — studied A to Z",
        outcomes: [
          "Full service mapping (before / after AI)",
          "Costed list of automatable tasks (estimated gain per task)",
          "6-12 month action plan on this service: quick-wins + initiatives",
        ],
        outline: [
          "We observe · business workshops + user interviews (3-6 people)",
          "We map · tools, data, repetitive tasks, friction points",
          "We hand over the plan · 20-30 page report + team workshop",
        ],
        ctaLabel: "Request a targeted audit",
      },
    },
    fr: makeFr({
      eyebrow: "Niveau 2 · Audit ciblé",
      title: `Audit ciblé d'un service · ${formatAmount(PROCESS_TIER.priceMin!, "fr", { compact: true })} à ${formatAmount(PROCESS_TIER.priceMax!, "fr", { compact: true })}`,
      answer:
        "Audit IA poussé d'un service complet de votre entreprise. On liste tout ce qui peut être automatisé ou optimisé, avec gains chiffrés et plan d'action concret. Volontairement focalisé pour rester actionnable.",
      priceEur: priceEurForAudit("process"),
      ctaPrimary: "Demander un audit ciblé",
    }),
    en: makeEn({
      eyebrow: "Level 2 · Targeted audit",
      title: `Targeted audit of a service · ${formatAmount(PROCESS_TIER.priceMin!, "en", { compact: true })} to ${formatAmount(PROCESS_TIER.priceMax!, "en", { compact: true })}`,
      answer:
        "In-depth AI audit of a full service in your company. We list everything that can be automated or optimised, with costed gains and an actionable plan. Deliberately focused.",
      priceEur: priceEurForAudit("process"),
      ctaPrimary: "Request a targeted audit",
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
          "Vision IA globale de votre PME : on identifie partout où l'IA peut s'insérer (vente, RH, ops, support…), priorisation par gain attendu, plan d'action 12-24 mois.",
        duration: "Adapté à votre périmètre",
        priceFrom: PME_PRICE_FROM_FR,
        priceTiers: buildAuditPriceTiers(PME_TIER.subTiers, "fr"),
        modality: "Mix sur site + à distance",
        audience: "PME 20-250 salariés",
        scope: "2 à 4 services majeurs · acquisition, vente, opérations, back-office",
        outcomes: [
          "Cartographie IA globale : où l'IA apporte le plus de valeur dans votre PME",
          "Priorisation des cas d'usage (impact / effort / risque)",
          "Plan d'action 12-24 mois : phases, budgets indicatifs, jalons",
        ],
        outline: [
          "On observe · 1 atelier direction + 3-6 ateliers métiers + entretiens (5-10 personnes)",
          "On cartographie · analyse data + outils + premiers points de conformité",
          "On vous remet le plan · rapport 40-60 pages + restitution CODIR",
        ],
        ctaLabel: "Demander un audit stratégique PME",
      },
      en: {
        benefitTagline:
          "Global AI vision for your SMB: we identify everywhere AI can fit (sales, HR, ops, support…), prioritisation by expected gain, 12-24 month action plan.",
        duration: "Tailored to your scope",
        priceFrom: PME_PRICE_FROM_EN,
        priceTiers: buildAuditPriceTiers(PME_TIER.subTiers, "en"),
        modality: "Hybrid on-site + remote",
        audience: "SMB 20-250 staff",
        scope: "2 to 4 major services · acquisition, sales, ops, back-office",
        outcomes: [
          "Global AI mapping: where AI brings the most value in your SMB",
          "Use case prioritisation (impact / effort / risk)",
          "12-24 month action plan: phases, indicative budgets, milestones",
        ],
        outline: [
          "We observe · 1 leadership workshop + 3-6 business workshops + interviews (5-10 people)",
          "We map · data + tools analysis + initial compliance pointers",
          "We hand over the plan · 40-60 page report + leadership debrief",
        ],
        ctaLabel: "Request a Strategic SMB audit",
      },
    },
    fr: makeFr({
      eyebrow: "Niveau 3 · Stratégique PME",
      title: `Audit stratégique PME · ${formatAmount(PME_TIER.priceMin!, "fr", { compact: true })} à ${formatAmount(PME_TIER.priceMax!, "fr", { compact: true })}`,
      answer:
        "Vision IA globale pour PME 20-250 salariés. Cartographie de 2 à 4 services majeurs, priorisation des cas d'usage, plan d'action 12-24 mois avec phases et budgets.",
      priceEur: priceEurForAudit("strategique-pme"),
      ctaPrimary: "Demander un audit stratégique PME",
    }),
    en: makeEn({
      eyebrow: "Level 3 · Strategic SMB",
      title: `Strategic SMB audit · ${formatAmount(PME_TIER.priceMin!, "en", { compact: true })} to ${formatAmount(PME_TIER.priceMax!, "en", { compact: true })}`,
      answer:
        "Global AI vision for SMBs 20-250 staff. Mapping of 2-4 major services, use case prioritisation, 12-24 month action plan with phases and budgets.",
      priceEur: priceEurForAudit("strategique-pme"),
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
          "Audit stratégique multi-sites pour ETI / groupes : alignement CODIR, cartographie de tous les services et BU où l'IA peut s'insérer, plan d'action 24 mois, gouvernance et AI Act.",
        duration: "Adapté à votre périmètre",
        priceFrom: ETI_PRICE_FROM_FR,
        priceTiers: ETI_PRICE_TIERS_FR,
        modality: "Sur site multi-sites + ateliers CODIR",
        audience: "ETI, grandes PME, groupes multi-sites",
        scope: "Plusieurs services / BU · multi-sites · multi-pays possibles",
        outcomes: [
          "Cartographie IA globale multi-BU : où l'IA peut s'insérer dans le groupe",
          "Plan d'action groupe 24 mois : phases, enveloppes, priorisation",
          "Alignement gouvernance IA + premiers jalons AI Act",
        ],
        outline: [
          "On observe · ateliers CODIR/COMEX + ateliers métiers multi-sites",
          "On cartographie · analyse data, outils, risques, gouvernance",
          "On vous remet le plan · rapport 60-90 pages + restitution direction",
        ],
        ctaLabel: "Demander un audit stratégique ETI",
      },
      en: {
        benefitTagline:
          "Strategic multi-site audit for mid-cap and groups: leadership alignment, mapping of every service and BU where AI can fit, 24-month action plan, governance and AI Act.",
        duration: "Tailored to your scope",
        priceFrom: ETI_PRICE_FROM_EN,
        priceTiers: ETI_PRICE_TIERS_EN,
        modality: "On-site multi-location + leadership workshops",
        audience: "Mid-cap, large SMB, multi-site groups",
        scope: "Multiple services / BUs · multi-site · multi-country possible",
        outcomes: [
          "Global multi-BU AI mapping: where AI can fit across the group",
          "24-month group action plan: phases, budgets, prioritisation",
          "AI governance alignment + initial AI Act milestones",
        ],
        outline: [
          "We observe · leadership workshops + multi-site business workshops",
          "We map · data, tools, risk, governance analysis",
          "We hand over the plan · 60-90 page report + leadership debrief",
        ],
        ctaLabel: "Request a Strategic mid-cap audit",
      },
    },
    fr: makeFr({
      eyebrow: "Niveau 4 · Stratégique ETI",
      title: `Audit stratégique ETI · à partir de ${formatAmount(ETI_TIER.priceMin!, "fr", { compact: true })}`,
      answer:
        "Audit stratégique multi-sites pour ETI, grandes PME et groupes. Cartographie multi-BU, roadmap IA groupe 24 mois, gouvernance et premiers jalons AI Act. Sur devis personnalisé.",
      priceEur: priceEurForAudit("strategique-eti"),
      ctaPrimary: "Demander un audit stratégique ETI",
    }),
    en: makeEn({
      eyebrow: "Level 4 · Strategic mid-cap",
      title: `Strategic mid-cap audit · from ${formatAmount(ETI_TIER.priceMin!, "en", { compact: true })}`,
      answer:
        "Multi-site strategic audit for mid-caps, large SMBs and groups. Multi-BU mapping, 24-month group AI roadmap, governance and initial AI Act milestones. Custom quote.",
      priceEur: priceEurForAudit("strategique-eti"),
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
    ...(args.priceEur !== undefined ? { priceEur: args.priceEur } : {}),
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
    processEyebrow: "Déroulement",
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
    metricsEyebrow: "Bénéfices",
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
    maturity: {
      eyebrow: "Pour qui ça marche",
      title: "Trois niveaux de maturité IA",
      intro:
        "L'audit s'adapte à votre point de départ. Aucun prérequis technique — juste une volonté de structurer.",
      levels: [
        {
          rank: 1,
          name: "Découverte",
          description:
            "Aucun usage IA aujourd'hui. L'audit pose les fondations, identifie les premiers quick-wins et démystifie le sujet pour la direction.",
        },
        {
          rank: 2,
          name: "Expérimentation",
          description:
            "Quelques outils IA isolés (ChatGPT, Copilot…). L'audit cartographie l'existant et accélère la généralisation à toute l'organisation.",
        },
        {
          rank: 3,
          name: "Industrialisation",
          description:
            "IA déjà intégrée dans plusieurs métiers. L'audit identifie les gaps de gouvernance, les leviers d'optimisation et les angles morts.",
        },
      ],
    },
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
    ...(args.priceEur !== undefined ? { priceEur: args.priceEur } : {}),
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
    processEyebrow: "Method",
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
    metricsEyebrow: "Benefits",
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
    maturity: {
      eyebrow: "Who it works for",
      title: "Three AI maturity levels",
      intro:
        "The audit adapts to your starting point. No technical prerequisite — just the will to structure.",
      levels: [
        {
          rank: 1,
          name: "Discovery",
          description:
            "No AI use today. The audit lays the groundwork, identifies first quick-wins and demystifies AI for leadership.",
        },
        {
          rank: 2,
          name: "Experimentation",
          description:
            "A few isolated AI tools (ChatGPT, Copilot…). The audit maps the existing setup and accelerates rollout across the organisation.",
        },
        {
          rank: 3,
          name: "Industrialisation",
          description:
            "AI already embedded in several functions. The audit identifies governance gaps, optimisation levers and blind spots.",
        },
      ],
    },
    metaSeo: {
      title: `${args.title} · AxionIA Audit`,
      description: args.answer.slice(0, 160),
    },
  };
}
