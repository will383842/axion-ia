/**
 * Admin — Qualiopi · Fiche session › E-mails (chantier QNC, L11).
 *
 * Les e-mails de la session, rangés par destinataire et par date, heure de
 * Paris, avec leur contenu tel qu'il est parti. Rattachés par l'ENTITÉ visée
 * (`idsLiesALaSession`), jamais par l'adresse : aucun courrier d'un autre
 * dossier ne s'y glisse.
 *
 * C'est le rendu de l'onglet « Dossier », réduit aux e-mails
 * (`restreindreAuxEmails`) — donc le même que le ZIP. Lecture seule.
 *
 * Server Component. Force-dynamic.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { chargerDossierPourEcran } from "@/server/qualiopi/dossier-session/ecran";
import { restreindreAuxEmails } from "@/server/qualiopi/dossier-session/rendu";
import { VueDossierSession } from "@/features/admin-qualiopi/session-hub/VueDossierSession";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-mails de la session",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}): Promise<React.ReactElement> {
  const { locale, adminPrefix, id } = await params;

  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const dossier = await chargerDossierPourEcran(id, { role: acces.role });
  if (dossier === null) notFound();

  return (
    <>
      {/* L2 — fil d'Ariane, retour à la fiche et en-tête : `sessions/[id]/layout.tsx`. */}
      <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        E-mails
      </h2>
      <VueDossierSession
        rendu={restreindreAuxEmails(dossier.rendu)}
        copies={dossier.copies}
        hrefEmailsEnvoyes={`/${locale}/${adminPrefix}/emails-envoyes`}
        avecBlocs={false}
        noteZip={dossier.noteZip}
      />
    </>
  );
}
