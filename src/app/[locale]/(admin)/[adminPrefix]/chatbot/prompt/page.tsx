// Console chatbot — prompt système versionné + rollback (T-20). FR-only.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDefaultTenant } from "@/server/chatbot/tenant";
import { getActivePromptContent } from "@/server/chatbot/generation/prompt-version";
import { listChatbotPromptVersions } from "@/features/admin-chatbot/actions";
import { PromptV2 } from "./_v2/PromptV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function ChatbotPromptPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const tenant = await getDefaultTenant();
  if (!tenant) {
    return (
      <PromptV2 adminPrefix={adminPrefix} tenantId={null} versions={[]} activeContent={null} />
    );
  }
  const [versions, activeContent] = await Promise.all([
    listChatbotPromptVersions(tenant.id),
    getActivePromptContent(tenant.id),
  ]);

  return (
    <PromptV2
      adminPrefix={adminPrefix}
      tenantId={tenant.id}
      versions={versions}
      activeContent={activeContent}
    />
  );
}
