/**
 * Console Couverture Villes 2100 — Phase B Sprint Perfection 2026-05-22.
 *
 * Affiche la progression de couverture content-gen sur les 2100 villes
 * France ≥ 5000 hab (table `cities`).
 *
 * Distinct de city-coverage (singular) qui suit la qualité des 39 villes pilotes.
 *
 * Route : /fr/<adminPrefix>/content-gen/cities-coverage
 * Convention V2 (AdminPageShell + AdminCard).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CitiesCoverageV2 } from "./_v2/CitiesCoverageV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CitiesCoveragePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const sp = await searchParams;
  const page = sp.page ? parseInt(sp.page, 10) || 1 : 1;
  const deptCode = sp.dept ?? undefined;
  const search = sp.search ?? undefined;
  const isCovered = sp.covered === "oui" ? true : sp.covered === "non" ? false : null;

  return (
    <CitiesCoverageV2
      adminPrefix={adminPrefix}
      page={page}
      {...(deptCode !== undefined ? { deptCode } : {})}
      {...(search !== undefined ? { search } : {})}
      {...(isCovered !== null ? { isCovered } : {})}
    />
  );
}
