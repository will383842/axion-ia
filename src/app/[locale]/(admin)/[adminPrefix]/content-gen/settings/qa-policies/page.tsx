/**
 * Content Generator — Settings Q/R post-process (§ 29 v1.7).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getQaPolicies } from "@/server/actions/content-gen/policies";
import { QaPoliciesV2 } from "./_v2/QaPoliciesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function QaPoliciesPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cfg = await getQaPolicies();

  return <QaPoliciesV2 cfg={cfg} />;
}
