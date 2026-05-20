// KB-3 — Liste filtrable des entrées Knowledge Base admin (FR cohérent).
//
// Spec : `_AUDIT/KNOWLEDGE-BASE-2026/03-ADMIN-UI.md`.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listEntriesAction } from "@/server/actions/knowledge/list-entries";
import { ConnaissancesV2 } from "./_v2/ConnaissancesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ConnaissancesListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listEntriesAction({
    type: sp.type as never,
    audience: (sp.audience as never) ?? "all",
    status: sp.status as never,
    domain: sp.domain as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <ConnaissancesV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
}
