/**
 * Content Generator — Monitoring redirect (P0-10 Sprint correctif admin).
 *
 * Le lien "Voir monitoring →" dans le bandeau anomalies du layout pointe sur
 * cette route. V1 = redirect immédiat vers /jobs?status=failed pour afficher
 * les jobs en échec. Une vraie page monitoring dédiée sera Sprint dédié.
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function MonitoringPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  redirect(`/${locale}/${adminPrefix}/content-gen/jobs?status=failed`);
}
