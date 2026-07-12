// Legacy redirect — les candidatures vivent sous Contacts depuis 2026-07-12
// (fusion Recrutement → Contacts, décision Will). Préserve les query params
// (offerId/status/attention/page) pour les bookmarks et liens Telegram déjà émis.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function LegacyApplicationsRedirect({
  params,
  searchParams,
}: PageProps): Promise<never> {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(sp).filter((e): e is [string, string] => e[1] != null),
  ).toString();
  redirect(`/fr/${adminPrefix}/contacts/candidatures${qs ? `?${qs}` : ""}`);
}
