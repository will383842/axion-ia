/**
 * Content Generator — Settings policies (§ 12.5).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPolicies } from "@/server/actions/content-gen/policies";
import { PoliciesV2 } from "./_v2/PoliciesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function PoliciesSettingsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cfg = await getPolicies();

  return <PoliciesV2 cfg={cfg} />;
}
