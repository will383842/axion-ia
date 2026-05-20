// Listing FAQ admin (M9 Tier 2 section 1).
//
// Filtre category / status / search. Sort par category puis displayOrder.
// V1 : pas de drag-drop reorder (M9 v2). Edit via lien vers /faq/[id].

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listFAQsAction } from "@/features/admin-faq/actions";
import { FaqV2 } from "./_v2/FaqV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function FAQListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listFAQsAction({
    category: sp.category as never,
    status: sp.status as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <FaqV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
}
