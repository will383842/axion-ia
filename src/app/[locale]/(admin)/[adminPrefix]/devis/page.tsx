// Liste devis admin (Sprint A — UI admin devis).
//
// Tableau paginé 25/page. Filtres : status (draft/sent/accepted/declined/expired).
// Lien détail [id] pour actions admin.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DevisV2 } from "./_v2/DevisV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function DevisListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <DevisV2 adminPrefix={adminPrefix} searchParams={sp} />;
}
