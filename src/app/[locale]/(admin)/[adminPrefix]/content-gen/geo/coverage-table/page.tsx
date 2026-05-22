/**
 * Content Generator - Coverage table ville x secteur x etat (P1-5 Sprint P5).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CoverageCrossTableV2 } from "./_v2/CoverageCrossTableV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{
    status?: string;
    ville?: string;
    page?: string;
    sort?: string;
    dir?: string;
  }>;
}

export default async function CoverageCrossTablePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const sp = await searchParams;

  return <CoverageCrossTableV2 adminPrefix={adminPrefix} searchParams={sp} />;
}
