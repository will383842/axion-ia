/**
 * Content Generator — Page Couverture villes pilote.
 *
 * Sprint City Quality 6 pilote 2026-05-18.
 * Route : /fr/<adminPrefix>/content-gen/city-coverage
 *
 * Convention V2 only (admin-v2 cookie ou env ADMIN_V2_ENABLED=true).
 * En V1 : message d'invitation à activer V2 (pas de duplication de markup).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CityCoverageV2 } from "./_v2/CityCoverageV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CityCoveragePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <CityCoverageV2 adminPrefix={adminPrefix} />;
}

