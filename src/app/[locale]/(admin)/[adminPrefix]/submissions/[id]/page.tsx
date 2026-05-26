// Submission detail (legacy redirect) — Sprint Notif Infra 2026-05-26.
//
// La nouvelle route canonique est `/contacts/messages/[id]`. Cette page
// effectue un 301 permanent pour rediriger les anciens liens / bookmarks.

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function LegacySubmissionDetailRedirect({
  params,
}: PageProps): Promise<never> {
  const { adminPrefix, id } = await params;
  permanentRedirect(`/fr/${adminPrefix}/contacts/messages/${id}`);
}
