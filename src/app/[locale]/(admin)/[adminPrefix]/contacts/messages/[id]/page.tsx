// Contacts admin — détail message (Sprint Notif Infra 2026-05-26).
//
// Route canonique (anciennement `/submissions/[id]`).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import { markInboxRead } from "@/features/admin-inbox/reads";
import { SubmissionDetailContent } from "../../../submissions/_v2/SubmissionDetailContent";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function ContactsMessageDetailPage({ params }: PageProps) {
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

  // Un apporteur a SA fiche (2026-09-19) : retour vers la liste des apporteurs,
  // résultat de l'invitation. Un lien ancien — favori, notification, boîte de
  // réception d'avant ce lot — l'ouvrait ici « comme un message ». La
  // redirection est serveur : le lien reste valide, il atterrit au bon endroit.
  //
  // Placée AVANT l'accusé de lecture : la fiche d'arrivée le pose elle-même, il
  // ne doit pas l'être deux fois. Un id inconnu n'est pas redirigé — la fiche
  // rend son propre 404, comme avant.
  const ligne = await prisma.submission.findUnique({ where: { id }, select: { details: true } });
  if (ligne && estApporteur(ligne.details)) {
    redirect(`/fr/${adminPrefix}/contacts/commercial/${id}`);
  }

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
