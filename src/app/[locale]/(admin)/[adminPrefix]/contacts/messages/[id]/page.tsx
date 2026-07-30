// Contacts admin — détail message (Sprint Notif Infra 2026-05-26).
//
// Route canonique (anciennement `/submissions/[id]`).

import { auth } from "@/auth";
import { markInboxRead } from "@/features/admin-inbox/reads";
import { SubmissionDetailContent } from "../../../submissions/_v2/SubmissionDetailContent";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function ContactsMessageDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  // Boîte de réception (2026-07-29) — « non lu » façon boîte mail : ouvrir la
  // fiche vaut lecture, sans geste. Best-effort : `markInboxRead` ne throw
  // jamais, une demande client s'affiche même si l'accusé échoue.
  const session = await auth();
  await markInboxRead(session?.user?.id, "submission", id);

  return (
    <SubmissionDetailContent
      adminPrefix={adminPrefix}
      id={id}
      backHref={`/fr/${adminPrefix}/contacts/messages`}
      backLabel="← Messages"
    />
  );
}
