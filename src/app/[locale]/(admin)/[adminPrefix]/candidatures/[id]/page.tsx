// Legacy redirect — détail candidature déplacé sous Contacts (2026-07-12).
// Couvre les liens de notification Telegram émis avant la fusion.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function LegacyApplicationDetailRedirect({
  params,
}: PageProps): Promise<never> {
  const { adminPrefix, id } = await params;
  redirect(`/fr/${adminPrefix}/contacts/candidatures/${id}`);
}
