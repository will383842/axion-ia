/**
 * Redirect 308 (permanent) — MORT→REDIR / B2 (DECISION-IA §5-E, 2026-06-16).
 *
 * L'ancienne page de génération ciblée par ville n'aboutissait pas et exposait
 * une commande CLI. La génération par ville passe désormais par le wizard
 * unique `/campaigns/new`, pré-rempli sur la ville via `?ville=<slug>`.
 *
 * Aucune capacité perdue : le ciblage ville est une étape du wizard.
 */

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; villeSlug: string }>;
}

export default async function GeoVilleGenerateRedirect({ params }: PageProps) {
  const { locale, adminPrefix, villeSlug } = await params;
  permanentRedirect(
    `/${locale}/${adminPrefix}/content-gen/campaigns/new?ville=${encodeURIComponent(villeSlug)}`,
  );
}
