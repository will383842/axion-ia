/**
 * Content Generator — RSS source detail.
 *
 * Sprint v7 post-audit FIX (F2) — migration UI legacy `rss.ts` (ContentGenConfig
 * JSON, keyed by URL) → `rss-sources.ts` (Prisma `rss_sources`, keyed by id).
 * Le segment route `[id]` contient désormais l'id Prisma (cuid), plus un URL
 * encodé. Items récents arrivent Sprint 4 avec table RssItem.
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRssSourceByIdFromDb } from "@/server/actions/content-gen/rss-sources";
import { RssDetailV2 } from "./_v2/RssDetailV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function RssDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const source = await getRssSourceByIdFromDb(id);
  if (!source) notFound();

  return <RssDetailV2 adminPrefix={adminPrefix} source={source} />;
}
