// Contacts admin — détail d'une candidature commerciale (tunnel sans CV).
//
// Même contenu que /contacts/messages/[id] (SubmissionDetailContent partagé,
// qui rend le bloc structuré `details.candidature`), mais l'URL vit sous
// /contacts/commercial : c'est elle que pointent la notification Telegram 🧲
// et l'email récap interne, et le retour ramène au bon listing.

import { auth } from "@/auth";
import { markInboxRead } from "@/features/admin-inbox/reads";
import { SubmissionDetailContent } from "../../../submissions/_v2/SubmissionDetailContent";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function ContactsCommercialDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  // 🔑 On appelle la garde pour son EFFET : sans session, elle redirige vers la
  // connexion. C'est ce que cette page doit garantir par elle-même — le proxy
  // ne peut pas être la seule couche (contournement du 2026-09-05).
  //
  // ⚠️ Pas de `<AccesRefuse>` ici, et ce n'est pas un oubli : en consultation,
  //    le seul refus possible est « rôle non reconnu », que le layout admin
  //    intercepte DÉJÀ avant de rendre ses enfants. La branche serait morte, et
  //    elle coûtait 1,64 kB gz au cliquet de bundle sur les 29 pages de ce lot
  //    (mesuré par Gate B) — `AccesRefuse` tire `next/link` et une icône.
  await gardePage("consultation", `/fr/${adminPrefix}/login`);

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
