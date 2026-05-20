/**
 * Content Generator — Geo batches list (§ 15.3).
 *
 * V1 = campagnes type `scope=region` ou `scope=departement` filtrées.
 * Une table batch dédiée arrive Sprint 4 si volume justifie.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GeoBatchesV2 } from "./_v2/GeoBatchesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function GeoBatchesPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <GeoBatchesV2 adminPrefix={adminPrefix} />;
}
