/**
 * Content Generator — Landing variants (§ 12.1).
 *
 * V1 V2 V3 V4 V5 V6 = default + 5 sectoriels (industrie, tertiaire, public,
 * tourisme, retail). Admin peut activer/désactiver chaque variante depuis
 * ContentGenConfig.key="landing_variants_active".
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingVariantsV2 } from "./_v2/LandingVariantsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function LandingVariantsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <LandingVariantsV2 adminPrefix={adminPrefix} />;
}
