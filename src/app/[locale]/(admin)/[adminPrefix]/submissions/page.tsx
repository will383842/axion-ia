// Submissions admin — page legacy, redirige vers /contacts/messages
// (Sprint Notif Infra 2026-05-26).
//
// Garde l'URL accessible pour les liens internes/bookmarks externes mais
// matérialise la nouvelle architecture "Contacts & Messages".

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function LegacySubmissionsRedirect({
  params,
  searchParams,
}: PageProps): Promise<never> {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v !== undefined) qs.set(k, v);
  }
  const suffix = qs.toString();
  permanentRedirect(`/fr/${adminPrefix}/contacts/messages${suffix ? `?${suffix}` : ""}`);
}
