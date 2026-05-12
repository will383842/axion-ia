// SSOT taxonomie /audit — Sprint 14.10.8 (Will 2026-05-12).
//
// Refonte hub /audit (Will 2026-05-12) :
//   /audit               → hub 2 AXES (Par taille / Par situation)
//   /audit/flash         → 2 sous-tiers : distance 490 € / sur site 890 € (calendrier)
//   /audit/cible         → 3 sous-tiers : Solo 1900 / Standard 2900 / Avancé 3900
//   /audit/strategique-pme → 2 sous-tiers : 20-50 / 50-250 salariés
//   /audit/strategique-eti → 1 sous-tier (12k+) extensible
//
// Doctrine : 2 portes d'entrée mutuellement complémentaires pour le visiteur :
//   AXE 1 « Par taille »    → segmentation INSEE (TPE/PME/ETI/grande-entreprise)
//   AXE 2 « Par situation » → segmentation contextuelle (urgence / premier audit /
//                              approfondissement / multi-BU gouvernance)
// Les 2 axes pointent vers les MÊMES 4 pages détail tier. Switch UI au niveau
// du hub uniquement.

import type { Locale } from "@/i18n/routing";
import { AUDIT_TIERS, formatAmount, formatAmountRange, getTierById } from "./pricing";

// ============================================================================
// Types
// ============================================================================

/** 4 tiers audit canoniques — déjà définis dans pricing.ts. */
export type AuditTier =
  | "audit-flash"
  | "audit-cible"
  | "audit-strategique-pme"
  | "audit-strategique-eti";

/** Axe d'entrée du hub /audit. */
export type AuditAxis = "by-size" | "by-situation";

/** Segment de l'axe « Par taille » — aligné INSEE (cf. pricing.ts audienceSizes). */
export type AuditSizeSegment = "tpe" | "pme" | "eti" | "grande-entreprise";

/** Segment de l'axe « Par situation » — angles d'attaque commerciale. */
export type AuditSituationSegment =
  | "urgence"
  | "premier-audit"
  | "approfondissement"
  | "gouvernance";

export type AuditAccent = "terracotta" | "mocha" | "sage" | "primary";

// ============================================================================
// Axe 1 — Par taille (segmentation INSEE)
// ============================================================================

export interface AuditSizeOption {
  id: AuditSizeSegment;
  labelFr: string;
  labelEn: string;
  /** Description du profil cible (1 phrase). */
  taglineFr: string;
  taglineEn: string;
  /** Tier audit ciblé. */
  tier: AuditTier;
  /** Path FR/EN de la page tier. */
  pathFr: string;
  pathEn: string;
  /** Icône Lucide pour la card hub. */
  iconName: "Sparkles" | "Building" | "Building2" | "Network";
  accent: AuditAccent;
  badgeFr: string;
  badgeEn: string;
}

export const AUDIT_BY_SIZE: ReadonlyArray<AuditSizeOption> = [
  {
    id: "tpe",
    labelFr: "TPE · indépendant·e",
    labelEn: "Small business · independent",
    taglineFr:
      "1 à 19 salariés. Budget contenu, besoin clair, décision rapide. Diagnostic flash pour identifier 1 zone d'usage IA prioritaire — en distanciel ou sur site.",
    taglineEn:
      "1 to 19 staff. Tight budget, clear need, quick decision. Flash diagnosis to identify 1 priority AI use case — remote or on site.",
    tier: "audit-flash",
    pathFr: "/audit/flash",
    pathEn: "/audit/flash",
    iconName: "Sparkles",
    accent: "terracotta",
    badgeFr: "Flash · dès 490 € HT",
    badgeEn: "Flash · from €490",
  },
  {
    id: "pme",
    labelFr: "PME · 20 à 250 salariés",
    labelEn: "SME · 20 to 250 staff",
    taglineFr:
      "PME en croissance, plusieurs services concernés. Audit ciblé pour un département précis (1900-3900 €) ou audit stratégique multi-services (4900-9900 €) selon votre ambition.",
    taglineEn:
      "Growing SME, several departments concerned. Targeted audit on one department (€1900-3900) or strategic multi-department audit (€4900-9900) depending on ambition.",
    tier: "audit-strategique-pme",
    pathFr: "/audit/strategique-pme",
    pathEn: "/audit/strategic-pme",
    iconName: "Building",
    accent: "terracotta",
    badgeFr: "Stratégique PME · 4 900 → 9 900 €",
    badgeEn: "Strategic SME · €4,900 → €9,900",
  },
  {
    id: "eti",
    labelFr: "ETI · 250 à 5000 salariés",
    labelEn: "Mid-cap · 250 to 5000 staff",
    taglineFr:
      "ETI multi-sites, multi-BU. Audit transverse + gouvernance IA : cartographie complète, scoring opportunités, plan d'arbitrage, comité IA. Sur devis selon profondeur.",
    taglineEn:
      "Multi-site, multi-BU mid-cap. Transverse audit + AI governance: full mapping, opportunity scoring, arbitration plan, AI committee. On request based on depth.",
    tier: "audit-strategique-eti",
    pathFr: "/audit/strategique-eti",
    pathEn: "/audit/strategic-eti",
    iconName: "Building2",
    accent: "mocha",
    badgeFr: "Stratégique ETI · à partir de 12 000 €",
    badgeEn: "Strategic mid-cap · from €12,000",
  },
  {
    id: "grande-entreprise",
    labelFr: "Grande entreprise · 5000+ salariés",
    labelEn: "Enterprise · 5000+ staff",
    taglineFr:
      "Grand groupe, gouvernance IA multi-BU, conformité RGPD/AI Act. Audit stratégique avec comité de pilotage dédié, livrables board-ready. Devis sur mesure.",
    taglineEn:
      "Large group, multi-BU AI governance, GDPR/AI Act compliance. Strategic audit with dedicated steering committee, board-ready deliverables. Bespoke quote.",
    tier: "audit-strategique-eti",
    pathFr: "/audit/strategique-eti",
    pathEn: "/audit/strategic-eti",
    iconName: "Network",
    accent: "mocha",
    badgeFr: "Stratégique ETI · sur mesure",
    badgeEn: "Strategic enterprise · bespoke",
  },
];

// ============================================================================
// Axe 2 — Par situation (segmentation contextuelle)
// ============================================================================

export interface AuditSituationOption {
  id: AuditSituationSegment;
  labelFr: string;
  labelEn: string;
  taglineFr: string;
  taglineEn: string;
  tier: AuditTier;
  pathFr: string;
  pathEn: string;
  iconName: "Zap" | "Compass" | "Workflow" | "Network";
  accent: AuditAccent;
  badgeFr: string;
  badgeEn: string;
}

export const AUDIT_BY_SITUATION: ReadonlyArray<AuditSituationOption> = [
  {
    id: "urgence",
    labelFr: "Je veux comprendre vite",
    labelEn: "I want to understand fast",
    taglineFr:
      "Vous voulez savoir si l'IA peut vraiment vous aider — sans engagement long. Diagnostic flash en distanciel (490 €) ou journée terrain sur site (890 €). Livrables et recommandations sous 48 h.",
    taglineEn:
      "You want to know if AI can really help — without long commitment. Remote flash diagnosis (€490) or on-site field day (€890). Deliverables and recommendations within 48 h.",
    tier: "audit-flash",
    pathFr: "/audit/flash",
    pathEn: "/audit/flash",
    iconName: "Zap",
    accent: "terracotta",
    badgeFr: "Flash · 48 h · 490 / 890 €",
    badgeEn: "Flash · 48 h · €490 / €890",
  },
  {
    id: "premier-audit",
    labelFr: "Mon premier audit IA",
    labelEn: "My first AI audit",
    taglineFr:
      "Premier vrai audit IA pour un département précis (marketing, RH, ops, finance, juridique…). On cartographie 1 fonction, on scoring les opportunités, on chiffre. Idéal PME / ETI qui débute.",
    taglineEn:
      "First real AI audit for one specific department (marketing, HR, ops, finance, legal…). We map 1 function, score opportunities, quantify. Ideal for first-time SME / mid-cap.",
    tier: "audit-cible",
    pathFr: "/audit/cible",
    pathEn: "/audit/targeted",
    iconName: "Compass",
    accent: "terracotta",
    badgeFr: "Ciblé · 1 département · 1 900 → 3 900 €",
    badgeEn: "Targeted · 1 dept · €1,900 → €3,900",
  },
  {
    id: "approfondissement",
    labelFr: "Approfondir l'IA dans toute l'entreprise",
    labelEn: "Deepen AI across the whole company",
    taglineFr:
      "Vous avez déjà testé l'IA, vous voulez maintenant le grand jeu : audit stratégique multi-services PME (4900-9900 €). Cartographie tous départements, plan d'exécution chiffré, roadmap 12-24 mois.",
    taglineEn:
      "You've tested AI, now you want the full picture: strategic multi-department SME audit (€4900-9900). All-department mapping, quantified execution plan, 12-24 month roadmap.",
    tier: "audit-strategique-pme",
    pathFr: "/audit/strategique-pme",
    pathEn: "/audit/strategic-pme",
    iconName: "Workflow",
    accent: "terracotta",
    badgeFr: "Stratégique PME · 4 900 → 9 900 €",
    badgeEn: "Strategic SME · €4,900 → €9,900",
  },
  {
    id: "gouvernance",
    labelFr: "Gouvernance IA · multi-BU",
    labelEn: "AI governance · multi-BU",
    taglineFr:
      "Grand groupe, plusieurs BU/filiales, enjeux conformité AI Act / RGPD. Audit transverse + comité de pilotage IA, livrables board-ready. Cadrage stratégique sur mesure pour ETI et grandes entreprises.",
    taglineEn:
      "Large group, multiple BUs/subsidiaries, AI Act / GDPR compliance stakes. Transverse audit + AI steering committee, board-ready deliverables. Bespoke strategic framing for mid-cap and enterprise.",
    tier: "audit-strategique-eti",
    pathFr: "/audit/strategique-eti",
    pathEn: "/audit/strategic-eti",
    iconName: "Network",
    accent: "mocha",
    badgeFr: "Stratégique ETI · à partir de 12 000 €",
    badgeEn: "Strategic mid-cap · from €12,000",
  },
];

// ============================================================================
// Tier metadata — utilisé par les pages détail
// ============================================================================

export interface AuditTierMeta {
  id: AuditTier;
  pathFr: string;
  pathEn: string;
  labelFr: string;
  labelEn: string;
  /** Tagline 1 phrase exposée sur le hub /audit. */
  taglineFr: string;
  taglineEn: string;
  /** Audience cible (4 segments INSEE). */
  audienceSizes: ReadonlyArray<AuditSizeSegment>;
  accent: AuditAccent;
  /** Le tier offre-t-il un slot calendrier ? (audit-flash sur site = oui). */
  hasCalendarSlot: boolean;
}

export const AUDIT_TIERS_META: ReadonlyArray<AuditTierMeta> = [
  {
    id: "audit-flash",
    pathFr: "/audit/flash",
    pathEn: "/audit/flash",
    labelFr: "Audit Flash",
    labelEn: "Flash audit",
    taglineFr:
      "Diagnostic rapide pour TPE / indépendant·e — 1 zone d'usage, à distance (490 €) ou sur site (890 € · réservation calendrier).",
    taglineEn:
      "Quick diagnosis for small business / independent — 1 use area, remote (€490) or on site (€890 · calendar booking).",
    audienceSizes: ["tpe"],
    accent: "terracotta",
    hasCalendarSlot: true,
  },
  {
    id: "audit-cible",
    pathFr: "/audit/cible",
    pathEn: "/audit/targeted",
    labelFr: "Audit Ciblé",
    labelEn: "Targeted audit",
    taglineFr:
      "Audit focalisé sur 1 département (marketing, RH, ops, finance, juridique). 3 sous-tiers : Solo / Standard / Avancé (1900 → 3900 €).",
    taglineEn:
      "Audit focused on 1 department (marketing, HR, ops, finance, legal). 3 sub-tiers: Solo / Standard / Advanced (€1900 → €3900).",
    audienceSizes: ["pme"],
    accent: "terracotta",
    hasCalendarSlot: false,
  },
  {
    id: "audit-strategique-pme",
    pathFr: "/audit/strategique-pme",
    pathEn: "/audit/strategic-pme",
    labelFr: "Audit Stratégique PME",
    labelEn: "SME Strategic audit",
    taglineFr:
      "Audit complet multi-départements pour PME ambitieuses (20-250 salariés). Cartographie complète, plan d'exécution, roadmap 12-24 mois.",
    taglineEn:
      "Full multi-department audit for ambitious SMEs (20-250 staff). Complete mapping, execution plan, 12-24 month roadmap.",
    audienceSizes: ["pme"],
    accent: "terracotta",
    hasCalendarSlot: false,
  },
  {
    id: "audit-strategique-eti",
    pathFr: "/audit/strategique-eti",
    pathEn: "/audit/strategic-eti",
    labelFr: "Audit Stratégique ETI",
    labelEn: "Mid-cap Strategic audit",
    taglineFr:
      "Audit transverse + gouvernance IA pour ETI et grandes entreprises. Comité de pilotage, livrables board-ready, conformité AI Act + RGPD.",
    taglineEn:
      "Transverse audit + AI governance for mid-cap and enterprise. Steering committee, board-ready deliverables, AI Act + GDPR compliance.",
    audienceSizes: ["eti", "grande-entreprise"],
    accent: "mocha",
    hasCalendarSlot: false,
  },
];

// ============================================================================
// Helpers
// ============================================================================

export function getAuditTierMeta(id: AuditTier): AuditTierMeta {
  const m = AUDIT_TIERS_META.find((t) => t.id === id);
  if (!m) throw new Error(`[audit-taxonomy] Tier introuvable : "${id}"`);
  return m;
}

/** Renvoie le chemin localisé d'un tier. */
export function auditTierPath(tier: AuditTierMeta, locale: Locale): string {
  return locale === "fr" ? tier.pathFr : tier.pathEn;
}

/** Format prix entrée du tier (depuis pricing.ts). */
export function getTierEntryLabel(id: AuditTier, locale: Locale): string {
  const tier = getTierById(AUDIT_TIERS, id);
  const isFr = locale === "fr";
  if (typeof tier.priceFlat === "number") {
    return isFr
      ? `À partir de ${formatAmount(tier.priceFlat, "fr")}`
      : `From ${formatAmount(tier.priceFlat, "en")}`;
  }
  if (typeof tier.priceMin === "number" && typeof tier.priceMax === "number") {
    return formatAmountRange(tier.priceMin, tier.priceMax, isFr ? "fr" : "en");
  }
  if (typeof tier.priceMin === "number") {
    return isFr
      ? `À partir de ${formatAmount(tier.priceMin, "fr")}`
      : `From ${formatAmount(tier.priceMin, "en")}`;
  }
  return isFr ? "Sur devis" : "On request";
}

/** Construit le URL de la page demande avec objet pré-rempli. */
export function auditContactPath(tier: AuditTier, locale: Locale): string {
  const base = locale === "fr" ? "/audit/demande" : "/audit/request";
  return `${base}?objet=${encodeURIComponent(tier)}`;
}
