/**
 * Content Generator — KB entry detail, dédupliqué (audit UX 2026-08-01, phase 2).
 *
 * Redirect 308 vers /connaissances/[id]/apercu : la vue aperçu lecture seule
 * de « Connaissances » remplace strictement l'ancien détail read-only.
 */

import { permanentRedirect, redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function KbReadonlyDetailPage({ params }: PageProps): Promise<never> {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  permanentRedirect(`/fr/${adminPrefix}/connaissances/${id}/apercu`);
}
