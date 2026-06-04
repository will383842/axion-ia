// Console chatbot — conversations (T-19). Liste read-only. FR-only.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listConversations } from "@/features/admin-chatbot/actions";
import { ConversationsV2 } from "./_v2/ConversationsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ChatbotConversationsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listConversations({ page: sp.page ? parseInt(sp.page, 10) : 1 });

  return (
    <ConversationsV2
      adminPrefix={adminPrefix}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
}
