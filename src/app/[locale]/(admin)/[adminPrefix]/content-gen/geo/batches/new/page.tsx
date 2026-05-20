/**
 * Content Generator — Geo batch new (§ 15.2 batch builder).
 *
 * V1 = redirige vers /coverage/new avec scope région pré-rempli. Le builder
 * complet (drag&drop ordres, modes 4) arrive V1.5 si Will demande.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { REGIONS } from "@/content/regions";
import { GeoBatchesNewV2 } from "./_v2/GeoBatchesNewV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function NewBatchPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const preselected = sp.region;

  return <GeoBatchesNewV2 adminPrefix={adminPrefix} preselected={preselected} />;
}

