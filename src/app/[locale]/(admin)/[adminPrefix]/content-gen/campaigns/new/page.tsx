/**
 * Wizard /content-gen/campaigns/new — Sprint v7 Phase 3 commit 1 (2026-05-23).
 *
 * Wizard 4 steps pour créer une CoverageCampaign :
 *   Step 1 : Verticale (5 services Axion-IA)
 *   Step 2 : Nom + volume + scope villes + période
 *   Step 3 : Mix contenu (9 sliders ContentType actuels, 19 Phase 8)
 *   Step 4 : Récap + Brouillon / Lancer
 *
 * Route : /fr/<adminPrefix>/content-gen/campaigns/new
 * Convention V2 (AdminPageShell).
 */

import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { CampaignWizardV2 } from "./_v2/CampaignWizardV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CampaignNewPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <CampaignWizardV2 adminPrefix={adminPrefix} />;
}
