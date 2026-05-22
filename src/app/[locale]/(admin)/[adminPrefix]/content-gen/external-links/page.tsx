/**
 * External Links Database — Page admin (Sprint 2026-05-22).
 *
 * Affiche :
 * - Stats globales du catalogue (par autorité, catégorie, scope, status)
 * - Stats dernier run monitor (broken %)
 * - Top 10 liens les plus cités (rotation distribution)
 * - Liste paginée avec filtres (catégorie, autorité, scope, status, search, problèmes)
 * - Bouton "Lancer une vérification HEAD" (enqueue job worker)
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ExternalLinksV2 } from "./_v2/ExternalLinksV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ExternalLinksPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const filters: {
    category?: string;
    scope?: string;
    status?: string;
    search?: string;
    onlyProblems?: boolean;
    offset?: number;
  } = {
    onlyProblems: sp.onlyProblems === "1",
    offset: typeof sp.offset === "string" ? parseInt(sp.offset, 10) || 0 : 0,
  };
  if (typeof sp.category === "string") filters.category = sp.category;
  if (typeof sp.scope === "string") filters.scope = sp.scope;
  if (typeof sp.status === "string") filters.status = sp.status;
  if (typeof sp.search === "string") filters.search = sp.search;

  return <ExternalLinksV2 adminPrefix={adminPrefix} filters={filters} />;
}
