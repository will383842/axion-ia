// Console chatbot — détail d'une conversation (thread). Read-only. FR-only.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getConversationDetail } from "@/features/admin-chatbot/actions";
import { ConversationDetailV2 } from "./_v2/ConversationDetailV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function ChatbotConversationDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const convo = await getConversationDetail(id);
  if (!convo) notFound();

  return <ConversationDetailV2 adminPrefix={adminPrefix} convo={convo} />;
}
