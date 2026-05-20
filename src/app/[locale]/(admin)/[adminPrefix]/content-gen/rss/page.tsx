/**
 * Content Generator — RSS sources list (§ 28 v1.7).
 *
 * V1 (Sprint 3) = squelette. Les modèles `RssSource` + `RssItem` arrivent
 * Sprint 4 (pipeline 2 actualités). Pour l'instant on lit `ContentGenConfig`
 * key="rss_sources" comme stockage temporaire.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RssListV2 } from "./_v2/RssListV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function RssListPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <RssListV2 adminPrefix={adminPrefix} />;
}
