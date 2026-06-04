// Console chatbot — tableau de bord (T-19, ADR-CB-07). Read-only, FR-only.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getChatbotDashboardStats, listEscalations } from "@/features/admin-chatbot/actions";
import { ChatbotDashboardV2 } from "./_v2/ChatbotDashboardV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function ChatbotDashboardPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [stats, escalations] = await Promise.all([
    getChatbotDashboardStats(),
    listEscalations({ statut: "ouverte", page: 1 }),
  ]);

  return (
    <ChatbotDashboardV2
      adminPrefix={adminPrefix}
      stats={stats}
      recentEscalations={escalations.items.slice(0, 10)}
    />
  );
}
