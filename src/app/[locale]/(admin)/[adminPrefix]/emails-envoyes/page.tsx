// E-mails envoyés — le journal qui n'était affiché nulle part.
//
// La table `email_logs` est écrite depuis le premier jour par le worker
// d'envoi, et indexée sur template, statut, destinataire et date. Rien ne la
// lisait : aucune page, aucun composant, aucune requête. Les 61 gabarits qui
// partent en automatique étaient invisibles.
//
// La page ne fait que garder l'accès et charger la donnée ; le rendu vit dans
// `VueEmails`, affichable sans session — c'est ce qui rend le contrôle visuel
// possible sans identifiants.
//
// FR uniquement (CLAUDE.md §14 admin FR).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui";
import {
  chargerEmails,
  lireFenetreEmails,
  lirePage,
  lireStatutEmail,
} from "@/features/admin-emails/query";
import { VueEmails } from "./_components/VueEmails";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-mails envoyés",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function EmailsEnvoyesPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const sp = await searchParams;
  const filtres = {
    jours: lireFenetreEmails(sp.fenetre),
    statut: lireStatutEmail(sp.statut),
    gabarit: sp.gabarit?.slice(0, 60) ?? null,
    destinataire: sp.destinataire?.slice(0, 120) ?? null,
    page: lirePage(sp.page),
  };

  const donnees = await chargerEmails(filtres);

  return (
    <AdminPageShell width="wide">
      <VueEmails donnees={donnees} filtres={filtres} adminPrefix={adminPrefix} />
    </AdminPageShell>
  );
}
