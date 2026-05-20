/**
 * Content Generator — Similarity monitor (§ 25.5 couche C v1.7).
 *
 * V1 = squelette. Table `SimilarityPair` + worker cron quotidien arrivent
 * Sprint 4. Pour V1 on affiche un placeholder + lien vers le settings.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SimilarityMonitorV2 } from "./_v2/SimilarityMonitorV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function SimilarityMonitorPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <SimilarityMonitorV2 />;
}

