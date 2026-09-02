/**
 * Content Generator — KB entry detail, dédupliqué (audit UX 2026-08-01, phase 2).
 *
 * Redirect 308 vers /connaissances/[id]/apercu : la vue aperçu lecture seule
 * de « Connaissances » remplace strictement l'ancien détail read-only.
 */

import { notFound, permanentRedirect, redirect } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function KbReadonlyDetailPage({ params }: PageProps): Promise<never> {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  // Ne pas rediriger un identifiant mal formé vers une page qui plantera.
  if (!isUuid(id)) notFound();

  permanentRedirect(`/fr/${adminPrefix}/connaissances/${id}/apercu`);
}
