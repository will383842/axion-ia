// Listing soumissions admin (M9 Tier 1 section 1).
//
// Filtres URL params : ?type=&status=&locale=&search=&dateFrom=&dateTo=&page=
// SubmissionFilters (client) navigate via useRouter.push pour preserver l'URL.

import { SubmissionsV2 } from "./_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function SubmissionsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;

  return <SubmissionsV2 adminPrefix={adminPrefix} searchParams={sp} />;
}
