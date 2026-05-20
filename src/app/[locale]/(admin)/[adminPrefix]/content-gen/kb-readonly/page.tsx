/**
 * Content Generator — KB read-only view (§ 11).
 *
 * VIEW-ONLY STRICT. La KB est gérée via le skill `axionia-connaissances` /
 * `/connaissances/`. Ici on liste juste les entrées avec leurs métadonnées
 * pour vérifier la santé KB avant lancement campagne.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { KbReadonlyV2 } from "./_v2/KbReadonlyV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function KbReadonlyPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <KbReadonlyV2 adminPrefix={adminPrefix} />;
}
