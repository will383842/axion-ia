/**
 * Content Generator — RSS source detail.
 *
 * V1 minimal : trouve par URL (segment route = url encodé). Items récents
 * arrivent Sprint 4 avec table RssItem.
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { listRssSources } from "@/server/actions/content-gen/rss";
import { RssDetailV2 } from "./_v2/RssDetailV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function RssDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const url = decodeURIComponent(id);
  const sources = await listRssSources();
  const source = sources.find((s) => s.url === url);
  if (!source) notFound();

  return <RssDetailV2 adminPrefix={adminPrefix} source={source} />;
}
