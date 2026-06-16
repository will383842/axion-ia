/**
 * Redirect 308 (permanent) — MORT→REDIR (DECISION-IA §5-E, 2026-06-16).
 *
 * Ancien builder de lot géo (stub trompeur, ne lançait rien). La création
 * d'une campagne — y compris géographique — passe désormais par le wizard
 * unique `/campaigns/new` (point d'entrée unique de lancement).
 *
 * Aucune capacité perdue : le ciblage villes/régions est une étape du wizard.
 */

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function GeoBatchesNewRedirect({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  permanentRedirect(`/${locale}/${adminPrefix}/content-gen/campaigns/new`);
}
