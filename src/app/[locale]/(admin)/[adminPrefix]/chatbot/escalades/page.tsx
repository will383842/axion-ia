// Console chatbot — escalades (T-19, REQ-034). Liste + résolution. FR-only.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listEscalations } from "@/features/admin-chatbot/actions";
import { EscaladesV2 } from "./_v2/EscaladesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ChatbotEscaladesPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  // Filtre statut : "ouverte" par défaut, "resolue", ou "" (toutes).
  const statut = sp.statut === "resolue" ? "resolue" : sp.statut === "all" ? undefined : "ouverte";
  const result = await listEscalations({
    ...(statut ? { statut } : {}),
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <EscaladesV2
      adminPrefix={adminPrefix}
      currentStatut={sp.statut ?? "ouverte"}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
}
