/**
 * Redirect 308 (FUSION) — DECISION-IA §5-E, 2026-06-16.
 *
 * `/orchestrator` (vue globale KPIs/cadence) faisait doublon avec le tableau
 * de bord `/content-gen`, qui absorbe désormais ses KPIs. Redirection 308
 * conservée 6 mois pour les bookmarks.
 *
 * ⚠️ Seule la racine `/orchestrator` est fusionnée. La sous-route
 * `/orchestrator/adhoc` (« Générer une seule page ») reste INTACTE.
 *
 * Aucune capacité perdue : les KPIs vivent dans `/content-gen`.
 */

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function OrchestratorRedirect({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  permanentRedirect(`/${locale}/${adminPrefix}/content-gen`);
}
