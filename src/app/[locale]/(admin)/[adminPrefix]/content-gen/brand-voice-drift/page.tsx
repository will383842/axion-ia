/**
 * Brand Voice Drift — Page admin (Sprint H 2026-05-22).
 *
 * Affiche :
 * - Statut du run journalier (heure + articles analysés/flaggés)
 * - Statut de l'embedding de référence brand voice
 * - Liste des articles en dérive (30 derniers jours)
 * - Lien vers la recalibration
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BrandVoiceDriftV2 } from "./_v2/BrandVoiceDriftV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function BrandVoiceDriftPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <BrandVoiceDriftV2 adminPrefix={adminPrefix} />;
}
