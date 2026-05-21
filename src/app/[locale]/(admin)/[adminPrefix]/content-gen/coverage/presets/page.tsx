/**
 * Content Generator — Campaign presets (P1-2 Sprint P5).
 * Liste les 6 presets CampaignTemplate seedés + link vers wizard avec ?preset=<slug>.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CampaignPresetsV2 } from "./_v2/CampaignPresetsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CampaignPresetsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <CampaignPresetsV2 adminPrefix={adminPrefix} />;
}
