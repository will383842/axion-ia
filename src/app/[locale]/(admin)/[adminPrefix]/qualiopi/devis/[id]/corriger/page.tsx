/**
 * Admin — Qualiopi · Corriger un brouillon de devis CLASSIQUE.
 *
 * REPLI D7, à lister dans la garde S15 : écran de modification d'un brouillon classique (lignes
 * libres) — aucune redirection vers l'assistant. Les devis à formules ont leur propre chemin
 * (`[id]/modifier`) et ne passent jamais par ici.
 *
 * Server Component — garde d'écriture, force-dynamic, noindex. 404 sauf si le devis est un
 * BROUILLON CLASSIQUE (`offre === null && offreSha256 === null`). Les lignes stockées (JSON)
 * sont relues par un schéma strict : illisibles, le formulaire ne s'ouvre pas (jamais d'écrasement).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { DevisForm } from "@/components/admin/qualiopi/DevisForm";
import { lignesVersFormulaire } from "@/components/admin/qualiopi/devis-edition-lignes";
import { gardePage } from "@/server/auth/garde-page";
import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/is-uuid";
import { listOffres } from "@/server/qualiopi/offres/offres";
import { ACTIVITE_LABELS } from "@/server/qualiopi/financements/facture-libre-pur";
import type { ActiviteFacturation } from "../../../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Corriger le brouillon | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function QualiopiDevisCorrigerPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!isUuid(id)) notFound();

  const devis = await prisma.devis.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      statut: true,
      offre: true,
      offreSha256: true,
      lignes: true,
      activite: true,
      refClient: true,
      updatedAt: true,
      client: { select: { id: true, numero: true, raisonSociale: true } },
    },
  });
  if (
    !devis ||
    devis.statut !== "brouillon" ||
    devis.offre !== null ||
    devis.offreSha256 !== null
  ) {
    notFound();
  }

  const basePath = `/${locale}/${adminPrefix}/qualiopi/devis`;
  const retourHref = `${basePath}/${devis.id}`;
  const lignes = lignesVersFormulaire(devis.lignes);

  const entete = (
    <>
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={retourHref}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Retour au devis
        </Link>
      </div>
      <AdminPageHeader
        title={`Corriger le brouillon ${devis.numero}`}
        description="Un devis envoyé ne se modifie pas : il se révise. Si ce brouillon a été enregistré depuis un autre onglet, la page demandera de recharger."
      />
    </>
  );

  if (lignes === null) {
    return (
      <AdminPageShell width="narrow">
        {entete}
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Les lignes de ce brouillon ne peuvent pas être relues : le formulaire n&apos;est pas
          ouvert, pour ne rien écraser. Le devis reste tel quel.
        </p>
      </AdminPageShell>
    );
  }

  const offresWithPrice = await listOffres({ actifOnly: true });
  // Montants en CENTIMES, résolus côté serveur (voir la page de création : ne pas importer
  // `pricing-resolver` dans le composant client).
  const offreOptions = offresWithPrice.map((o) => ({
    tierId: o.offre.tierId,
    code: o.offre.code,
    titreFr: o.offre.titreFr,
    prixLabelFr: o.prixLabelFr,
    prixHtCents: o.prixHtEur === null ? null : Math.round(o.prixHtEur * 100),
    noteDevisFr: o.noteDevisFr,
  }));

  return (
    <AdminPageShell width="narrow">
      {entete}
      <DevisForm
        clients={[
          {
            id: devis.client.id,
            numero: devis.client.numero,
            raisonSociale: devis.client.raisonSociale,
          },
        ]}
        offres={offreOptions}
        activites={(Object.keys(ACTIVITE_LABELS) as ActiviteFacturation[]).map((value) => ({
          value,
          label: ACTIVITE_LABELS[value],
        }))}
        basePath={basePath}
        defaultClientId={devis.client.id}
        edition={{
          devisId: devis.id,
          attenduMajLe: devis.updatedAt.toISOString(),
          lignes,
          activite: devis.activite,
          refClient: devis.refClient,
        }}
      />
    </AdminPageShell>
  );
}
