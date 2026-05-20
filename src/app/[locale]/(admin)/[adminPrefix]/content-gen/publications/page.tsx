/**
 * Content Generator — Publications history + actions (P0-9/10/11 fix).
 *
 * § 14 master prompt — liste des Articles publiés via content-gen + actions
 * inline (édit, demote tier-1, archive, rollback, delete) via formulaires
 * Server Actions. Fix audit opérationnel 2026-05-14.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PublicationsV2 } from "./_v2/PublicationsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ status?: string; tier?: string }>;
}

export default async function PublicationsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <PublicationsV2 adminPrefix={adminPrefix} searchParams={sp} />;
}
