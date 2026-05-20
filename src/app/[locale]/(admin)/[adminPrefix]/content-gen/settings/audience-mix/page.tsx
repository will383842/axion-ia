/**
 * Content Generator — Settings audience mix (§ 25.2 v1.7).
 *
 * CRUD profils AudienceMixProfile. Matrice taille INSEE × OrganisationType.
 * Édition JSON brut V1 (validation somme = 100 % serveur).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAudienceMixProfiles } from "@/server/actions/content-gen/distribution";
import { AudienceMixV2 } from "./_v2/AudienceMixV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function AudienceMixPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const rows = await listAudienceMixProfiles();

  return <AudienceMixV2 rows={rows} />;
}
