/**
 * Content Generator — Settings index (§ 12.1 master prompt).
 *
 * Hub vers les 11 sous-pages de configuration. Toutes les valeurs sont
 * persistées en DB (`ContentGenConfig`, `ProviderConfig`, tables dédiées) —
 * aucun fichier TS de config à toucher pour Will.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SettingsIndexV2 } from "./_v2/SettingsIndexV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function SettingsIndexPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <SettingsIndexV2 adminPrefix={adminPrefix} />;
}
