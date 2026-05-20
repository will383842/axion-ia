/**
 * Content Generator — Templates list (§ 12.1).
 *
 * Affiche tous les ContentTemplate (9 ContentType × N variantes). Filtre par
 * contentType + isActive. Toggle on/off inline.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TemplatesListV2 } from "./_v2/TemplatesListV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function TemplatesListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <TemplatesListV2 adminPrefix={adminPrefix} searchParams={sp} />;
}
