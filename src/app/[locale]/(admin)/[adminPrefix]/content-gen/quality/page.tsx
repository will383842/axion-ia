/**
 * Content Generator — Quality dashboard (Sprint 12.5 V2).
 *
 * Affiche 5 scores moyens (seoScore, qualityScore, readabilityScore,
 * factCheckScore, editorialScore) sur 30 jours glissants par jour.
 *
 * Bars CSS inline pour rester ZERO dep graphes lourds (Recharts/Chart.js
 * ajouteraient ~80 KB gz au bundle admin sans gain critique V1).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { QualityV2 } from "./_v2/QualityV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function QualityDashboardPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <QualityV2 />;
}
