/**
 * Content Generator — Geo history (§ 15.5).
 *
 * Journal des batches passés. V1 lit ContentGenJob agrégé par jour.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GeoHistoryV2 } from "./_v2/GeoHistoryV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function GeoHistoryPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <GeoHistoryV2 adminPrefix={adminPrefix} />;
}

