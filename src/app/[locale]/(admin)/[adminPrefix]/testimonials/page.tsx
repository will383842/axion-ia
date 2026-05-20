// Listing témoignages admin (M9 Tier 2 section 2).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listTestimonialsAction } from "@/features/admin-testimonials/actions";
import { TestimonialsV2 } from "./_v2/TestimonialsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function TestimonialsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listTestimonialsAction({
    status: sp.status as never,
    module: sp.module as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <TestimonialsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
}
