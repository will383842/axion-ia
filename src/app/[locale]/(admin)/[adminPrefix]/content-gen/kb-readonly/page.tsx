/**
 * Content Generator — KB read-only, dédupliquée (audit UX 2026-08-01, phase 2).
 *
 * Redirect 308 vers /connaissances?status=published : cette vue listait les
 * mêmes KnowledgeEntry que « Connaissances » (Contenu), en moins bien (25
 * dernières sans pagination, sans titres FR, sans filtres). La cible filtrée
 * sur « published » reproduit exactement l'ancien périmètre. Même idiome que
 * content-gen/orchestrator/page.tsx (fusion 308 documentée).
 */

import { permanentRedirect, redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function KbReadonlyPage({ params }: PageProps): Promise<never> {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  permanentRedirect(`/fr/${adminPrefix}/connaissances?status=published`);
}
