/**
 * Content Generator — Génération ciblée par ville (§ 12.1).
 *
 * V1 = form simple : variant override + provider override + tags + dry-run.
 * Le worker pick-up le job. Sprint 4 ajoute la mini-campagne en 1 clic.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GeoVilleGenerateV2 } from "./_v2/GeoVilleGenerateV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; villeSlug: string }>;
}

export default async function GeoVilleGeneratePage({ params }: PageProps) {
  const { adminPrefix, villeSlug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <GeoVilleGenerateV2 adminPrefix={adminPrefix} villeSlug={villeSlug} />;
}
