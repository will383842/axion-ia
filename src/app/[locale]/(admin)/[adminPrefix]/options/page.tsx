// Listing options 48h admin (M9 Tier 1 section 2).
//
// Filtre status URL param. Sort par status (pending d'abord) puis expiresAt
// croissant pour mettre les plus urgentes en haut. Affiche countdown 48h.

import { OptionsV2 } from "./_v2/OptionsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function OptionsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;

  return <OptionsV2 adminPrefix={adminPrefix} searchParams={sp} />;
}
