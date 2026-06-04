// Console chatbot — réglages du tenant (lecture seule, T-21). FR-only.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getChatbotSettings } from "@/features/admin-chatbot/actions";
import { ReglagesV2 } from "./_v2/ReglagesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function ChatbotReglagesPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const data = await getChatbotSettings();
  return <ReglagesV2 data={data} />;
}
