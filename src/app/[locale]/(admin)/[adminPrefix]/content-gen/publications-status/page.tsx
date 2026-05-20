/**
 * Content Generator — Dashboard kanban publications (§ 12.1 v1.7).
 *
 * 5 colonnes : Brouillon (draft/queued) / En revue (needs_review) / Approuvé
 * (review.approved pending publish) / Publié / Refusé. Drag&drop arrive V1.5.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PublicationsStatusV2 } from "./_v2/PublicationsStatusV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function PublicationsStatusPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <PublicationsStatusV2 adminPrefix={adminPrefix} />;
}
