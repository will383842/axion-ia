/**
 * Content Generator — Settings quality loop (§ 27 v1.7).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getQualityLoop } from "@/server/actions/content-gen/policies";
import { QualityLoopV2 } from "./_v2/QualityLoopV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function QualityLoopSettingsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cfg = await getQualityLoop();

  return <QualityLoopV2 cfg={cfg} />;
}
