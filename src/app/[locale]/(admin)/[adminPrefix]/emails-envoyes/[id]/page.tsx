// E-mails envoyés › un e-mail — écran de DÉTAIL (2026-09-27, décision Will).
//
// « Voir l'e-mail tel qu'il a été envoyé » : la copie conservée par le worker
// au moment de l'envoi (`email_log_contents`), rendue dans une iframe isolée.
// Sans copie (envoi antérieur, purgé, raté), l'écran dit POURQUOI — et, pour
// une invitation apporteur, propose un aperçu RECONSTITUÉ, bandé comme tel.
//
// Route à segment dynamique : c'est un écran de détail, atteint depuis la
// liste (chaque ligne y mène), jamais depuis le menu — la passe réciproque de
// `admin-nav:routes-check` le classe comme tel.
//
// La page ne fait que garder l'accès et charger la donnée ; le rendu vit dans
// `VueDetailEmail`, affichable sans session.
//
// FR uniquement (admin FR).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { gardePage } from "@/server/auth/garde-page";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminPageShell } from "@/components/admin/ui";
import {
  chargerDetailEmail,
  datePremiereCopie,
  raisonSansCopie,
  type RaisonSansCopie,
} from "@/features/admin-emails/detail";
import {
  estReconstituable,
  reconstituerInvitation,
  type ApercuReconstitue,
} from "@/features/admin-emails/reconstitution-invitation";
import { VueDetailEmail } from "../_components/VueDetailEmail";

// Jamais pré-rendue : au build la base est un stub (`stub.invalid`), et le
// contenu d'un e-mail n'a rien à faire dans un cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-mail envoyé",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function EmailEnvoyeDetailPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix, id } = await params;
  const base = `/fr/${adminPrefix}/emails-envoyes`;

  // Même garde que la liste, par le SSOT : sans session → connexion ; session
  // sans rôle de console → refus NOMMÉ. Le contenu d'un e-mail est une donnée
  // personnelle : on ne le lit qu'APRÈS la garde.
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={base} />;

  const sp = await searchParams;
  const vue = sp.vue === "texte" ? "texte" : "html";

  const email = await chargerDetailEmail(id);
  if (!email) notFound();

  let raison: RaisonSansCopie | null = null;
  let apercu: ApercuReconstitue | null = null;
  if (email.copie === null) {
    raison = raisonSansCopie(email, await datePremiereCopie());
    if (estReconstituable(email)) apercu = await reconstituerInvitation(email);
  }

  return (
    <AdminPageShell width="wide">
      <VueDetailEmail
        email={email}
        vue={vue}
        raison={raison}
        apercu={apercu}
        base={base}
        adminPrefix={adminPrefix}
      />
    </AdminPageShell>
  );
}
