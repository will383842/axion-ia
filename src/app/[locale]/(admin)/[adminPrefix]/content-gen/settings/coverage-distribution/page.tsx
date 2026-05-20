/**
 * Content Generator — Settings distribution couverture (§ 25.2 v1.7).
 *
 * CRUD profils nommés CoverageDistributionProfile. Édition JSON brut V1
 * (validation Zod somme = 100 % côté Server Action). UI sliders peut être
 * ajoutée V2 si Will demande.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listDistributionProfiles } from "@/server/actions/content-gen/distribution";
import { CoverageDistributionV2 } from "./_v2/CoverageDistributionV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CoverageDistributionPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const rows = await listDistributionProfiles();

  return <CoverageDistributionV2 rows={rows} />;
}
