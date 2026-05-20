/**
 * Content Generator — Settings distribution intentions de recherche (§ 26).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSearchIntentDistribution } from "@/server/actions/content-gen/policies";
import { SearchIntentDistributionV2 } from "./_v2/SearchIntentDistributionV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function SearchIntentDistributionPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cfg = await getSearchIntentDistribution();

  return <SearchIntentDistributionV2 cfg={cfg} />;
}
