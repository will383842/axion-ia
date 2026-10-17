/**
 * Admin — Qualiopi · Fiche session › Dossier complet (chantier QNC, L11).
 *
 * Tout ce qui concerne la session, rangé par destinataire (stagiaire,
 * entreprise, formateur, financeur), par canal (espace personnel, e-mail,
 * papier, autre) et par date, heure de Paris — avec le contenu des e-mails, les
 * originaux remplacés étiquetés et les blocs Moyens, Réclamations et Adaptation.
 *
 * 🔑 UNE seule règle de lecture : cet écran affiche le rendu que le ZIP écrit
 * (`rendreDossier`). Lecture seule, livrée allumée ; le ZIP, lui, ne porte ce
 * dossier qu'interrupteur allumé — l'écran le dit en tête.
 *
 * Bloc Adaptation : donnée de santé, chargé pour le seul référent handicap.
 *
 * Server Component. Force-dynamic (au build la base est un stub).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { chargerDossierPourEcran } from "@/server/qualiopi/dossier-session/ecran";
import { VueDossierSession } from "@/features/admin-qualiopi/session-hub/VueDossierSession";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dossier complet de la session",
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
        Dossier complet
      </h2>
      <VueDossierSession
        rendu={dossier.rendu}
        copies={dossier.copies}
        hrefEmailsEnvoyes={`/${locale}/${adminPrefix}/emails-envoyes`}
        avecBlocs
        noteZip={dossier.noteZip}
      />
    </>
  );
}
