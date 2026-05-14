/**
 * Seed CoverageDistributionProfile — 3 profils campagnes (§ 25 v1.7 + auto-pilot.md).
 *
 * Distribution % par ContentType — somme = 100 (validé Zod côté admin).
 *
 * "Mixte équilibré 2026" est isDefault=true.
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
      distribution: {
        blog_from_title: 35,
        blog_from_keywords: 30,
        comparison: 15,
        faq_standalone: 15,
        guide_pilier: 5,
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
