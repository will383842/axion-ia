// Contacts admin — détail d'une candidature commerciale (tunnel sans CV).
//
// Même contenu que /contacts/messages/[id] (SubmissionDetailContent partagé,
// qui rend le bloc structuré `details.candidature`), mais l'URL vit sous
// /contacts/commercial : c'est elle que pointent la notification Telegram 🧲
// et l'email récap interne, et le retour ramène au bon listing.

import { auth } from "@/auth";
import { markInboxRead } from "@/features/admin-inbox/reads";
import { SubmissionDetailContent } from "../../../submissions/_v2/SubmissionDetailContent";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function ContactsCommercialDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  // Boîte de réception : ouvrir la fiche vaut lecture (best-effort, ne throw pas).
  const session = await auth();
  await markInboxRead(session?.user?.id, "submission", id);

  return (
    <SubmissionDetailContent
      adminPrefix={adminPrefix}
      id={id}
      backHref={`/fr/${adminPrefix}/contacts/commercial`}
      backLabel="← Commercial"
    />
  );
}
