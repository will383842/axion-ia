// Listing settings admin (M9 Tier 3 section 2).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listSettingsAction } from "@/features/admin-settings/actions";
import { SettingsListV2 } from "./_v2/SettingsListV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function SettingsListPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const settings = await listSettingsAction();

  return <SettingsListV2 adminPrefix={adminPrefix} settings={settings} />;
}
