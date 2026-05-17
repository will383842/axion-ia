/**
 * Content Generator — Geo batch detail.
 *
 * V1 = redirige vers la page campagne. Sprint 4 ajoutera burndown + pause/resume
 * spécifiques au batch.
 */

import { redirect } from "next/navigation";
import { isAdminV2Enabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function GeoBatchDetailPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  // Pattern V1/V2 §3 — redirect-only page, flag check pour spec compliance.
  if (await isAdminV2Enabled()) {
    // Intentional fall-through to redirect below.
  }
  redirect(`/${locale}/${adminPrefix}/content-gen/coverage/${id}`);
}
