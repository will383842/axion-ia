// SSOT taxonomie /audit — Sprint 14.10.8 (Will 2026-05-12).
//
// Refonte hub /audit (Will 2026-05-12) :
//   /audit               → hub 2 AXES (Par taille / Par situation)
//   /audit/tpe-1-jour         → audit présentiel · 1 journée complète · 1190 € HT (Will 2026-05-31)
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
import { AUDIT_TIERS, formatTierPrice, getTierById } from "./pricing";

// ============================================================================
// Types
// ============================================================================

/** 4 tiers audit canoniques — déjà définis dans pricing.ts. */
export type AuditTier =
  "audit-flash" | "audit-cible" | "audit-strategique-pme" | "audit-strategique-eti";

/** Segment de l'axe « Par taille » — aligné INSEE (cf. pricing.ts audienceSizes). */
export type AuditSizeSegment = "tpe" | "pme" | "eti" | "grande-entreprise";

export type AuditAccent = "terracotta" | "mocha" | "sage" | "primary";

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
    pathFr: "/audit/tpe-1-jour",
    pathEn: "/audit/tpe-1-jour",
    labelFr: "Audit sur place",
    labelEn: "On-site audit",
    taglineFr: `Audit complet de l'entreprise pour TPE, artisan ou commerçant — une journée complète sur place (${formatTierPrice(getTierById(AUDIT_TIERS, "audit-flash"), "fr", { compact: true })} · réservation calendrier).`,
    taglineEn: `Complete company audit for a small business, artisan or retailer — one full day on site (${formatTierPrice(getTierById(AUDIT_TIERS, "audit-flash"), "en", { compact: true })} · calendar booking).`,
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
    taglineFr: `Audit focalisé sur 1 département (marketing, RH, ops, finance, juridique). 3 sous-tiers : Solo / Standard / Avancé (${getTierById(AUDIT_TIERS, "audit-cible").priceMin!} → ${getTierById(AUDIT_TIERS, "audit-cible").subTiers!.at(-1)!.priceFlat!} €).`,
    taglineEn: `Audit focused on 1 department (marketing, HR, ops, finance, legal). 3 sub-tiers: Solo / Standard / Advanced (€${getTierById(AUDIT_TIERS, "audit-cible").priceMin!} → €${getTierById(AUDIT_TIERS, "audit-cible").subTiers!.at(-1)!.priceFlat!}).`,
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

/** Construit le URL de la page demande avec objet pré-rempli. */
export function auditContactPath(tier: AuditTier, locale: Locale): string {
  const base = locale === "fr" ? "/audit/demande" : "/audit/request";
  return `${base}?objet=${encodeURIComponent(tier)}`;
}
