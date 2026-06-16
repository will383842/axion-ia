/**
 * Redirect 308 (permanent) — MORT→REDIR (DECISION-IA §5-E, 2026-06-16).
 *
 * `/monitoring` était un stub placeholder sans contenu propre. La supervision
 * des échecs vit dans `/jobs?status=failed` (filtre dédié). On redirige
 * définitivement, route retirée de la nav mais conservée pour les liens
 * existants (bandeau anomalies du layout, bookmarks).
 *
 * Aucune capacité perdue : tout est dans `/jobs`.
 */

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function MonitoringPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  permanentRedirect(
    `/${locale}/${adminPrefix}/content-gen/jobs?status=failed`,
  );
}
