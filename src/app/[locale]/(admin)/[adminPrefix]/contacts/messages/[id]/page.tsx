// Contacts admin — détail message (Sprint Notif Infra 2026-05-26).
//
// Route canonique (anciennement `/submissions/[id]`).

import { SubmissionDetailContent } from "../../../submissions/_v2/SubmissionDetailContent";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function ContactsMessageDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  return (
    <SubmissionDetailContent
      adminPrefix={adminPrefix}
      id={id}
      backHref={`/fr/${adminPrefix}/contacts/messages`}
      backLabel="← Messages"
    />
  );
}
