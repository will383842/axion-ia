/**
 * Redirect 308 (permanent) — FUSION (DECISION-IA §5-E, 2026-06-16).
 *
 * `/geo/history` listait les batches passés agrégés par jour à partir de
 * `coverageCampaign` — exactement la même matière que `/coverage` (liste des
 * campagnes de couverture). C'était un doublon. On fusionne vers `/coverage`,
 * source unique de suivi des campagnes.
 *
 * Aucune capacité perdue : l'historique des campagnes vit dans `/coverage`.
 * Redirection 308 conservée pour les liens/bookmarks existants.
 */

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function GeoHistoryPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  permanentRedirect(`/${locale}/${adminPrefix}/content-gen/coverage`);
}
