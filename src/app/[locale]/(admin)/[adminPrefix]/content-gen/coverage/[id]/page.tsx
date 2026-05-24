/**
 * Content Generator — Coverage campaign detail (§ 25).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  cancelCampaign,
  getCampaign,
  incrementCampaignTarget,
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
} from "@/server/actions/content-gen/coverage";
import { CoverageDetailV2 } from "./_v2/CoverageDetailV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  return <CoverageDetailV2 campaign={campaign} adminPrefix={adminPrefix} />;
}

