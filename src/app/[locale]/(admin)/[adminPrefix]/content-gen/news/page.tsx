// Séparation Actualités (2026-07-01) — page « Actualités / News RSS » du pôle
// LANCER. Charge la config policies (SSOT) + un état rapide (sources RSS actives,
// actualités publiées indexables) et délègue le rendu à NewsControlV2.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPolicies } from "@/server/actions/content-gen/policies";
import { NewsControlV2 } from "./_v2/NewsControlV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ saved?: string }>;
}

export default async function NewsControlPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const { saved } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [cfg, rssSourceCount, publishedNewsCount] = await Promise.all([
    getPolicies(),
    prisma.rssSource.count({ where: { enabled: true } }).catch(() => 0),
    prisma.article
      .count({
        where: { status: "published", isNews: true, indexationTier: "tier_1_indexable" },
      })
      .catch(() => 0),
  ]);

  return (
    <NewsControlV2
      cfg={cfg}
      rssSourceCount={rssSourceCount}
      publishedNewsCount={publishedNewsCount}
      adminPrefix={adminPrefix}
      saved={saved === "1"}
    />
  );
}
