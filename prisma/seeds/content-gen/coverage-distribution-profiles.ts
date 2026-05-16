/**
 * Seed CoverageDistributionProfile — profils campagnes (§ 25 v1.7 + § 25.3 secteur 2026-05-16).
 *
 * Distribution % par ContentType — somme = 100 (validé Zod côté admin).
 * `landing_ville` et `blog_from_rss` exclus : pipelines indépendants.
 *
 * 3 profils génériques (sans secteur) + 3 profils sectoriels (1 par secteur cabinet).
 * `mix-premium-2026` reste isDefault=true (fallback historique).
 */

import type { PrismaClient } from "../../generated/client";

export async function seedCoverageDistributionProfiles(prisma: PrismaClient): Promise<number> {
  const rows = [
    {
      slug: "mix-premium-2026",
      name: "Mix premium 2026",
      description:
        "Distribution équilibrée pour conquête territoriale standard (blog_from_title + keywords + comparison dominants).",
      isDefault: true,
      serviceSector: null,
      distribution: {
        blog_from_title: 30,
        blog_from_keywords: 25,
        comparison: 20,
        faq_standalone: 15,
        guide_pilier: 10,
      },
    },
    {
      slug: "mix-industrie",
      name: "Mix industrie",
      description:
        "Distribution orientée secteurs industriels (poids comparison + guide_pilier renforcé pour cas concrets B2B).",
      isDefault: false,
      serviceSector: null,
      distribution: {
        blog_from_title: 25,
        blog_from_keywords: 20,
        comparison: 30,
        faq_standalone: 10,
        guide_pilier: 15,
      },
    },
    {
      slug: "mix-tertiaire",
      name: "Mix tertiaire",
      description:
        "Distribution orientée services et tertiaire urbain (poids FAQ + blog_from_keywords renforcé pour intent commercial).",
      isDefault: false,
      serviceSector: null,
      distribution: {
        blog_from_title: 35,
        blog_from_keywords: 30,
        comparison: 15,
        faq_standalone: 15,
        guide_pilier: 5,
      },
    },
    // ─────────────────────────────────────────────────────────────
    // Profils sectoriels (§ 25.3 — 1 par pilier cabinet Axion-IA)
    // ─────────────────────────────────────────────────────────────
    {
      slug: "secteur-interventions-formations",
      name: "Secteur · Interventions & Formations",
      description:
        "Mix dédié aux interventions opérationnelles + montée en compétence équipe. Poids blog_article + qa_derived dominants (cas concrets terrain + Q/R format AEO).",
      isDefault: false,
      serviceSector: "interventions_formations" as const,
      distribution: {
        blog_article: 35,
        qa_derived: 20,
        blog_from_keywords: 15,
        guide_pilier: 15,
        faq_standalone: 10,
        blog_from_title: 5,
      },
    },
    {
      slug: "secteur-audits",
      name: "Secteur · Audits",
      description:
        "Mix dédié aux diagnostics (flash/essentiel/approfondi). Poids comparison + guide_pilier dominants (méthodologie comparative + cadrage référence).",
      isDefault: false,
      serviceSector: "audits" as const,
      distribution: {
        comparison: 30,
        guide_pilier: 25,
        qa_derived: 15,
        blog_article: 15,
        faq_standalone: 10,
        blog_from_keywords: 5,
      },
    },
    {
      slug: "secteur-implementations",
      name: "Secteur · Implementations",
      description:
        "Mix dédié aux projets IA custom + intégrations. Poids guide_pilier + blog_article dominants (long-form technique + retours d'implémentation).",
      isDefault: false,
      serviceSector: "implementations" as const,
      distribution: {
        guide_pilier: 30,
        blog_article: 25,
        comparison: 15,
        blog_from_keywords: 15,
        qa_derived: 10,
        faq_standalone: 5,
      },
    },
  ];

  let count = 0;
  for (const r of rows) {
    await prisma.coverageDistributionProfile.upsert({
      where: { slug: r.slug },
      create: r,
      update: r, // SSOT côté seed — écrasement autorisé (distribution stable doctrine)
    });
    count++;
  }
  return count;
}
