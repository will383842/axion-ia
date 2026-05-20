// Listing cas concrets admin (M9 Tier 2 section 5).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCaseStudiesAction } from "@/features/admin-case-studies/actions";
import { CaseStudiesV2 } from "./_v2/CaseStudiesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

export default async function CaseStudiesListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listCaseStudiesAction({
    status: sp.status as never,
    sector: sp.sector,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <CaseStudiesV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
}

