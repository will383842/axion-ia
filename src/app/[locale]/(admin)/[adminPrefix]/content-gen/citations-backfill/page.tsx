/**
 * Backfill des citations structurées — page admin.
 *
 * Bouton qui remplit le bloc public « Sources & méthodologie » sur les articles
 * publiés AVANT le writer du publish-worker (PR 134, qui le fait désormais à chaque
 * nouvelle publication). Tourne dans le conteneur app → accès DB direct, aucune
 * exposition réseau. Idempotent, relançable par lots.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { CitationsBackfill } from "./_v2/CitationsBackfill";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CitationsBackfillPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Backfill citations (Sources)"
        description="Remplit le bloc « Sources & méthodologie » sur les anciens articles publiés. Seuls les liens du catalogue vérifié sont retenus — aucune source inventée. Idempotent : relançable par lots jusqu'à 0 restant."
      />
      <CitationsBackfill />
    </AdminPageShell>
  );
}
