/**
 * Content Generator — Costs dashboard (§ 12.1).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CostsV2 } from "./_v2/CostsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CostsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <CostsV2 />;
}
